import pdfplumber
import re


def clean_amount(value):
    return float(value.replace(",", ""))


def is_date_line(line):
    return bool(
        re.match(r"^\d{2}-\d{2}-\d{4}", line)
    )


def parse_pdf_statement(pdf_path):

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

                if (
                    "Statement of Transactions in Savings Account"
                    in line
                ):
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

        else:

            if current_block:
                current_block.append(line)

    if current_block:
        blocks.append(current_block)

    opening_balance = None

    for block in blocks:

        full_text = " ".join(block)

        if "B/F" in full_text:

            amounts = re.findall(
                r"\d{1,3}(?:,\d{2,3})*\.\d{2}",
                full_text
            )

            if amounts:
                opening_balance = clean_amount(
                    amounts[-1]
                )

            continue

        amounts = re.findall(
            r"\d{1,3}(?:,\d{2,3})*\.\d{2}",
            full_text
        )

        if len(amounts) < 2:
            continue

        date = block[0][:10]

        amount = clean_amount(
            amounts[-2]
        )

        balance = clean_amount(
            amounts[-1]
        )

        narration = full_text

        narration = narration.replace(
            date,
            "",
            1
        )

        narration = narration.replace(
            amounts[-2],
            ""
        )

        narration = narration.replace(
            amounts[-1],
            ""
        )

        narration = narration.replace(
            "MOBILE BANKING ",
            "MOBILE BANKING "
        )

        narration = re.sub(
            r"\s+",
            " ",
            narration
        ).strip()

        transactions.append({
            "date": date,
            "narration": narration,
            "amount": amount,
            "balance": balance
        })

    for i in range(len(transactions)):

        if i == 0:

            if opening_balance is not None:

                if (
                    transactions[i]["balance"]
                    > opening_balance
                ):
                    transactions[i][
                        "transaction_type"
                    ] = "deposit"

                else:
                    transactions[i][
                        "transaction_type"
                    ] = "withdrawal"

            else:

                transactions[i][
                    "transaction_type"
                ] = "unknown"

            continue

        previous_balance = transactions[
            i - 1
        ]["balance"]

        current_balance = transactions[
            i
        ]["balance"]

        if current_balance > previous_balance:

            transactions[i][
                "transaction_type"
            ] = "deposit"

        else:

            transactions[i][
                "transaction_type"
            ] = "withdrawal"

    return transactions