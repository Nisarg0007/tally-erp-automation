import pdfplumber
import re


class UnsupportedStatementFormatError(Exception):
    """Raised when a PDF does not match any supported statement format."""


PMS_TRANSACTION_PATTERN = re.compile(
    r"^(Buy|Sell)\s+"
    r"(\d{2}/\d{2}/\d{4})\s+"
    r"(\d{2}/\d{2}/\d{4})\s+"
    r"(.+)\s+"
    r"(NSE|BSE)\s+"
    r"([\d,.]+)\s+"
    r"([\d,.]+)\s+"
    r"([\d,.]+)\s+"
    r"([\d,.]+)\s+"
    r"([\d,.]+)$"
)
DATE_PATTERN = re.compile(
    r"(?<!\d)(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})(?!\d)"
)
MONEY_PATTERN = re.compile(r"(?<!\d)(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?!\d)")


def clean_amount(value):
    if value is None:
        return None

    cleaned = re.sub(r"[^0-9.\-]", "", str(value))
    if not cleaned:
        return None

    try:
        return float(cleaned)
    except ValueError:
        return None


def is_date_line(line):
    return bool(DATE_PATTERN.search(line.strip()))


def normalize_date(date_string: str) -> str:
    value = date_string.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        year, month, day = value.split("-")
        return f"{day}-{month}-{year}"

    if re.match(r"^\d{2}-\d{2}-\d{4}$", value):
        day, month, year = value.split("-")
        return f"{day}-{month}-{year}"

    if re.match(r"^\d{2}/\d{2}/\d{4}$", value):
        day, month, year = value.split("/")
        return f"{day}-{month}-{year}"

    return value


def convert_slash_date_to_dmy(date_string: str) -> str:
    day, month, year = date_string.split("/")
    return f"{day}-{month}-{year}"


def infer_transaction_types(transactions, opening_balance=None):
    for index in range(len(transactions)):
        if index == 0:
            if opening_balance is not None:
                if transactions[index]["balance"] > opening_balance:
                    transactions[index]["transaction_type"] = "deposit"
                else:
                    transactions[index]["transaction_type"] = "withdrawal"
            else:
                transactions[index]["transaction_type"] = "unknown"
            continue

        previous_balance = transactions[index - 1]["balance"]
        current_balance = transactions[index]["balance"]

        if current_balance > previous_balance:
            transactions[index]["transaction_type"] = "deposit"
        else:
            transactions[index]["transaction_type"] = "withdrawal"

    return transactions


def extract_money_values(text):
    sanitized = re.sub(DATE_PATTERN, " ", text)
    values = []
    for match in MONEY_PATTERN.finditer(sanitized):
        amount = clean_amount(match.group(0))
        if amount is not None:
            values.append(amount)
    return values


def extract_money_tokens(text):
    sanitized = re.sub(DATE_PATTERN, " ", text)
    return [match.group(0) for match in MONEY_PATTERN.finditer(sanitized)]


def parse_generic_transaction_blocks(lines):
    blocks = []
    current_block = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if is_date_line(line):
            if current_block:
                blocks.append(current_block)
            current_block = [line]
        elif current_block:
            current_block.append(line)

    if current_block:
        blocks.append(current_block)

    return blocks


def build_generic_transaction(block, opening_balance=None):
    if not block:
        return None

    full_text = " ".join(block)
    date_match = DATE_PATTERN.search(full_text)
    if not date_match:
        return None

    full_text_lower = full_text.lower()
    if "opening balance" in full_text_lower or "b/f" in full_text_lower:
        amounts = extract_money_values(full_text)
        if amounts:
            return {"opening_balance": amounts[-1]}
        return None

    amounts = extract_money_values(full_text)
    if len(amounts) < 2:
        return None

    amount = amounts[-2]
    balance = amounts[-1]
    date = normalize_date(date_match.group(0))

    narration = full_text
    narration = narration.replace(date_match.group(0), "", 1)
    for token in extract_money_tokens(full_text):
        narration = narration.replace(token, " ")
    narration = re.sub(r"\s+", " ", narration).strip(" -|")

    if not narration:
        narration = "Transaction"

    return {
        "date": date,
        "narration": narration,
        "amount": amount,
        "balance": balance,
    }


def parse_icici_savings_statement(pdf_path):
    transactions = []
    lines = []
    inside_transactions = False

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue

            for line in text.split("\n"):
                line = line.strip()

                if "Statement of Transactions in Savings Account" in line:
                    inside_transactions = True
                    continue

                if line.startswith("Total:"):
                    inside_transactions = False
                    break

                if inside_transactions:
                    lines.append(line)

    blocks = parse_generic_transaction_blocks(lines)
    opening_balance = None

    for block in blocks:
        parsed = build_generic_transaction(block)
        if parsed is None:
            continue

        if "opening_balance" in parsed:
            opening_balance = parsed["opening_balance"]
            continue

        transactions.append(parsed)

    return infer_transaction_types(transactions, opening_balance)


def parse_pms_transaction_statement(pdf_path):
    transactions = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue

            for line in text.split("\n"):
                line = line.strip()
                match = PMS_TRANSACTION_PATTERN.match(line)
                if not match:
                    continue

                side, tran_date, settlement_date, security, exchange, quantity, _, _, _, amount = match.groups()

                transactions.append({
                    "date": convert_slash_date_to_dmy(tran_date),
                    "narration": (
                        f"{side} {security.strip()} ({exchange}) "
                        f"Qty {quantity} Settle {settlement_date}"
                    ),
                    "amount": clean_amount(amount),
                    "balance": 0,
                    "transaction_type": "deposit" if side == "Sell" else "withdrawal",
                })

    return transactions


def parse_generic_bank_statement(pdf_path):
    transactions = []
    opening_balance = None

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue

            lines = [line.strip() for line in text.split("\n") if line.strip()]
            blocks = parse_generic_transaction_blocks(lines)

            for block in blocks:
                parsed = build_generic_transaction(block)
                if parsed is None:
                    continue

                if "opening_balance" in parsed:
                    opening_balance = parsed["opening_balance"]
                    continue

                transactions.append(parsed)

    return infer_transaction_types(transactions, opening_balance)


def extract_pdf_text(pdf_path) -> str:
    chunks = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                chunks.append(text)
    return "\n".join(chunks)


def parse_pdf_statement(pdf_path):
    full_text = extract_pdf_text(pdf_path)

    if not full_text.strip():
        raise UnsupportedStatementFormatError(
            "Could not read any text from this PDF. The file may be scanned or password protected."
        )

    if re.search(r"statement of transactions", full_text, re.I) or re.search(r"account statement", full_text, re.I):
        transactions = parse_icici_savings_statement(pdf_path)
        if transactions:
            return transactions

    is_pms_statement = (
        "TRANSACTION STATEMENT" in full_text
        or "Care Portfolio Managers" in full_text
    )

    if is_pms_statement or PMS_TRANSACTION_PATTERN.search(full_text):
        transactions = parse_pms_transaction_statement(pdf_path)
        if transactions:
            return transactions
        if is_pms_statement:
            raise UnsupportedStatementFormatError(
                "PMS transaction statement detected, but no transactions could be extracted."
            )

    if re.search(r"\b(balance|deposit|withdrawal|debit|credit|transaction)\b", full_text, re.I):
        transactions = parse_generic_bank_statement(pdf_path)
        if transactions:
            return transactions

    raise UnsupportedStatementFormatError(
        "Unsupported statement format. Supported formats: ICICI-style account statements, "
        "PMS transaction statements, and other date/narration/amount/balance bank statements."
    )
