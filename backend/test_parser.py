import os
import sys
import unittest

sys.path.append(os.path.dirname(__file__))

from parser import (
    build_generic_transaction,
    build_icici_op_transaction,
    build_trade_book_transaction,
    infer_transaction_types,
    is_icici_op_transaction_statement,
    is_trade_book_statement,
    parse_generic_transaction_blocks,
    parse_generic_text_row,
    parse_table_transaction_row,
    parse_trade_book_line,
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

    def test_parse_generic_text_row_with_simple_columns(self):
        line = "01-07-2024 UPI PAYMENT TO SHOP 100.00 5,000.00"
        parsed = parse_generic_text_row(line)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["date"], "01-07-2024")
        self.assertEqual(parsed["amount"], 100.0)
        self.assertEqual(parsed["balance"], 5000.0)
        self.assertEqual(parsed["narration"], "UPI PAYMENT TO SHOP")

    def test_parse_generic_text_row_with_month_name(self):
        line = "1 July 2024 ATM WITHDRAWAL 200.00 4,800.00"
        parsed = parse_generic_text_row(line)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["date"], "01-07-2024")
        self.assertEqual(parsed["amount"], 200.0)
        self.assertEqual(parsed["balance"], 4800.0)
        self.assertIn("ATM WITHDRAWAL", parsed["narration"])

    def test_is_icici_op_transaction_statement_detects_dot_date_format(self):
        sample_text = (
            "Statement of Transactions in Saving Account no. 001801507004 "
            "1 01.06.2026 1.00 902837.38"
        )
        self.assertTrue(is_icici_op_transaction_statement(sample_text))

    def test_build_icici_op_transaction_collects_narration_lines(self):
        lines = [
            "MONEYLICIO",
            "1 01.06.2026 1.00 902837.38",
            "UPI/MONEYLICIO/yespay.bttshbn/Account",
            "Ve/YesBank_Ye/109922160209/ICI49bac189465b4",
            "CAUVERY ED",
            "2 02.06.2026 40430.00 862407.38",
            "BIL/NEFT/IN12615340191902/Tanish",
        ]
        txn_indices = [1, 5]

        parsed = build_icici_op_transaction(lines, 0, txn_indices)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["date"], "01-06-2026")
        self.assertEqual(parsed["amount"], 1.0)
        self.assertEqual(parsed["balance"], 902837.38)
        self.assertIn("MONEYLICIO", parsed["narration"])
        self.assertIn("UPI/MONEYLICIO", parsed["narration"])
        self.assertNotIn("CAUVERY ED", parsed["narration"])

    def test_build_icici_op_transaction_includes_cheque_number(self):
        lines = [
            "Clearance of cheque",
            "15 09.06.2026 46710 15949.00 812094.67",
            "CLG/LIC OF INDIA /IDB",
        ]
        txn_indices = [1]

        parsed = build_icici_op_transaction(lines, 0, txn_indices)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["amount"], 15949.0)
        self.assertIn("Chq 46710", parsed["narration"])

    def test_is_trade_book_statement_detects_trade_book_header(self):
        sample_text = "Date Stock Action Qty Price Total\n30-Jun-26 SONCL Sell 1000 53.64 53763.94"
        self.assertTrue(is_trade_book_statement(sample_text))

    def test_parse_trade_book_line_parses_buy_and_sell_rows(self):
        sell = parse_trade_book_line("30-Jun-26 SONCL Sell 1000 53.64 53763.94")
        buy = parse_trade_book_line("29-Jun-26 BHAPET Buy 120 300.5 36145.36")

        self.assertIsNotNone(sell)
        self.assertEqual(sell["date"], "30-06-2026")
        self.assertEqual(sell["amount"], 53763.94)
        self.assertEqual(sell["transaction_type"], "deposit")
        self.assertIn("Sell SONCL", sell["narration"])

        self.assertIsNotNone(buy)
        self.assertEqual(buy["date"], "29-06-2026")
        self.assertEqual(buy["amount"], 36145.36)
        self.assertEqual(buy["transaction_type"], "withdrawal")
        self.assertIn("Buy BHAPET", buy["narration"])

    def test_build_trade_book_transaction_normalizes_short_month_date(self):
        parsed = build_trade_book_transaction("30-Jun-26", "SONCL", "Sell", "1000", "53.64", "53763.94")
        self.assertEqual(parsed["date"], "30-06-2026")


if __name__ == "__main__":
    unittest.main()
