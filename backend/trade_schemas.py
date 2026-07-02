from __future__ import annotations

from decimal import Decimal
from typing import List
from pydantic import BaseModel


class TradeRowCreate(BaseModel):
    date: str
    stock_code: str
    action: str
    quantity: Decimal
    price: Decimal
    total_amount: Decimal
    calculated_trade_value: Decimal
    charges: Decimal
    party_ledger: str | None = None
    purchase_ledger: str | None = None
    sales_ledger: str | None = None
    charges_ledger: str | None = None
    narration: str | None = None
    status: str | None = "Pending"
    source: str | None = None
    include_charges_in_stock_value: bool | None = False
    charge_posting_mode: str | None = "separate"


class TradeRowUpdate(BaseModel):
    date: str | None = None
    stock_code: str | None = None
    action: str | None = None
    quantity: Decimal | None = None
    price: Decimal | None = None
    total_amount: Decimal | None = None
    calculated_trade_value: Decimal | None = None
    charges: Decimal | None = None
    party_ledger: str | None = None
    purchase_ledger: str | None = None
    sales_ledger: str | None = None
    charges_ledger: str | None = None
    narration: str | None = None
    status: str | None = None
    include_charges_in_stock_value: bool | None = None
    charge_posting_mode: str | None = None


class TradeRowUpdateWithId(TradeRowUpdate):
    id: int


class BulkTradeRowUpdate(BaseModel):
    rows: List[TradeRowUpdateWithId]
