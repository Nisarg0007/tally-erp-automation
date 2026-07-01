import os
import sys
import unittest

sys.path.append(os.path.dirname(__file__))

from parser import (
    build_generic_transaction,
    infer_transaction_types,
    parse_generic_transaction_blocks,
    parse_table_transaction_row,
)


class ParserTests(unittest.TestCase):
    def test_build_generic_transaction_parses_amount_and_balance(self):
        block = ["01-07-2024", "UPI PAYMENT TO SHOP", "100.00", "5000.00"]

        parsed = build_generic_transaction(block)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["date"], "01-07-2024")
        self.assertEqual(parsed["amount"], 100.0)
        self.assertEqual(parsed["balance"], 5000.0)
        self.assertEqual(parsed["narration"], "UPI PAYMENT TO SHOP")

    def test_parse_generic_transaction_blocks_splits_on_new_dates(self):
        lines = [
            "01-07-2024",
            "UPI PAYMENT TO SHOP",
            "100.00",
            "5000.00",
            "02-07-2024",
            "ATM WITHDRAWAL",
            "200.00",
            "4800.00",
        ]

        blocks = parse_generic_transaction_blocks(lines)

        self.assertEqual(len(blocks), 2)

    def test_infer_transaction_types_uses_balance_changes(self):
        transactions = [
            {"balance": 1000.0},
            {"balance": 1100.0},
            {"balance": 900.0},
        ]

        inferred = infer_transaction_types(transactions, opening_balance=1000.0)

        self.assertEqual(inferred[0]["transaction_type"], "withdrawal")
        self.assertEqual(inferred[1]["transaction_type"], "deposit")
        self.assertEqual(inferred[2]["transaction_type"], "withdrawal")

    def test_parse_table_transaction_row_with_date_cells(self):
        cells = [
            "01-07-2024",
            "UPI PAYMENT TO SHOP",
            "100.00",
            "5,000.00",
        ]

        parsed = parse_table_transaction_row(cells)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["date"], "01-07-2024")
        self.assertEqual(parsed["amount"], 100.0)
        self.assertEqual(parsed["balance"], 5000.0)
        self.assertEqual(parsed["narration"], "UPI PAYMENT TO SHOP")

    def test_parse_table_transaction_row_skips_total_rows(self):
        cells = ["Total", "", "1,000.00", "10,000.00"]
        self.assertIsNone(parse_table_transaction_row(cells))


if __name__ == "__main__":
    unittest.main()
