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
        self.assertIsNotNone(voucher.find("INVENTORYALLOCATIONS.LIST"))
        self.assertEqual(voucher.findtext("INVENTORYALLOCATIONS.LIST/AMOUNT"), "10000.00")
        self.assertEqual(voucher.findtext("INVENTORYALLOCATIONS.LIST/RATE"), "1000.00/Nos")
        self.assertEqual(voucher.findtext("INVENTORYALLOCATIONS.LIST/ACTUALQTY"), " 10 Nos")

    def test_build_trade_voucher_xml_creates_sales_voucher_with_sales_ledger_allocation(self):
        payload = build_trade_voucher_xml([
            {
                "action": "Sell",
                "stock_code": "TCS",
                "quantity": Decimal("5"),
                "price": Decimal("3500"),
                "total_amount": Decimal("17500"),
                "tally_date": "20240630",
                "narration": "Sell TCS",
                "party_ledger": "ICICI  Bank  Ltd -  Saving A/c",
                "charges_ledger": "Brokerage & Charges",
                "status": "Approved",
                "charge_posting_mode": "separate",
            }
        ])
        root = ET.fromstring(payload)
        voucher = root.find("BODY/IMPORTDATA/REQUESTDATA/TALLYMESSAGE/VOUCHER")
        self.assertIsNotNone(voucher)
        self.assertEqual(voucher.attrib.get("VCHTYPE"), "Sales")
        self.assertEqual(voucher.findtext("VOUCHERTYPENAME"), "Sales")
        inventory_entry = voucher.find("ALLINVENTORYENTRIES.LIST")
        self.assertIsNotNone(inventory_entry)
        self.assertEqual(inventory_entry.findtext("ACCOUNTINGALLOCATIONS.LIST/LEDGERNAME"), "Equity Investment-Sales")
        self.assertEqual(inventory_entry.findtext("ACCOUNTINGALLOCATIONS.LIST/AMOUNT"), "17500.00")


if __name__ == "__main__":
    unittest.main()
