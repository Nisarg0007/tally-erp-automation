from __future__ import annotations

import os
import re
import uuid
import xml.etree.ElementTree as ET
from decimal import Decimal
from typing import List


TALLY_COMPANY_NAME = os.getenv("TALLY_COMPANY_NAME", "AMIT NIKUNJ GANDHI")
STOCK_ITEM_GROUP = os.getenv("TRADE_STOCK_ITEM_GROUP", "Equity Shares")
STOCK_UNIT = "Nos"
GODOWN_NAME = "Main Location"
BATCH_NAME = "Primary Batch"


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _format_decimal(value: Decimal) -> str:
    return format(_quantize_money(value), ".2f")


def _format_quantity(quantity: Decimal) -> str:
    return f" {quantity.normalize():f} {STOCK_UNIT}"


def _format_rate(rate: Decimal) -> str:
    return f"{_format_decimal(rate)}/{STOCK_UNIT}"


def _ensure_text(element: ET.Element, tag_name: str, value: str) -> ET.Element:
    child = ET.SubElement(element, tag_name)
    child.text = value
    return child


def _append_ledger_entry(parent: ET.Element, ledger_name: str, is_deemed_positive: str, amount: Decimal, is_party_ledger: str = "No", tag_name: str = "ALLLEDGERENTRIES.LIST") -> ET.Element:
    entry = ET.SubElement(parent, tag_name)
    _ensure_text(entry, "LEDGERNAME", ledger_name)
    ET.SubElement(entry, "GSTCLASS")
    _ensure_text(entry, "ISDEEMEDPOSITIVE", is_deemed_positive)
    _ensure_text(entry, "LEDGERFROMITEM", "No")
    _ensure_text(entry, "REMOVEZEROENTRIES", "No")
    _ensure_text(entry, "ISPARTYLEDGER", is_party_ledger)
    _ensure_text(entry, "AMOUNT", _format_decimal(amount))
    return entry


def _append_inventory_allocation(parent: ET.Element, stock_code: str, quantity: Decimal, amount: Decimal, rate: Decimal, tally_date: str) -> ET.Element:
    entry = ET.SubElement(parent, "INVENTORYALLOCATIONS.LIST")
    _ensure_text(entry, "STOCKITEMNAME", stock_code)
    _ensure_text(entry, "ISDEEMEDPOSITIVE", "Yes")
    _ensure_text(entry, "ISAUTONEGATE", "No")
    _ensure_text(entry, "RATE", _format_rate(rate))
    _ensure_text(entry, "AMOUNT", _format_decimal(amount))
    _ensure_text(entry, "ACTUALQTY", _format_quantity(quantity))
    _ensure_text(entry, "BILLEDQTY", _format_quantity(quantity))

    batch = ET.SubElement(entry, "BATCHALLOCATIONS.LIST")
    _ensure_text(batch, "MFDON", tally_date)
    _ensure_text(batch, "GODOWNNAME", GODOWN_NAME)
    _ensure_text(batch, "BATCHNAME", BATCH_NAME)
    _ensure_text(batch, "DESTINATIONGODOWNNAME", GODOWN_NAME)
    _ensure_text(batch, "INDENTNO", "")
    _ensure_text(batch, "ORDERNO", "")
    _ensure_text(batch, "TRACKINGNUMBER", "")
    _ensure_text(batch, "AMOUNT", _format_decimal(amount))
    _ensure_text(batch, "ACTUALQTY", _format_quantity(quantity))
    _ensure_text(batch, "BILLEDQTY", _format_quantity(quantity))
    return entry


