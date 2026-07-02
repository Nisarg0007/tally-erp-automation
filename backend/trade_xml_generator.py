from __future__ import annotations

import os
import uuid
import xml.etree.ElementTree as ET
from decimal import Decimal, ROUND_HALF_UP
from typing import List


TALLY_COMPANY_NAME = os.getenv("TALLY_COMPANY_NAME", "AMIT NIKUNJ GANDHI")
STOCK_ITEM_GROUP = os.getenv("TRADE_STOCK_ITEM_GROUP", "Equity Shares")
STOCK_UNIT = "Nos"
GODOWN_NAME = "Main Location"
BATCH_NAME = "Primary Batch"

PURCHASE_LEDGER = os.getenv(
    "TRADE_PURCHASE_LEDGER",
    "Equity Investment-Purchase",
)

SALES_LEDGER = os.getenv(
    "TRADE_SALES_LEDGER",
    "Equity Investment-Sales",
)


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _format_decimal(value: Decimal) -> str:
    return format(_quantize_money(value), ".2f")


def _format_quantity(quantity: Decimal, negative: bool = False) -> str:
    normalized = quantity.normalize()

    if normalized == normalized.to_integral():
        quantity_text = str(int(normalized))
    else:
        quantity_text = format(normalized, "f")

    prefix = "-" if negative else " "
    return f"{prefix}{quantity_text} {STOCK_UNIT}"


def _format_rate(rate: Decimal) -> str:
    return f"{_format_decimal(rate)}/{STOCK_UNIT}"


def _ensure_text(element: ET.Element, tag_name: str, value: str) -> ET.Element:
    child = ET.SubElement(element, tag_name)
    child.text = value
    return child


def _append_ledger_entry(
    parent: ET.Element,
    ledger_name: str,
    is_deemed_positive: str,
    amount: Decimal,
    is_party_ledger: str = "No",
    tag_name: str = "ALLLEDGERENTRIES.LIST",
) -> ET.Element:
    entry = ET.SubElement(parent, tag_name)

    _ensure_text(entry, "LEDGERNAME", ledger_name)
    _ensure_text(entry, "GSTCLASS", "")
    _ensure_text(entry, "ISDEEMEDPOSITIVE", is_deemed_positive)
    _ensure_text(entry, "LEDGERFROMITEM", "No")
    _ensure_text(entry, "REMOVEZEROENTRIES", "No")
    _ensure_text(entry, "ISPARTYLEDGER", is_party_ledger)
    _ensure_text(entry, "AMOUNT", _format_decimal(amount))

    return entry


def _append_purchase_inventory_allocation(
    parent: ET.Element,
    stock_code: str,
    quantity: Decimal,
    amount: Decimal,
    rate: Decimal,
    tally_date: str,
) -> ET.Element:
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


def _append_sales_inventory_entry(
    parent: ET.Element,
    stock_code: str,
    quantity: Decimal,
    amount: Decimal,
    rate: Decimal,
    tally_date: str,
    sales_ledger: str,
) -> ET.Element:
    """
    Match the manually exported Tally Sales Invoice format:
    - ALLINVENTORYENTRIES.LIST directly under VOUCHER
    - positive inventory/accounting amounts
    - normal positive quantity
    """
    entry = ET.SubElement(parent, "ALLINVENTORYENTRIES.LIST")

    _ensure_text(entry, "STOCKITEMNAME", stock_code)
    _ensure_text(entry, "ISDEEMEDPOSITIVE", "No")
    _ensure_text(entry, "ISAUTONEGATE", "No")
    _ensure_text(entry, "RATE", _format_rate(rate))
    _ensure_text(entry, "AMOUNT", _format_decimal(amount))
    _ensure_text(entry, "ACTUALQTY", _format_quantity(quantity))
    _ensure_text(entry, "BILLEDQTY", _format_quantity(quantity))

    accounting = ET.SubElement(entry, "ACCOUNTINGALLOCATIONS.LIST")
    _ensure_text(accounting, "LEDGERNAME", sales_ledger)
    _ensure_text(accounting, "GSTCLASS", "")
    _ensure_text(accounting, "ISDEEMEDPOSITIVE", "No")
    _ensure_text(accounting, "LEDGERFROMITEM", "No")
    _ensure_text(accounting, "REMOVEZEROENTRIES", "No")
    _ensure_text(accounting, "ISPARTYLEDGER", "No")
    _ensure_text(accounting, "AMOUNT", _format_decimal(amount))

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

