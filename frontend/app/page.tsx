"use client";

import axios from "axios";
import Link from "next/link";
import { useEffect, useState } from "react";
import StepProgress from "@/components/StepProgress";
import { API_BASE_URL } from "@/lib/api";

interface Stats {
  total: number;
  pending: number;
  approved: number;
  exported: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/stats`)
      .then((response) => setStats(response.data))
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-10">
      <StepProgress />
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 px-8 py-12 text-white shadow-2xl shadow-slate-900/20 sm:px-12">
        <div className="max-w-4xl space-y-6">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Tally Automation</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Clean transaction review for Tally exports.
          </h1>
          <p className="max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            Upload bank statements, assign ledgers with easy search, approve rows, and export ready XML. The workflow is built to keep the review page clear and the export process simple.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center rounded-3xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500"
            >
              Upload statement
            </Link>
            <Link
              href="/review"
              className="inline-flex items-center justify-center rounded-3xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Review transactions
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/upload"
            className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <h2 className="text-xl font-semibold text-slate-900">Upload statement</h2>
            <p className="mt-3 text-slate-600 group-hover:text-slate-900">
              Select a PDF and parse bank rows into the review queue.
            </p>
          </Link>

          <Link
            href="/review"
            className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <h2 className="text-xl font-semibold text-slate-900">Review transactions</h2>
            <p className="mt-3 text-slate-600 group-hover:text-slate-900">
              Assign voucher types, choose debit/credit ledgers, and approve rows.
            </p>
          </Link>

          <Link
            href="/settings"
            className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <h2 className="text-xl font-semibold text-slate-900">Import ledgers</h2>
            <p className="mt-3 text-slate-600 group-hover:text-slate-900">
              Upload XML or Excel ledger masters so the ledger search works well.
            </p>
          </Link>

          <Link
            href="/export"
            className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <h2 className="text-xl font-semibold text-slate-900">Export data</h2>
            <p className="mt-3 text-slate-600 group-hover:text-slate-900">
              Download approved transactions as XML or Excel for Tally import.
            </p>
          </Link>
        </div>

        <div className="rounded-[1.75rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Dashboard</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-100 p-5">
              <p className="text-sm text-slate-500">Parsed rows</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{loading ? "—" : stats?.total ?? 0}</p>
            </div>
            <div className="rounded-3xl bg-slate-100 p-5">
              <p className="text-sm text-slate-500">Pending</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{loading ? "—" : stats?.pending ?? 0}</p>
            </div>
            <div className="rounded-3xl bg-slate-100 p-5">
              <p className="text-sm text-slate-500">Approved</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{loading ? "—" : stats?.approved ?? 0}</p>
            </div>
            <div className="rounded-3xl bg-slate-100 p-5">
              <p className="text-sm text-slate-500">Exported</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{loading ? "—" : stats?.exported ?? 0}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