def _append_sales_inventory_entry(parent: ET.Element, stock_code: str, quantity: Decimal, amount: Decimal, rate: Decimal, tally_date: str) -> ET.Element:
    entry = ET.SubElement(parent, "ALLINVENTORYENTRIES.LIST")
    _ensure_text(entry, "STOCKITEMNAME", stock_code)
    _ensure_text(entry, "ISDEEMEDPOSITIVE", "No")
    _ensure_text(entry, "RATE", _format_rate(rate))
    _ensure_text(entry, "AMOUNT", _format_decimal(-amount))
    _ensure_text(entry, "ACTUALQTY", _format_quantity(quantity))
    _ensure_text(entry, "BILLEDQTY", _format_quantity(quantity))
    _ensure_text(entry, "MFDON", tally_date)
    _ensure_text(entry, "GODOWNNAME", GODOWN_NAME)
    _ensure_text(entry, "BATCHNAME", BATCH_NAME)
    _ensure_text(entry, "DESTINATIONGODOWNNAME", GODOWN_NAME)
    accounting = ET.SubElement(entry, "ACCOUNTINGALLOCATIONS.LIST")
    _ensure_text(accounting, "LEDGERNAME", "Equity Investment-Sales")
    _ensure_text(accounting, "ISDEEMEDPOSITIVE", "No")
    _ensure_text(accounting, "AMOUNT", _format_decimal(-amount))
    batch = ET.SubElement(entry, "BATCHALLOCATIONS.LIST")
    _ensure_text(batch, "MFDON", tally_date)
    _ensure_text(batch, "GODOWNNAME", GODOWN_NAME)
    _ensure_text(batch, "BATCHNAME", BATCH_NAME)
    _ensure_text(batch, "DESTINATIONGODOWNNAME", GODOWN_NAME)
    _ensure_text(batch, "INDENTNO", "")
    _ensure_text(batch, "ORDERNO", "")
    _ensure_text(batch, "TRACKINGNUMBER", "")
    _ensure_text(batch, "AMOUNT", _format_decimal(-amount))
    _ensure_text(batch, "ACTUALQTY", _format_quantity(quantity))
    _ensure_text(batch, "BILLEDQTY", _format_quantity(quantity))
    return entry


def _validate_voucher_ledger_balance(voucher: ET.Element, voucher_type: str) -> None:
    if voucher_type == "Purchase":
        total_amount = Decimal("0.00")
        for entry in voucher.findall("ALLLEDGERENTRIES.LIST"):
            amount_text = entry.findtext("AMOUNT")
            if amount_text is None:
                continue
            total_amount += Decimal(amount_text)

        if total_amount != Decimal("0.00"):
            raise ValueError(f"Purchase voucher ledger amounts must balance to zero, got {total_amount}")
        return

    if voucher_type != "Sales":
        return

    total_amount = Decimal("0.00")
    for entry in voucher.findall("LEDGERENTRIES.LIST"):
        amount_text = entry.findtext("AMOUNT")
        if amount_text is None:
            continue
        total_amount += Decimal(amount_text)

    for entry in voucher.findall("ALLINVENTORYENTRIES.LIST"):
        accounting_allocation = entry.find("ACCOUNTINGALLOCATIONS.LIST")
        if accounting_allocation is None:
            continue
        amount_text = accounting_allocation.findtext("AMOUNT")
        if amount_text is None:
            continue
        total_amount += Decimal(amount_text)

    if total_amount != Decimal("0.00"):
        raise ValueError(f"Sales voucher ledger amounts must balance to zero, got {total_amount}")


def _build_trade_envelope(vouchers: List[dict]) -> bytes:
    envelope = ET.Element("ENVELOPE")
    header = ET.SubElement(envelope, "HEADER")
    _ensure_text(header, "TALLYREQUEST", "Import Data")
    request_desc = ET.SubElement(header, "REQUESTDESC")
    _ensure_text(request_desc, "REPORTNAME", "Vouchers")
    static_variables = ET.SubElement(request_desc, "STATICVARIABLES")
    _ensure_text(static_variables, "SVCURRENTCOMPANY", TALLY_COMPANY_NAME)

    body = ET.SubElement(envelope, "BODY")
    import_data = ET.SubElement(body, "IMPORTDATA")
    request_data = ET.SubElement(import_data, "REQUESTDATA")

    for row in vouchers:
        message = ET.SubElement(request_data, "TALLYMESSAGE")
        message.attrib["xmlns:UDF"] = "TallyUDF"
        voucher = ET.SubElement(message, "VOUCHER", {"VCHTYPE": row["voucher_type"], "ACTION": "Create"})
        _ensure_text(voucher, "DATE", row["tally_date"])
        _ensure_text(voucher, "GUID", str(uuid.uuid4()))
        _ensure_text(voucher, "NARRATION", row["narration"])
        _ensure_text(voucher, "VOUCHERTYPENAME", row["voucher_type"])
        _ensure_text(voucher, "EFFECTIVEDATE", row["tally_date"])
        _ensure_text(voucher, "HASCASHFLOW", "No")
        _ensure_text(voucher, "REFERENCE", row["stock_code"])
        _ensure_text(voucher, "PARTYLEDGERNAME", row["party_ledger"])

        if row["voucher_type"] == "Purchase":
            stock_amount = row["stock_amount"]
            stock_quantity = row["quantity"]
            stock_rate = row["price"]
            _append_ledger_entry(voucher, row["party_ledger"], "No", row["total_amount"], is_party_ledger="Yes")
            purchase_entry = _append_ledger_entry(voucher, "Equity Investment-Purchase", "Yes", -row["total_amount"], is_party_ledger="No")
            _append_inventory_allocation(purchase_entry, row["stock_code"], stock_quantity, -row["total_amount"], stock_rate, row["tally_date"])
            _validate_voucher_ledger_balance(voucher, row["voucher_type"])
        else:
            stock_amount = row["stock_amount"]
            stock_quantity = row["quantity"]
            stock_rate = row["price"]
            _append_sales_inventory_entry(voucher, row["stock_code"], stock_quantity, stock_amount, stock_rate, row["tally_date"])
            _append_ledger_entry(voucher, row["party_ledger"], "Yes", row["total_amount"], "Yes", "LEDGERENTRIES.LIST")
            _validate_voucher_ledger_balance(voucher, row["voucher_type"])

    return ET.tostring(envelope, encoding="utf-8", xml_declaration=True)


