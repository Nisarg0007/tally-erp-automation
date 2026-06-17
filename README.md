# 📊 Tally ERP Automation

### Bank Statement to Tally ERP 9 XML Converter

Tally ERP Automation is a local-first accounting application that transforms bank statement PDFs into **Tally ERP 9 importable XML vouchers**. It automates transaction extraction, ledger mapping, review workflows, and XML generation, significantly reducing manual bookkeeping effort.

---

## 🚀 Features

* 📄 Upload and parse bank statement PDFs
* 🧾 Review and edit extracted transactions
* 📚 Import ledger masters from Tally XML or Excel
* 🏷 Assign voucher types (Receipt, Payment, Contra, Journal)
* 🔍 Searchable ledger mapping interface
* 📦 Generate Tally ERP 9 compatible XML vouchers
* 📊 Export approved transactions to Excel
* ➕ Add manual accounting entries
* ⚡ Bulk approve and bulk update transactions
* 💾 Local SQLite database for offline usage

---

## 🏗 Workflow

```text
Upload Statement
      ↓
Import Ledgers
      ↓
Review Transactions
      ↓
Map Ledgers & Vouchers
      ↓
Generate XML
      ↓
Import into Tally ERP 9
```

---

## 🛠 Tech Stack

| Layer             | Technology                       |
| ----------------- | -------------------------------- |
| Frontend          | Next.js 16, React 19, TypeScript |
| Styling           | Tailwind CSS                     |
| Backend           | FastAPI, Python                  |
| Database          | SQLite, SQLAlchemy               |
| PDF Parsing       | pdfplumber                       |
| Excel Export      | openpyxl                         |
| API Communication | Axios                            |

---

## 🎯 Key Highlights

* Eliminates repetitive manual voucher entry
* Supports accountant review before export
* Generates Tally ERP 9 compatible XML format
* Local-first architecture with no cloud dependency
* Designed for accountants, bookkeepers, and finance teams
* Full-stack implementation using modern web technologies

---

## 📂 Project Structure

```text
tally-automation/
├── backend/
│   ├── app.py
│   ├── parser.py
│   ├── tally_import.py
│   ├── models.py
│   └── database.py
│
├── frontend/
│   ├── app/
│   ├── components/
│   └── public/
│
├── requirements.txt
├── start-app.bat
└── README.md
```

---

## 🛠 Installation

### 1️⃣ Clone the repository

```bash
git clone https://github.com/Nisarg0007/tally-erp-automation.git
cd tally-erp-automation
```

### 2️⃣ Install backend dependencies

```bash
pip install -r requirements.txt
```

### 3️⃣ Start Backend

```bash
cd backend
uvicorn app:app --reload
```

### 4️⃣ Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5️⃣ Open in Browser

```text
Frontend: http://localhost:3000
Backend: http://127.0.0.1:8000
```

---

## 🌟 Use Cases

* Chartered Accountants
* Tax Consultants
* Finance Teams
* Small Businesses
* Tally ERP 9 Users

---

## 👤 Creator

**Nisarg Gandhi**

Built to simplify accounting workflows through automation and modern web technologies.
