from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from io import BytesIO
from openpyxl import Workbook, load_workbook
from openpyxl.utils import get_column_letter
from typing import List
from uuid import uuid4
import xml.etree.ElementTree as ET
import os
import re
import shutil
from sqlalchemy import text

from database import Base, engine, SessionLocal
from models import Transaction, Ledger
from parser import parse_pdf_statement
from schemas import TransactionCreate, TransactionUpdate, TransactionUpdateWithId, BulkTransactionUpdate
from tally_import import read_ledgers

Base.metadata.create_all(bind=engine)


def ensure_transaction_source_column():
    if engine.dialect.name == "sqlite":
        with engine.begin() as conn:
            result = conn.execute(text("PRAGMA table_info(transactions);"))
            columns = [row[1] for row in result]
            if "source" not in columns:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN source VARCHAR"))


ensure_transaction_source_column()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
TALLY_COMPANY_NAME = os.getenv("TALLY_COMPANY_NAME", "AMIT NIKUNJ GANDHI")

os.makedirs(UPLOAD_DIR, exist_ok=True)


VOUCHER_TYPES = ["Receipt", "Payment", "Contra", "Journal"]
STATUS_OPTIONS = ["Pending", "Approved", "Exported"]


def parse_exported_xml(file_path: str) -> List[dict]:
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        transactions = []
        
        for message in root.findall(".//TALLYMESSAGE"):
            voucher = message.find("VOUCHER")
            if voucher is None:
                continue
            
            date_elem = voucher.find("DATE")
            narration_elem = voucher.find("NARRATION")
            vouchertypename_elem = voucher.find("VOUCHERTYPENAME")
            
            date_str = date_elem.text if date_elem is not None else ""
            narration = narration_elem.text if narration_elem is not None else ""
            voucher_type = vouchertypename_elem.text if vouchertypename_elem is not None else "Journal"
            
            entries = voucher.findall("ALLLEDGERENTRIES.LIST")
            debit_ledger = None
            credit_ledger = None
            amount = 0.0
            
            for entry in entries:
                ledger_name_elem = entry.find("LEDGERNAME")
                amount_elem = entry.find("AMOUNT")
                is_deemed_elem = entry.find("ISDEEMEDPOSITIVE")
                
                ledger_name = ledger_name_elem.text if ledger_name_elem is not None else ""
                amount_str = amount_elem.text if amount_elem is not None else "0.00"
                is_deemed = is_deemed_elem.text if is_deemed_elem is not None else "Yes"
                
                try:
                    amount_val = float(amount_str)
                except (ValueError, TypeError):
                    amount_val = 0.0
                
                if is_deemed == "No":
                    debit_ledger = ledger_name
                    amount = abs(amount_val)
                elif is_deemed == "Yes":
                    credit_ledger = ledger_name
            
            if date_str:
                transactions.append({
                    "date": convert_tally_date_to_readable(date_str),
                    "narration": narration,
                    "transaction_type": "deposit" if amount > 0 else "withdrawal" if amount < 0 else "unknown",
                    "amount": amount,
                    "balance": 0,
                    "voucher_type": voucher_type,
                    "debit_ledger": debit_ledger,
                    "credit_ledger": credit_ledger,
                    "final_narration": None,
                })
        
        return transactions
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"XML parsing error: {str(exc)}")


def convert_tally_date_to_readable(date_str: str) -> str:
    date_str = date_str.strip()
    if len(date_str) == 8 and date_str.isdigit():
        year = date_str[0:4]
        month = date_str[4:6]
        day = date_str[6:8]
        return f"{day}-{month}-{year}"
    return date_str


