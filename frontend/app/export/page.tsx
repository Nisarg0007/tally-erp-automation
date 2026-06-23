"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import StepProgress from "@/components/StepProgress";
import SectionHeader from "@/components/SectionHeader";
import { API_BASE_URL } from "@/lib/api";

export default function ExportPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/stats`);
        setApprovedCount(response.data.approved ?? 0);
      } catch (error) {
        console.error(error);
        setMessage("Unable to load export availability. Check backend.");
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const download = (path: string) => {
    setMessage(null);
    if (approvedCount === 0) {
      setMessage("No approved transactions available. Please approve rows in Review before exporting.");
      return;
    }

    const url = `${API_BASE_URL}${path}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-8">
      <StepProgress />
      <SectionHeader
        badge="Step 4"
        title="Export approved transactions"
        description="Download approved rows as Tally XML or Excel once your review is complete."
      />

      <section className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white px-6 py-8 shadow-sm shadow-slate-200/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-500">Approved rows</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? "Loading..." : approvedCount}</p>
          </div>
          <p className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
            {approvedCount === 0 && !loading
              ? "No approved rows yet"
              : "Ready to export"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => download("/export/tally-xml")}
          disabled={loading || approvedCount === 0}
          className={`rounded-[1.75rem] px-6 py-8 text-left text-white shadow-xl shadow-slate-900/20 transition ${
            loading || approvedCount === 0
              ? "bg-slate-400 cursor-not-allowed"
              : "bg-slate-900 hover:bg-slate-800"
          }`}
        >
          <p className="text-sm uppercase tracking-[0.3em] text-slate-300">Tally XML</p>
          <h2 className="mt-4 text-2xl font-semibold">Download XML</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">Export approved rows in Tally-compatible XML format.</p>
        </button>

        <button
          type="button"
          onClick={() => download("/export/transactions.xlsx")}
          disabled={loading || approvedCount === 0}
          className={`rounded-[1.75rem] border px-6 py-8 text-left shadow-sm transition ${
            loading || approvedCount === 0
              ? "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
              : "border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:shadow-md"
          }`}
        >
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Excel</p>
          <h2 className="mt-4 text-2xl font-semibold">Download spreadsheet</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Export approved transactions as an Excel workbook for review.</p>
        </button>
      </section>

      {message && <p className="text-sm text-rose-600">{message}</p>}
    </div>
  );
}
