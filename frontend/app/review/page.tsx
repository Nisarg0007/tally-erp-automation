"use client";

import axios from "axios";
import { useEffect, useState } from "react";

import StepProgress from "@/components/StepProgress";
import SectionHeader from "@/components/SectionHeader";
import TransactionTable from "@/components/TransactionTable";
import { Transaction } from "@/types/transaction";
import { Ledger } from "@/types/ledger";

export default function ReviewPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const approvedCount = transactions.filter((tx) => tx.status === "Approved").length;

  useEffect(() => {
    const isReload = typeof window !== "undefined" && (() => {
      if (window.performance?.getEntriesByType) {
        const entries = window.performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
        if (entries.length > 0) {
          return entries[0].type === "reload";
        }
      }
      return (window.performance as any)?.navigation?.type === 1;
    })();

    if (isReload) {
      clearTransactions().then(loadData);
    } else {
      loadData();
    }
  }, []);

  const clearTransactions = async () => {
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/transactions`);
      setTransactions([]);
    } catch (exception) {
      console.error(exception);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [transactionsResponse, ledgersResponse] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/transactions`),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/ledgers`),
      ]);

      setTransactions(transactionsResponse.data);
      setLedgers(ledgersResponse.data);
    } catch (exception) {
      console.error(exception);
      setError("Unable to load review data. Confirm the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const addManualTransaction = async () => {
    setLoading(true);
    setError(null);

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
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
      await loadData();
    } catch (exception) {
      console.error(exception);
      setError("Unable to add manual transaction. Confirm the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <StepProgress />
      <SectionHeader
        badge="Step 3"
        title="Review transactions"
        description="Assign voucher types, select debit/credit ledgers, and approve rows before exporting. Highlighted rows show missing data."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Review actions</p>
          <h2 className="text-2xl font-semibold text-white">Manage extracted and manual entries</h2>
        </div>
        <button
          type="button"
          onClick={addManualTransaction}
          className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={loading}
        >
          Add manual transaction
        </button>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="rounded-[2rem] bg-white p-8 shadow-xl shadow-slate-200/30">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Quick summary</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Parsed rows</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{loading ? "—" : transactions.length}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Ledger options</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{loading ? "—" : ledgers.length}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Review tips</p>
                <p className="mt-3 text-slate-700">Select ledgers from the list and save before moving to export.</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Ledger upload</p>
                <p className="mt-3 text-slate-700">If the ledger list is empty, upload your XML or Excel master in Ledgers.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl shadow-slate-900/30">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Need help?</p>
          <h2 className="mt-3 text-2xl font-semibold">Review flow</h2>
          <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-200">
            <li>• Upload your statement PDF first.</li>
            <li>• Import ledger XML or Excel in Ledgers.</li>
            <li>• Use search to assign debit and credit ledgers.</li>
            <li>• Select your bank account ledger to auto-fill one side on all rows.</li>
            <li>• Save all changes and mark rows as Approved.</li>
            <li>• Export approved rows from Export page.</li>
          </ul>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          Loading review data...
        </div>
      ) : error ? (
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-rose-700 shadow-sm">
          {error}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-700 shadow-sm">
          No transactions found. Upload a bank statement first, then return to review.
        </div>
      ) : (
        <>
          {approvedCount === 0 && (
            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-amber-800 shadow-sm">
              No approved rows yet. Save your changes and mark rows as Approved before exporting.
            </div>
          )}
          <TransactionTable transactions={transactions} ledgers={ledgers} onTransactionsUpdated={setTransactions} />
        </>
      )}
    </div>
  );
}