def _validate_voucher_ledger_balance(
    voucher: ET.Element,
    voucher_type: str,
) -> None:
    total = Decimal("0.00")

    if voucher_type == "Sales":
        for entry in voucher.findall("LEDGERENTRIES.LIST"):
            amount_text = entry.findtext("AMOUNT")
            if amount_text:
                total += Decimal(amount_text)

        for inventory in voucher.findall("ALLINVENTORYENTRIES.LIST"):
            accounting = inventory.find("ACCOUNTINGALLOCATIONS.LIST")
            if accounting is not None:
                amount_text = accounting.findtext("AMOUNT")
                if amount_text:
                    total += Decimal(amount_text)
    else:
        for entry in voucher.findall("ALLLEDGERENTRIES.LIST"):
            amount_text = entry.findtext("AMOUNT")
            if amount_text:
                total += Decimal(amount_text)

    if _quantize_money(total) != Decimal("0.00"):
        raise ValueError(
            f"{voucher_type} voucher ledger amounts must balance to zero, got {total}"
        )

def _build_trade_envelope(vouchers: List[dict]) -> bytes:
    envelope = ET.Element("ENVELOPE")

    header = ET.SubElement(envelope, "HEADER")
    _ensure_text(header, "TALLYREQUEST", "Import Data")

    body = ET.SubElement(envelope, "BODY")
    import_data = ET.SubElement(body, "IMPORTDATA")

    request_desc = ET.SubElement(import_data, "REQUESTDESC")
    _ensure_text(request_desc, "REPORTNAME", "Vouchers")

    static_variables = ET.SubElement(request_desc, "STATICVARIABLES")
    _ensure_text(static_variables, "SVCURRENTCOMPANY", TALLY_COMPANY_NAME)

    request_data = ET.SubElement(import_data, "REQUESTDATA")

    for row in vouchers:
        message = ET.SubElement(request_data, "TALLYMESSAGE")
        message.attrib["xmlns:UDF"] = "TallyUDF"

        voucher = ET.SubElement(
            message,
            "VOUCHER",
            {
                "VCHTYPE": row["voucher_type"],
                "ACTION": "Create",
            },
        )

        _ensure_text(voucher, "DATE", row["tally_date"])
        _ensure_text(voucher, "GUID", str(uuid.uuid4()))
        _ensure_text(voucher, "NARRATION", row["narration"])
        _ensure_text(voucher, "VOUCHERTYPENAME", row["voucher_type"])
        _ensure_text(voucher, "EFFECTIVEDATE", row["tally_date"])
        _ensure_text(voucher, "HASCASHFLOW", "Yes")
        _ensure_text(voucher, "ISINVOICE", "Yes")
        _ensure_text(voucher, "REFERENCE", row["stock_code"])
        _ensure_text(voucher, "PARTYLEDGERNAME", row["party_ledger"])

        if row["voucher_type"] == "Purchase":
            # Bank / party: positive
            # Purchase ledger: negative
            # Purchase inventory: negative
            _append_ledger_entry(
                voucher,
                row["party_ledger"],
                "No",
                row["voucher_amount"],
                is_party_ledger="Yes",
            )

            purchase_entry = _append_ledger_entry(
                voucher,
                row["purchase_ledger"],
                "Yes",
                -row["voucher_amount"],
                is_party_ledger="No",
            )

            _append_purchase_inventory_allocation(
                purchase_entry,
                row["stock_code"],
                row["quantity"],
                -row["voucher_amount"],
                row["price"],
                row["tally_date"],
            )

        elif row["voucher_type"] == "Sales":
            # Match manual Sales Invoice XML:
            # Bank / party ledger: negative amount in LEDGERENTRIES.LIST
            # Sales ledger: positive amount inside ACCOUNTINGALLOCATIONS.LIST
            _append_ledger_entry(
                voucher,
                row["party_ledger"],
                "Yes",
                -row["voucher_amount"],
                is_party_ledger="Yes",
                tag_name="LEDGERENTRIES.LIST",
            )

            _append_sales_inventory_entry(
                voucher,
                row["stock_code"],
                row["quantity"],
                row["voucher_amount"],
                row["price"],
                row["tally_date"],
                row["sales_ledger"],
            )

        else:
            raise ValueError(
                f"Unsupported trade voucher type: {row['voucher_type']}"
            )

        _validate_voucher_ledger_balance(voucher, row["voucher_type"])

    return ET.tostring(
        envelope,
        encoding="utf-8",
        xml_declaration=True,
    )


