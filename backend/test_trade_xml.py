import os
import sys
import unittest
import xml.etree.ElementTree as ET
from decimal import Decimal

sys.path.append(os.path.dirname(__file__))

from trade_xml_generator import build_trade_voucher_xml


class TradeXmlTests(unittest.TestCase):
    def test_build_trade_voucher_xml_creates_purchase_voucher_with_inventory_allocation(self):
        payload = build_trade_voucher_xml([
            {
                "action": "Buy",
                "stock_code": "Reliance",
                "quantity": Decimal("10"),
                "price": Decimal("1000"),
                "total_amount": Decimal("10000"),
                "tally_date": "20240630",
                "narration": "Buy Reliance",
                "party_ledger": "ICICI  Bank  Ltd -  Saving A/c",
                "charges_ledger": "Brokerage & Charges",
                "status": "Approved",
                "charge_posting_mode": "separate",
            }
        ])
        root = ET.fromstring(payload)
        voucher = root.find("BODY/IMPORTDATA/REQUESTDATA/TALLYMESSAGE/VOUCHER")
        self.assertIsNotNone(voucher)
        self.assertEqual(voucher.attrib.get("VCHTYPE"), "Purchase")
        self.assertEqual(voucher.findtext("VOUCHERTYPENAME"), "Purchase")
        purchase_ledger = voucher.findall("ALLLEDGERENTRIES.LIST")[-1]
        inventory_entry = purchase_ledger.find("INVENTORYALLOCATIONS.LIST")
        self.assertIsNotNone(inventory_entry)
        self.assertEqual(inventory_entry.findtext("AMOUNT"), "-10000.00")
        self.assertEqual(inventory_entry.findtext("RATE"), "1000.00/Nos")
        self.assertEqual(inventory_entry.findtext("ACTUALQTY"), " 10 Nos")

    def test_build_trade_voucher_xml_creates_sales_voucher_with_balanced_ledger_entries(self):
        payload = build_trade_voucher_xml([
            {
                "action": "Sell",
                "stock_code": "BHAPET",
                "quantity": Decimal("120"),
                "price": Decimal("300.50"),
                "total_amount": Decimal("34617.02"),
                "tally_date": "20260629",
                "narration": "Sell BHAPET",
                "party_ledger": "ICICI  Bank  Ltd -  Saving A/c",
                "charges_ledger": "Brokerage & Charges",
                "status": "Approved",
                "charge_posting_mode": "include",
            }
        ])
        root = ET.fromstring(payload)
        voucher = root.find("BODY/IMPORTDATA/REQUESTDATA/TALLYMESSAGE/VOUCHER")
        self.assertIsNotNone(voucher)
        self.assertEqual(voucher.attrib.get("VCHTYPE"), "Sales")
        self.assertEqual(voucher.findtext("VOUCHERTYPENAME"), "Sales")

        inventory_entry = voucher.find("ALLINVENTORYENTRIES.LIST")
        self.assertIsNotNone(inventory_entry)
        self.assertEqual(inventory_entry.findtext("ISDEEMEDPOSITIVE"), "Yes")
        self.assertEqual(inventory_entry.findtext("AMOUNT"), "-34617.02")
        self.assertEqual(inventory_entry.findtext("ACCOUNTINGALLOCATIONS.LIST/LEDGERNAME"), "Equity Investment-Sales")
        self.assertEqual(inventory_entry.findtext("ACCOUNTINGALLOCATIONS.LIST/ISDEEMEDPOSITIVE"), "No")
        self.assertEqual(inventory_entry.findtext("ACCOUNTINGALLOCATIONS.LIST/AMOUNT"), "-34617.02")
        self.assertEqual(voucher.findtext("LEDGERENTRIES.LIST/LEDGERNAME"), "ICICI  Bank  Ltd -  Saving A/c")
        self.assertEqual(voucher.findtext("LEDGERENTRIES.LIST/ISDEEMEDPOSITIVE"), "Yes")
        self.assertEqual(voucher.findtext("LEDGERENTRIES.LIST/AMOUNT"), "34617.02")

        total_amount = Decimal("0.00")
        for entry in voucher.findall("LEDGERENTRIES.LIST"):
            total_amount += Decimal(entry.findtext("AMOUNT") or "0")
        for entry in voucher.findall("ALLINVENTORYENTRIES.LIST"):
            accounting_amount = entry.find("ACCOUNTINGALLOCATIONS.LIST")
            if accounting_amount is not None:
                total_amount += Decimal(accounting_amount.findtext("AMOUNT") or "0")

        self.assertEqual(total_amount, Decimal("0.00"))

    def test_build_trade_voucher_xml_balances_purchase_ledger_entries(self):
        payload = build_trade_voucher_xml([
            {
                "action": "Buy",
                "stock_code": "BHAPET",
                "quantity": Decimal("120"),
                "price": Decimal("300.50"),
                "total_amount": Decimal("36145.36"),
                "tally_date": "20260629",
                "narration": "Buy BHAPET",
                "party_ledger": "ICICI  Bank  Ltd -  Saving A/c",
                "charges_ledger": "Brokerage & Charges",
                "status": "Approved",
                "charge_posting_mode": "include",
            }
        ])
        root = ET.fromstring(payload)
        voucher = root.find("BODY/IMPORTDATA/REQUESTDATA/TALLYMESSAGE/VOUCHER")
        self.assertIsNotNone(voucher)

        ledger_entries = voucher.findall("ALLLEDGERENTRIES.LIST")
        self.assertEqual(len(ledger_entries), 2)

        total_amount = Decimal("0.00")
        for entry in ledger_entries:
            amount_text = entry.findtext("AMOUNT")
            self.assertIsNotNone(amount_text)
            total_amount += Decimal(amount_text)

        self.assertEqual(total_amount, Decimal("0.00"))


if __name__ == "__main__":
    unittest.main()
