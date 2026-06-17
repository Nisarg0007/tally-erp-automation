from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Float

from database import Base


class Transaction(Base):

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    date = Column(String)
    narration = Column(String)

    transaction_type = Column(String)

    amount = Column(Float)
    balance = Column(Float)

    voucher_type = Column(String, nullable=True)

    debit_ledger = Column(String, nullable=True)

    credit_ledger = Column(String, nullable=True)

    final_narration = Column(String, nullable=True)

    status = Column(String, default="Pending")
    source = Column(String, nullable=True)


class Ledger(Base):

    __tablename__ = "ledgers"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, unique=True)

    group_name = Column(String)