def normalize_date_for_tally(date_string: str) -> str:
    date_string = date_string.strip()
    match = re.match(r"^(\d{2})[\-/](\d{2})[\-/](\d{4})$", date_string)
    if match:
        day, month, year = match.groups()
        return f"{year}{month}{day}"

    match = re.match(r"^(\d{4})[\-/](\d{2})[\-/](\d{2})$", date_string)
    if match:
        year, month, day = match.groups()
        return f"{year}{month}{day}"

    match = re.match(r"^(\d{8})$", date_string)
    if match:
        year = date_string[0:4]
        month = date_string[4:6]
        day = date_string[6:8]
        return f"{year}{month}{day}"

    digits = re.findall(r"\d+", date_string)
    if len(digits) >= 3:
        day, month, year = digits[:3]
        if len(year) == 4:
            return f"{year}{month.zfill(2)}{day.zfill(2)}"

    return ""


def build_tally_xml(transactions: List[Transaction]) -> bytes:
    envelope = ET.Element("ENVELOPE")
    header = ET.SubElement(envelope, "HEADER")
    ET.SubElement(header, "TALLYREQUEST").text = "Import Data"
    request_desc = ET.SubElement(header, "REQUESTDESC")
    ET.SubElement(request_desc, "REPORTNAME").text = "Vouchers"
    static_variables = ET.SubElement(request_desc, "STATICVARIABLES")
    ET.SubElement(static_variables, "SVCURRENTCOMPANY").text = TALLY_COMPANY_NAME

    body = ET.SubElement(envelope, "BODY")
    import_data = ET.SubElement(body, "IMPORTDATA")
    request_data = ET.SubElement(import_data, "REQUESTDATA")

    for transaction in transactions:
        message = ET.SubElement(request_data, "TALLYMESSAGE")
        message.attrib["xmlns:UDF"] = "TallyUDF"

        voucher_type = transaction.voucher_type or "Journal"
        voucher = ET.SubElement(
            message,
            "VOUCHER",
            {
                "VCHTYPE": voucher_type,
                "ACTION": "Create",
            },
        )

        ET.SubElement(voucher, "DATE").text = normalize_date_for_tally(transaction.date)
        ET.SubElement(voucher, "GUID").text = str(uuid4())
        ET.SubElement(voucher, "NARRATION").text = (
            transaction.final_narration or transaction.narration or ""
        )
        ET.SubElement(voucher, "VOUCHERTYPENAME").text = voucher_type
        ET.SubElement(voucher, "EFFECTIVEDATE").text = normalize_date_for_tally(transaction.date)

        debit_entry = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(debit_entry, "LEDGERNAME").text = transaction.debit_ledger or ""
        ET.SubElement(debit_entry, "ISDEEMEDPOSITIVE").text = "No"
        ET.SubElement(debit_entry, "AMOUNT").text = f"{(transaction.amount or 0.0):.2f}"

        credit_entry = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(credit_entry, "LEDGERNAME").text = transaction.credit_ledger or ""
        ET.SubElement(credit_entry, "ISDEEMEDPOSITIVE").text = "Yes"
        ET.SubElement(credit_entry, "AMOUNT").text = f"{(-(transaction.amount or 0.0)):.2f}"

    return ET.tostring(envelope, encoding="utf-8", xml_declaration=True)


def build_transaction_workbook(transactions: List[Transaction]) -> BytesIO:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Approved Transactions"

    headers = [
        "Date",
        "Original Narration",
        "Final Narration",
        "Amount",
        "Voucher Type",
        "Debit Ledger",
        "Credit Ledger",
        "Status",
    ]
    worksheet.append(headers)

    for tx in transactions:
        worksheet.append([
            tx.date,
            tx.narration,
            tx.final_narration or tx.narration,
            tx.amount,
            tx.voucher_type or "",
            tx.debit_ledger or "",
            tx.credit_ledger or "",
            tx.status or "",
        ])

    for index in range(1, len(headers) + 1):
        worksheet.column_dimensions[get_column_letter(index)].width = 26

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return output


