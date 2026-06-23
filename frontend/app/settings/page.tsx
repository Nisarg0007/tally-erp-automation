"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import StepProgress from "@/components/StepProgress";
import SectionHeader from "@/components/SectionHeader";
import { API_BASE_URL } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const uploadLedgers = async () => {
    if (!file) {
      setError("Choose a ledger XML or Excel file first.");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE_URL}/import-ledgers`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data?.success) {
        setMessage(`Replaced previous ledgers with ${response.data.imported} from the uploaded file.`);
        setTimeout(() => router.push("/review"), 900);
      } else {
        setError("Ledger import failed. Confirm the file format and contents.");
      }
    } catch (exception) {
      console.error(exception);
      setError("Ledger import failed. Check the file and backend server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <StepProgress />
      <SectionHeader
        badge="Step 2"
        title="Upload ledger XML or Excel"
        description="Import your ledger file so the review page can suggest debit and credit ledger names while you work."
      />

      <section className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl shadow-slate-900/30">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Import ledger file</h2>
          <p className="text-sm leading-7 text-slate-300">
            Supported formats: Tally master XML and Excel (.xlsx). The backend reads ledger names and group names for faster review.
          </p>

          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900 p-6">
            <label className="block text-sm font-medium text-slate-200">Choose file</label>
            <input
              type="file"
              accept=".xml,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-3 block w-full rounded-3xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={uploadLedgers}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-3xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-600"
              >
                {loading ? "Importing..." : "Import ledgers"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/review")}
                className="inline-flex items-center justify-center rounded-3xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
              >
                Go to review
              </button>
            </div>

            {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