def build_trade_voucher_xml(rows: List[dict]) -> bytes:
    voucher_rows = []

    for row in rows:
        if row.get("status") != "Approved":
            continue

        stock_code = (row.get("stock_code") or "").strip()
        party_ledger = (row.get("party_ledger") or "").strip()
        action = (row.get("action") or "").strip()

        if not stock_code:
            raise ValueError("Each approved trade row requires a stock code")

        if not party_ledger:
            raise ValueError("Each approved trade row requires a party ledger")

        if action not in {"Buy", "Sell"}:
            raise ValueError(
                f"Trade action must be Buy or Sell, got: {action}"
            )

        quantity = row.get("quantity")
        price = row.get("price")
        total_amount = row.get("total_amount")

        if not isinstance(quantity, Decimal):
            raise ValueError("Trade quantity must be a Decimal")

        if not isinstance(price, Decimal):
            raise ValueError("Trade price must be a Decimal")

        if not isinstance(total_amount, Decimal):
            raise ValueError("Trade total amount must be a Decimal")

        quantity = quantity.quantize(Decimal("0.001"))
        price = _quantize_money(price)
        total_amount = _quantize_money(total_amount)

        if quantity <= 0 or price <= 0 or total_amount <= 0:
            raise ValueError(
                "Trade quantity, price and total amount must be greater than zero"
            )

        # Total includes brokerage/charges. This first stable version includes
        # those charges in stock value so the voucher matches the trade book.
        voucher_amount = total_amount

        voucher_rows.append(
            {
                "voucher_type": "Purchase" if action == "Buy" else "Sales",
                "tally_date": row["tally_date"],
                "narration": (
                    row.get("narration")
                    or f"{action} {stock_code} Qty {quantity} @ {price}"
                ),
                "stock_code": stock_code,
                "party_ledger": party_ledger,
                "purchase_ledger": row.get("purchase_ledger") or PURCHASE_LEDGER,
                "sales_ledger": row.get("sales_ledger") or SALES_LEDGER,
                "quantity": quantity,
                "price": price,
                "voucher_amount": voucher_amount,
            }
        )

    if not voucher_rows:
        raise ValueError("No approved trade rows available for export")

    return _build_trade_envelope(voucher_rows)


def build_trade_stock_master_xml(stock_items: List[dict]) -> bytes:
    envelope = ET.Element("ENVELOPE")

    header = ET.SubElement(envelope, "HEADER")
    _ensure_text(header, "TALLYREQUEST", "Import Data")

    body = ET.SubElement(envelope, "BODY")
    import_data = ET.SubElement(body, "IMPORTDATA")

    request_desc = ET.SubElement(import_data, "REQUESTDESC")
    _ensure_text(request_desc, "REPORTNAME", "All Masters")

    static_variables = ET.SubElement(request_desc, "STATICVARIABLES")
    _ensure_text(static_variables, "SVCURRENTCOMPANY", TALLY_COMPANY_NAME)

    request_data = ET.SubElement(import_data, "REQUESTDATA")

    for item in stock_items:
        item_name = (item.get("name") or "").strip()

        if not item_name:
            continue

        message = ET.SubElement(request_data, "TALLYMESSAGE")
        message.attrib["xmlns:UDF"] = "TallyUDF"

        stock_item = ET.SubElement(
            message,
            "STOCKITEM",
            {"NAME": item_name, "ACTION": "Create"},
        )

        _ensure_text(stock_item, "NAME", item_name)
        _ensure_text(
            stock_item,
            "PARENT",
            item.get("group") or STOCK_ITEM_GROUP,
        )
        _ensure_text(stock_item, "BASEUNITS", STOCK_UNIT)
        _ensure_text(stock_item, "OPENINGBALANCE", "0")
        _ensure_text(stock_item, "OPENINGVALUE", "0.00")
        _ensure_text(stock_item, "GSTCLASS", "")
        _ensure_text(stock_item, "ISRATEINCLUSIVE", "No")
        _ensure_text(stock_item, "ISSERIALITEM", "No")
        _ensure_text(stock_item, "ISBATCHWISEON", "No")

    return ET.tostring(
        envelope,
        encoding="utf-8",
        xml_declaration=True,
    )