def parse_ledgers_from_excel(file_path: str) -> List[dict]:
    workbook = load_workbook(file_path, data_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []

    header = [str(cell).strip().lower() if cell else "" for cell in rows[0]]
    name_index = None
    group_index = None

    for index, value in enumerate(header):
        if value in ["name", "ledger", "ledger name", "ledgername"]:
            name_index = index
        if value in ["group", "group_name", "group name", "parent"]:
            group_index = index

    if name_index is None:
        name_index = 0

    ledgers = []
    for row in rows[1:]:
        if not row or not row[name_index]:
            continue
        name = str(row[name_index]).strip()
        group_name = ""
        if group_index is not None and len(row) > group_index and row[group_index]:
            group_name = str(row[group_index]).strip()
        ledgers.append({"name": name, "group_name": group_name})

    return ledgers


def save_ledger_records(db, ledgers: List[dict]) -> int:
    imported = 0
    for ledger_data in ledgers:
        if not ledger_data["name"]:
            continue
        existing = db.query(Ledger).filter(Ledger.name == ledger_data["name"]).first()
        if existing:
            if ledger_data["group_name"]:
                existing.group_name = ledger_data["group_name"]
        else:
            db.add(
                Ledger(name=ledger_data["name"], group_name=ledger_data["group_name"])
            )
            imported += 1
    return imported


def build_transaction_payload(transaction: Transaction) -> dict:
    return {
        "id": transaction.id,
        "date": transaction.date,
        "narration": transaction.narration,
        "transaction_type": transaction.transaction_type,
        "amount": transaction.amount,
        "balance": transaction.balance,
        "voucher_type": transaction.voucher_type,
        "debit_ledger": transaction.debit_ledger,
        "credit_ledger": transaction.credit_ledger,
        "final_narration": transaction.final_narration,
        "status": transaction.status,
        "source": transaction.source,
    }


@app.get("/")
def home():
    return {"status": "running"}


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if file.filename.lower().endswith(".xml"):
        transactions = parse_exported_xml(file_path)
    elif file.filename.lower().endswith(".pdf"):
        transactions = parse_pdf_statement(file_path)
    else:
        raise HTTPException(status_code=400, detail="File must be PDF or XML")

    db = SessionLocal()

    try:
        db.query(Transaction).delete()
        for tx in transactions:
            db_transaction = Transaction(
                date=tx["date"],
                narration=tx["narration"],
                transaction_type=tx["transaction_type"],
                amount=tx["amount"],
                balance=tx.get("balance", 0),
                voucher_type=tx.get("voucher_type"),
                debit_ledger=tx.get("debit_ledger"),
                credit_ledger=tx.get("credit_ledger"),
                final_narration=tx.get("final_narration"),
                source="pdf" if file.filename.lower().endswith(".pdf") else "xml",
            )
            db.add(db_transaction)
        db.commit()
        return {"success": True, "count": len(transactions)}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@app.get("/transactions")
def get_transactions():
    db = SessionLocal()
    try:
        transactions = db.query(Transaction).order_by(Transaction.id).all()
        return [build_transaction_payload(tx) for tx in transactions]
    finally:
        db.close()


@app.put("/transactions/bulk")
def bulk_update_transactions(data: BulkTransactionUpdate):
    db = SessionLocal()
    try:
        updated = 0
        for item in data.transactions:
            transaction = db.query(Transaction).filter(Transaction.id == item.id).first()
            if not transaction:
                continue
            if item.date is not None:
                transaction.date = item.date
            if item.amount is not None:
                transaction.amount = item.amount
            if item.voucher_type is not None:
                transaction.voucher_type = item.voucher_type
            if item.debit_ledger is not None:
                transaction.debit_ledger = item.debit_ledger
            if item.credit_ledger is not None:
                transaction.credit_ledger = item.credit_ledger
            if item.final_narration is not None:
                transaction.final_narration = item.final_narration
            if item.status is not None:
                transaction.status = item.status
            updated += 1
        db.commit()
        return {"success": True, "updated": updated}
    finally:
        db.close()


@app.get("/transactions/{transaction_id}")
def get_transaction(transaction_id: int):
    db = SessionLocal()
    try:
        transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return build_transaction_payload(transaction)
    finally:
        db.close()


@app.put("/transactions/{transaction_id}")
def update_transaction(transaction_id: int, data: TransactionUpdate):
    db = SessionLocal()
    try:
        transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")

        if data.voucher_type is not None:
            transaction.voucher_type = data.voucher_type
        if data.debit_ledger is not None:
            transaction.debit_ledger = data.debit_ledger
        if data.credit_ledger is not None:
            transaction.credit_ledger = data.credit_ledger
        if data.final_narration is not None:
            transaction.final_narration = data.final_narration
        if data.status is not None:
            transaction.status = data.status

        db.commit()
        return {"success": True}
    finally:
        db.close()


@app.post("/transactions")
def create_transaction(data: TransactionCreate):
    db = SessionLocal()
    try:
        transaction = Transaction(
            date=data.date,
            narration=data.narration,
            transaction_type=data.transaction_type or "Manual",
            amount=data.amount,
            balance=data.balance,
            voucher_type=data.voucher_type,
            debit_ledger=data.debit_ledger,
            credit_ledger=data.credit_ledger,
            final_narration=data.final_narration,
            status=data.status or "Pending",
            source="manual",
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        return {"success": True, "transaction": build_transaction_payload(transaction)}
    finally:
        db.close()


@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int):
    db = SessionLocal()
    try:
        transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        db.delete(transaction)
        db.commit()
        return {"success": True}
    finally:
        db.close()


@app.delete("/transactions")
def clear_transactions():
    db = SessionLocal()
    try:
        db.query(Transaction).delete()
        db.commit()
        return {"success": True}
    finally:
        db.close()


@app.get("/ledgers")
def get_ledgers():
    db = SessionLocal()
    try:
        ledgers = db.query(Ledger).order_by(Ledger.name).all()
        return [{"id": ledger.id, "name": ledger.name, "group_name": ledger.group_name} for ledger in ledgers]
    finally:
        db.close()


@app.post("/import-ledgers")
async def import_ledgers(file: UploadFile = File(...)):
    filename = file.filename.lower()
    if not filename.endswith(".xml") and not filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="File type must be .xml or .xlsx")

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        if filename.endswith(".xml"):
            ledger_rows = read_ledgers(file_path)
        else:
            ledger_rows = parse_ledgers_from_excel(file_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not ledger_rows:
        raise HTTPException(status_code=400, detail="No ledgers found in file")

    db = SessionLocal()
    try:
        imported = save_ledger_records(db, ledger_rows)
        db.commit()
        return {"success": True, "imported": imported, "total": len(ledger_rows)}
    finally:
        db.close()


@app.get("/stats")
def get_stats():
    db = SessionLocal()
    try:
        total = db.query(Transaction).count()
        pending = db.query(Transaction).filter(Transaction.status == "Pending").count()
        approved = db.query(Transaction).filter(Transaction.status == "Approved").count()
        exported = db.query(Transaction).filter(Transaction.status == "Exported").count()
        return {"total": total, "pending": pending, "approved": approved, "exported": exported}
    finally:
        db.close()


@app.get("/export/tally-xml")
def export_tally_xml():
    db = SessionLocal()
    try:
        transactions = db.query(Transaction).filter(Transaction.status == "Approved").order_by(Transaction.id).all()
        if not transactions:
            raise HTTPException(status_code=404, detail="No approved transactions available for export")

        payload = build_tally_xml(transactions)
        return StreamingResponse(
            BytesIO(payload),
            media_type="application/xml",
            headers={"Content-Disposition": "attachment; filename=tally_vouchers.xml"},
        )
    finally:
        db.close()


@app.get("/export/transactions.xlsx")
def export_transactions_xlsx():
    db = SessionLocal()
    try:
        transactions = db.query(Transaction).filter(Transaction.status == "Approved").order_by(Transaction.id).all()
        if not transactions:
            raise HTTPException(status_code=404, detail="No approved transactions available for export")

        workbook = build_transaction_workbook(transactions)
        return StreamingResponse(
            workbook,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=approved_transactions.xlsx"},
        )
    finally:
        db.close()

        db.close()