def build_trade_voucher_xml(rows: List[dict]) -> bytes:
    voucher_rows = []
    for row in rows:
        if row.get("status") != "Approved":
            continue
        if not row.get("stock_code"):
            raise ValueError("Each approved trade row requires a stock code")
        if not row.get("party_ledger"):
            raise ValueError("Each approved trade row requires a party ledger")

        quantity = row.get("quantity")
        price = row.get("price")
        total_amount = row.get("total_amount")
        if not isinstance(quantity, Decimal) or not isinstance(price, Decimal) or not isinstance(total_amount, Decimal):
            raise ValueError("Trade rows must use Decimal values")
        if quantity <= 0 or price <= 0 or total_amount <= 0:
            raise ValueError("Trade rows must have positive quantity, price and total")

        calculated_trade_value = (quantity * price).quantize(Decimal("0.01"))
        charges = (total_amount - calculated_trade_value).quantize(Decimal("0.01"))

        charge_posting_mode = row.get("charge_posting_mode", "separate")
        if charge_posting_mode == "include":
            stock_amount = total_amount
            party_value = total_amount
            charges_value = Decimal("0.00")
        else:
            stock_amount = calculated_trade_value
            party_value = total_amount - charges
            charges_value = charges

        voucher_type = "Purchase" if row["action"] == "Buy" else "Sales"
        voucher_rows.append({
            "voucher_type": voucher_type,
            "tally_date": row["tally_date"],
            "narration": row.get("narration") or f"{row['action']} {row['stock_code']}",
            "stock_code": row["stock_code"],
            "party_ledger": row.get("party_ledger") or "ICICI  Bank  Ltd -  Saving A/c",
            "charges_ledger": row.get("charges_ledger") or "Brokerage & Charges",
            "quantity": quantity,
            "price": price,
            "total_amount": total_amount,
            "stock_amount": stock_amount,
            "charges_value": charges_value,
            "party_value": party_value,
            "charge_posting_mode": charge_posting_mode,
        })

    if not voucher_rows:
        raise ValueError("No approved trade rows available for export")

    return _build_trade_envelope(voucher_rows)


def build_trade_stock_master_xml(stock_items: List[dict]) -> bytes:
    envelope = ET.Element("ENVELOPE")
    header = ET.SubElement(envelope, "HEADER")
    _ensure_text(header, "TALLYREQUEST", "Import Data")
    request_desc = ET.SubElement(header, "REQUESTDESC")
    _ensure_text(request_desc, "REPORTNAME", "Stock Items")
    static_variables = ET.SubElement(request_desc, "STATICVARIABLES")
    _ensure_text(static_variables, "SVCURRENTCOMPANY", TALLY_COMPANY_NAME)

    body = ET.SubElement(envelope, "BODY")
    import_data = ET.SubElement(body, "IMPORTDATA")
    request_data = ET.SubElement(import_data, "REQUESTDATA")

    for item in stock_items:
        message = ET.SubElement(request_data, "TALLYMESSAGE")
        stock_item = ET.SubElement(message, "STOCKITEM")
        _ensure_text(stock_item, "NAME", item["name"])
        _ensure_text(stock_item, "PARENT", item.get("group", STOCK_ITEM_GROUP))
        _ensure_text(stock_item, "BASEUNITS", STOCK_UNIT)
        _ensure_text(stock_item, "OPENINGBALANCE", "0")
        _ensure_text(stock_item, "OPENINGVALUE", "0.00")
        _ensure_text(stock_item, "GSTCLASS")
        _ensure_text(stock_item, "UNIT", STOCK_UNIT)
        _ensure_text(stock_item, "RATE", "0.00")
        _ensure_text(stock_item, "ISRATEINCLUSIVE", "No")
        _ensure_text(stock_item, "ISSERIALITEM", "No")
        _ensure_text(stock_item, "ISBATCHWISEON", "No")

    return ET.tostring(envelope, encoding="utf-8", xml_declaration=True)
