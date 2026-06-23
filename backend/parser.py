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


def clean_amount(value):
    return float(value.replace(",", ""))


def is_date_line(line):
    return bool(re.match(r"^\d{2}-\d{2}-\d{4}", line))


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

    blocks = []
    current_block = []

    for line in lines:
        if is_date_line(line):
            if current_block:
                blocks.append(current_block)
            current_block = [line]
        elif current_block:
            current_block.append(line)

    if current_block:
        blocks.append(current_block)

    opening_balance = None

    for block in blocks:
        full_text = " ".join(block)

        if "B/F" in full_text:
            amounts = re.findall(r"\d{1,3}(?:,\d{2,3})*\.\d{2}", full_text)
            if amounts:
                opening_balance = clean_amount(amounts[-1])
            continue

        amounts = re.findall(r"\d{1,3}(?:,\d{2,3})*\.\d{2}", full_text)
        if len(amounts) < 2:
            continue

        date = block[0][:10]
        amount = clean_amount(amounts[-2])
        balance = clean_amount(amounts[-1])

        narration = full_text
        narration = narration.replace(date, "", 1)
        narration = narration.replace(amounts[-2], "")
        narration = narration.replace(amounts[-1], "")
        narration = re.sub(r"\s+", " ", narration).strip()

        transactions.append({
            "date": date,
            "narration": narration,
            "amount": amount,
            "balance": balance,
        })

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

    if "Statement of Transactions in Savings Account" in full_text:
        transactions = parse_icici_savings_statement(pdf_path)
        if transactions:
            return transactions
        raise UnsupportedStatementFormatError(
            "ICICI savings statement detected, but no transactions could be extracted."
        )

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

    raise UnsupportedStatementFormatError(
        "Unsupported statement format. Supported formats: ICICI savings account PDF "
        "and Care Portfolio Managers (PMS) transaction statement PDF."
    )
