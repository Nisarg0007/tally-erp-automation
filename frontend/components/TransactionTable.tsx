"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";

import { Ledger } from "@/types/ledger";
import { Transaction } from "@/types/transaction";

interface Props {
  transactions: Transaction[];
  ledgers: Ledger[];
  onTransactionsUpdated: (transactions: Transaction[]) => void;
}

const VOUCHER_OPTIONS = ["Receipt", "Payment", "Contra", "Journal"];
const STATUS_OPTIONS = ["Pending", "Approved"];

export default function TransactionTable({ transactions, ledgers, onTransactionsUpdated }: Props) {
  const [rows, setRows] = useState<Transaction[]>(
    transactions.map((row) => ({ ...row, status: row.status ?? "Pending" }))
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const normalizeDateForInput = (date: string | null | undefined) => {
    if (!date) {
      return "";
    }

    const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return date;
    }

    const dmyMatch = date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      return `${year}-${month}-${day}`;
    }

    const dmySlashMatch = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmySlashMatch) {
      const [, day, month, year] = dmySlashMatch;
      return `${year}-${month}-${day}`;
    }

    return date;
  };

  const formatAmount = (amount: string | number | null | undefined) => {
    if (amount === null || amount === undefined || amount === "") {
      return null;
    }
    return typeof amount === "string" ? parseFloat(amount) : amount;
  };

  const deleteRow = async (id: number) => {
    setSaving(true);
    setToast(null);

    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/transactions/${id}`);
      const nextRows = rows.filter((row) => row.id !== id);
      setRows(nextRows);
      onTransactionsUpdated(nextRows);
      setToast("Transaction deleted.");
    } catch (error) {
      console.error(error);
      setToast("Failed to delete transaction. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAll = async () => {
    if (!window.confirm("Delete all transactions? This cannot be undone.")) {
      return;
    }
    setSaving(true);
    setToast(null);

    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/transactions`);
      setRows([]);
      onTransactionsUpdated([]);
      setToast("All transactions deleted.");
    } catch (error) {
      console.error(error);
      setToast("Failed to delete all transactions. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const createTransaction = async () => {
    setSaving(true);
    setToast(null);

    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
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
        setToast("Manual transaction added.");
      } else {
        setToast("Unable to add manual transaction.");
      }
    } catch (error) {
      console.error(error);
      setToast("Failed to create manual transaction. Check backend.");
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
      const response = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/transactions/bulk`, {
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
        setToast(
          forceStatus === "Approved"
            ? `${response.data.updated} transactions approved and saved.`
            : `${response.data.updated} transactions saved.`
        );
      } else {
        setToast("Unable to save transactions.");
      }
    } catch (error) {
      console.error(error);
      setToast("Failed to save transactions. Check the backend and try again.");
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
              onClick={deleteAll}
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

      {toast ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm">
          {toast}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left">
          <thead className="bg-slate-100">
            <tr>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Date</th>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Narration</th>
              <th className="border-b px-4 py-4 text-sm font-medium text-slate-700">Amount</th>
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
                    type="date"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                    value={normalizeDateForInput(tx.date)}
                    onChange={(e) => updateRow(tx.id, "date", e.target.value)}
                    placeholder="YYYY-MM-DD"
                  />
                </td>
                <td className="border-b px-4 py-3 text-sm">
                  <textarea
                    className="min-h-[4rem] w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
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
        <p>Tip: start typing ledger names in the debit / credit fields to filter the list.</p>
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
