import os
import sys
import unittest
import xml.etree.ElementTree as ET

sys.path.append(os.path.dirname(__file__))

from app import build_tally_xml, validate_transactions_for_export
from models import Transaction


class TallyExportTests(unittest.TestCase):
    def test_build_tally_xml_creates_two_ledger_entries_with_correct_signs(self):
        transaction = Transaction(
            date="01-07-2024",
            narration="Receipt from customer",
            transaction_type="deposit",
            amount=1500.0,
            balance=10000.0,
            voucher_type="Receipt",
            debit_ledger="Bank Account",
            credit_ledger="Customer Account",
            final_narration="Receipt from customer",
            status="Approved",
        )

        payload = build_tally_xml([transaction])
        root = ET.fromstring(payload)
        voucher = root.find("BODY/IMPORTDATA/REQUESTDATA/TALLYMESSAGE/VOUCHER")

        self.assertIsNotNone(voucher)
        entries = voucher.findall("ALLLEDGERENTRIES.LIST")
        self.assertEqual(len(entries), 2)

        debit_entry = entries[0]
        credit_entry = entries[1]

        self.assertEqual(debit_entry.findtext("LEDGERNAME"), "Bank Account")
        self.assertEqual(debit_entry.findtext("ISDEEMEDPOSITIVE"), "Yes")
        self.assertEqual(debit_entry.findtext("AMOUNT"), "-1500.00")
        self.assertEqual(debit_entry.findtext("LEDGERFROMITEM"), "No")
        self.assertEqual(debit_entry.findtext("REMOVEZEROENTRIES"), "No")
        self.assertEqual(debit_entry.findtext("ISPARTYLEDGER"), "No")

        self.assertEqual(credit_entry.findtext("LEDGERNAME"), "Customer Account")
        self.assertEqual(credit_entry.findtext("ISDEEMEDPOSITIVE"), "No")
        self.assertEqual(credit_entry.findtext("AMOUNT"), "1500.00")
        self.assertEqual(credit_entry.findtext("LEDGERFROMITEM"), "No")
        self.assertEqual(credit_entry.findtext("REMOVEZEROENTRIES"), "No")
        self.assertEqual(credit_entry.findtext("ISPARTYLEDGER"), "No")

    def test_validate_transactions_for_export_rejects_invalid_vouchers(self):
        invalid = Transaction(
            date="01-07-2024",
            narration="Bad voucher",
            transaction_type="deposit",
            amount=0.0,
            balance=10000.0,
            voucher_type="",
            debit_ledger="",
            credit_ledger="",
            final_narration="Bad voucher",
            status="Approved",
        )

        with self.assertRaises(ValueError) as context:
            validate_transactions_for_export([invalid])

        self.assertIn("voucher type", str(context.exception).lower())
        self.assertIn("debit ledger", str(context.exception).lower())
        self.assertIn("credit ledger", str(context.exception).lower())

    def test_validate_transactions_for_export_rejects_same_ledger(self):
        transaction = Transaction(
            date="02-07-2024",
            narration="Transfer",
            transaction_type="withdrawal",
            amount=250.0,
            balance=9500.0,
            voucher_type="Contra",
            debit_ledger="Cash",
            credit_ledger="Cash",
            final_narration="Transfer",
            status="Approved",
        )

        with self.assertRaises(ValueError) as context:
            validate_transactions_for_export([transaction])

        self.assertIn("same ledger", str(context.exception).lower())


if __name__ == "__main__":
    unittest.main()
