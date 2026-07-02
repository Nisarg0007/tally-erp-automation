from __future__ import annotations

from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Integer, String, Numeric
from sqlalchemy.orm import declarative_base

from database import Base


class TradeRow(Base):
    __tablename__ = "trade_rows"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, nullable=True)
    tally_date = Column(String, nullable=True)
    stock_code = Column(String, nullable=True)
    action = Column(String, nullable=True)
    quantity = Column(Numeric(12, 4), nullable=True)
    price = Column(Numeric(12, 4), nullable=True)
    total_amount = Column(Numeric(12, 4), nullable=True)
    calculated_trade_value = Column(Numeric(12, 4), nullable=True)
    charges = Column(Numeric(12, 4), nullable=True)
    party_ledger = Column(String, nullable=True)
    purchase_ledger = Column(String, nullable=True)
    sales_ledger = Column(String, nullable=True)
    charges_ledger = Column(String, nullable=True)
    narration = Column(String, nullable=True)
    status = Column(String, default="Pending")
    source = Column(String, nullable=True)
    include_charges_in_stock_value = Column(String, default="No")
    charge_posting_mode = Column(String, default="separate")
