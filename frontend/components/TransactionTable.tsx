"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";

import { Ledger } from "@/types/ledger";
import { API_BASE_URL } from "@/lib/api";
import { Transaction } from "@/types/transaction";

interface Props {
  transactions: Transaction[];
  ledgers: Ledger[];
  onTransactionsUpdated: (transactions: Transaction[]) => void;
}

const VOUCHER_OPTIONS = ["Receipt", "Payment", "Contra", "Journal"];
const STATUS_OPTIONS = ["Pending", "Approved"];

type ToastType = "success" | "error" | "info";

interface ToastState {
  message: string;
  type: ToastType;
}

function transactionTypeLabel(type: string | null | undefined) {
  switch (type?.toLowerCase()) {
    case "deposit":
      return "Deposit";
    case "withdrawal":
      return "Withdrawal";
    case "manual":
      return "Manual";
    default:
      return "Unknown";
  }
}

function transactionTypeClass(type: string | null | undefined) {
  switch (type?.toLowerCase()) {
    case "deposit":
      return "bg-emerald-100 text-emerald-800";
    case "withdrawal":
      return "bg-rose-100 text-rose-800";
    case "manual":
      return "bg-indigo-100 text-indigo-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function applyBankAccountLedger(rows: Transaction[], accountLedger: string): Transaction[] {
  const trimmed = accountLedger.trim();
  if (!trimmed) {
    return rows;
  }

  return rows.map((row) => {
    const type = row.transaction_type?.toLowerCase();

    if (type === "deposit") {
      return { ...row, debit_ledger: trimmed };
    }

    if (type === "withdrawal") {
      return { ...row, credit_ledger: trimmed };
    }

    return row;
  });
}

export default function TransactionTable({ transactions, ledgers, onTransactionsUpdated }: Props) {
  const [rows, setRows] = useState<Transaction[]>(
    transactions.map((row) => ({ ...row, status: row.status ?? "Pending" }))
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [bankAccountLedger, setBankAccountLedger] = useState("");
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!showDeleteAllConfirm) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDeleteAllConfirm(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showDeleteAllConfirm]);

  const ledgerNames = useMemo(() => ledgers.map((ledger) => ledger.name), [ledgers]);
  const approvedCount = useMemo(
    () => rows.filter((row) => row.status === "Approved").length,
    [rows]
  );
  const hasPendingRows = useMemo(
    () => rows.some((row) => row.status !== "Approved"),
    [rows]
  );

  useEffect(() => {
    setRows(transactions.map((row) => ({ ...row, status: row.status ?? "Pending" })));
  }, [transactions]);

  const updateRow = (id: number, field: keyof Transaction, value: string | number | null) => {
    const parsedValue = field === "amount"
      ? value === "" || value === null
        ? null
        : typeof value === "string"
        ? parseFloat(value)
        : value
      : value;

    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: parsedValue } : row
      )
    );
  };

  const formatDateValue = (date: string | null | undefined) => {
    if (!date) {
      return "";
    }

    const trimmed = date.trim();
    if (!trimmed) {
      return "";
    }

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}-${month}-${year}`;
    }

    const dmyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmyMatch) {
      return trimmed;
    }

    const dmySlashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmySlashMatch) {
      const [, day, month, year] = dmySlashMatch;
      return `${day}-${month}-${year}`;
    }

    const ymdSlashMatch = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (ymdSlashMatch) {
      const [, year, month, day] = ymdSlashMatch;
      return `${day}-${month}-${year}`;
    }

    return trimmed;
  };

  const normalizeDateForInput = (date: string | null | undefined) => formatDateValue(date);

  const formatAmount = (amount: string | number | null | undefined) => {
    if (amount === null || amount === undefined || amount === "") {
      return null;
    }
    return typeof amount === "string" ? parseFloat(amount) : amount;
  };

  const applyBankLedger = () => {
    const trimmed = bankAccountLedger.trim();
    if (!trimmed) {
      showToast("Select or type the bank account ledger first.", "error");
      return;
    }

    const nextRows = applyBankAccountLedger(rows, trimmed);
    const depositCount = nextRows.filter((row) => row.transaction_type?.toLowerCase() === "deposit").length;
    const withdrawalCount = nextRows.filter(
      (row) => row.transaction_type?.toLowerCase() === "withdrawal"
    ).length;

    setRows(nextRows);
    onTransactionsUpdated(nextRows);
    showToast(
      `Applied "${trimmed}" — debit on ${depositCount} deposit(s), credit on ${withdrawalCount} withdrawal(s). Fill the other ledger for each row, then Save All.`,
      "success"
    );
  };

  const deleteRow = async (id: number) => {
    setSaving(true);
    setToast(null);

    try {
      await axios.delete(`${API_BASE_URL}/transactions/${id}`);
      const nextRows = rows.filter((row) => row.id !== id);
      setRows(nextRows);
      onTransactionsUpdated(nextRows);
      showToast("Transaction deleted.", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to delete transaction. Try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteAll = async () => {
    setShowDeleteAllConfirm(false);
    setSaving(true);
    setToast(null);

    try {
      await axios.delete(`${API_BASE_URL}/transactions`);
      setRows([]);
      onTransactionsUpdated([]);
      showToast("All transactions deleted.", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to delete all transactions. Try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const createTransaction = async () => {
    setSaving(true);
    setToast(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/transactions`, {
        date: "",
        narration: "",
        transaction_type: "Manual",
        amount: 0,
        balance: 0,
        voucher_type: null,
        debit_ledger: null,
        credit_ledger: null,
        final_narration: null,
        status: "Pending",
      });
      if (response.data?.success && response.data.transaction) {
        const nextRows = [...rows, response.data.transaction];
        setRows(nextRows);
        onTransactionsUpdated(nextRows);
        showToast("Manual transaction added.", "success");
      } else {
        showToast("Unable to add manual transaction.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to create manual transaction. Check backend.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveSelected = async (forceStatus?: string) => {
    setSaving(true);
    setToast(null);

    const payloadRows = rows.map((row) => ({
      ...row,
      amount: formatAmount(row.amount),
      status: forceStatus ?? row.status ?? "Pending",
    }));

    try {
      const response = await axios.put(`${API_BASE_URL}/transactions/bulk`, {
        transactions: payloadRows.map((row) => ({
          id: row.id,
          date: row.date,
          amount: row.amount,
          voucher_type: row.voucher_type,
          debit_ledger: row.debit_ledger,
          credit_ledger: row.credit_ledger,
          final_narration: row.final_narration,
          status: row.status,
        })),
      });

      if (response.data?.success) {
        setRows(payloadRows);
        onTransactionsUpdated(payloadRows);
        showToast(
          forceStatus === "Approved"
            ? `${response.data.updated} transactions approved and saved.`
            : `${response.data.updated} transactions saved.`,
          "success"
        );
      } else {
        showToast("Unable to save transactions.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to save transactions. Check the backend and try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Transaction Review</h2>
            <p className="mt-2 text-sm text-slate-500">
              Search ledger names as you type, then save all rows at once when ready.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{rows.length} rows</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{ledgerNames.length} ledgers</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">{approvedCount} approved</span>
            <button
              type="button"
              disabled={saving || !hasPendingRows}
              onClick={() => saveSelected("Approved")}
              className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Approve all"}
            </button>
            <button
              type="button"
              disabled={saving || rows.length === 0}
              onClick={() => setShowDeleteAllConfirm(true)}
              className="rounded-2xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Working..." : "Delete all"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => saveSelected()}
              className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      </div>

      {showDeleteAllConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setShowDeleteAllConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-all-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="delete-all-title" className="text-lg font-semibold text-slate-900">
                  Delete all transactions?
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This will permanently remove all {rows.length} transaction{rows.length === 1 ? "" : "s"} from
                  review. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteAllConfirm(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAll}
                className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div
            className={`pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border px-4 py-4 shadow-xl backdrop-blur-sm ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-900"
                : toast.type === "error"
                ? "border-rose-200 bg-rose-50/95 text-rose-900"
                : "border-slate-200 bg-white/95 text-slate-900"
            }`}
            role="status"
          >
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                toast.type === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : toast.type === "error"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {toast.type === "success" ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
              ) : toast.type === "error" ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
                </svg>
              )}
            </div>
            <p className="flex-1 pt-1 text-sm font-medium leading-6">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-lg p-1 text-current/60 transition hover:bg-black/5 hover:text-current"
              aria-label="Dismiss notification"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="rounded-[2rem] border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">Bank account</p>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">Which ledger is this statement for?</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Pick your bank account from Tally. Deposits will auto-fill as <strong>debit</strong>; withdrawals as{" "}
          <strong>credit</strong>. You only need to assign the other ledger on each row.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="bank-account-ledger">
              Bank account ledger
            </label>
            <input
              id="bank-account-ledger"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              placeholder="Search or type ledger name..."
              value={bankAccountLedger}
              onChange={(e) => setBankAccountLedger(e.target.value)}
              list="ledger-options"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            disabled={saving || rows.length === 0 || !bankAccountLedger.trim()}
            onClick={applyBankLedger}
            className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Apply to all transactions
          </button>
        </div>

        {ledgerNames.length === 0 && (
          <p className="mt-3 text-sm text-amber-800">
            No ledgers loaded yet. Import your Tally ledger master on the Ledgers page first.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left">
          <thead className="bg-slate-100">
            <tr>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Date</th>
              <th className="min-w-[14rem] border-b px-4 py-4 text-sm font-medium text-slate-700">Narration</th>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Amount</th>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Deposit / Withdraw</th>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Voucher</th>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Debit Ledger</th>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Credit Ledger</th>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Status</th>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id} className="even:bg-slate-50">
                <td className="border-b px-4 py-3 text-sm text-slate-700">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\\d{2}-\\d{2}-\\d{4}"
                    maxLength={10}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                    value={normalizeDateForInput(tx.date)}
                    onChange={(e) => updateRow(tx.id, "date", formatDateValue(e.target.value))}
                    placeholder="DD-MM-YYYY"
                  />
                </td>
                <td className="min-w-[14rem] border-b px-4 py-3 text-sm">
                  <textarea
                    className="min-h-[5rem] w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                    rows={2}
                    value={tx.final_narration ?? tx.narration}
                    onChange={(e) => updateRow(tx.id, "final_narration", e.target.value)}
                    placeholder="Add final narration"
                  />
                </td>
                <td className="border-b px-4 py-3 text-sm text-slate-900">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 text-black placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                    type="number"
                    step="0.01"
                    value={tx.amount ?? ""}
                    onChange={(e) => updateRow(tx.id, "amount", e.target.value)}
                    placeholder="Amount"
                  />
                </td>
                <td className="border-b px-4 py-3 text-sm">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${transactionTypeClass(tx.transaction_type)}`}
                    title="Detected from statement balance change"
                  >
                    {transactionTypeLabel(tx.transaction_type)}
                  </span>
                </td>
                <td className="border-b px-4 py-3 text-sm">
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                    value={tx.voucher_type ?? ""}
                    onChange={(e) => updateRow(tx.id, "voucher_type", e.target.value || null)}
                  >
                    <option value="">Select voucher</option>
                    {VOUCHER_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </td>
                <td className="border-b px-4 py-3 text-sm">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                    placeholder="Type ledger name..."
                    value={tx.debit_ledger ?? ""}
                    onChange={(e) => updateRow(tx.id, "debit_ledger", e.target.value || null)}
                    list="ledger-options"
                    autoComplete="off"
                  />
                </td>
                <td className="border-b px-4 py-3 text-sm">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                    placeholder="Type ledger name..."
                    value={tx.credit_ledger ?? ""}
                    onChange={(e) => updateRow(tx.id, "credit_ledger", e.target.value || null)}
                    list="ledger-options"
                    autoComplete="off"
                  />
                </td>
                <td className="border-b px-4 py-3 text-sm">
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                    value={tx.status ?? "Pending"}
                    onChange={(e) => updateRow(tx.id, "status", e.target.value)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </td>
                <td className="border-b px-4 py-3 text-sm">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => deleteRow(tx.id)}
                    className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600 shadow-sm">
        <p>
          Tip: set the bank account above first, then fill only the opposite ledger per row. Deposits need a credit
          ledger; withdrawals need a debit ledger.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-700">Need more entries? Add a manual transaction below.</p>
        <button
          type="button"
          disabled={saving}
          onClick={createTransaction}
          className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {saving ? "Working..." : "Add manual transaction"}
        </button>
      </div>

      <datalist id="ledger-options">
        {ledgerNames.map((name) => (
          <option value={name} key={name} />
        ))}
      </datalist>
    </div>
  );
}
