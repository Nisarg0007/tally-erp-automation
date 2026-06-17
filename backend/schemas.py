from typing import List
from pydantic import BaseModel


class TransactionUpdate(BaseModel):
    date: str | None = None
    amount: float | None = None
    voucher_type: str | None = None
    debit_ledger: str | None = None
    credit_ledger: str | None = None
    final_narration: str | None = None
    status: str | None = None


class TransactionUpdateWithId(TransactionUpdate):
    id: int


class TransactionCreate(BaseModel):
    date: str
    narration: str
    transaction_type: str | None = "Manual"
    amount: float
    balance: float = 0.0
    voucher_type: str | None = None
    debit_ledger: str | None = None
    credit_ledger: str | None = None
    final_narration: str | None = None
    status: str | None = "Pending"


class BulkTransactionUpdate(BaseModel):
    transactions: List[TransactionUpdateWithId]
