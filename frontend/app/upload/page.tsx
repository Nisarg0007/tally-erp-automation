"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import StepProgress from "@/components/StepProgress";
import SectionHeader from "@/components/SectionHeader";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async () => {
    if (!file) {
      setError("Select a PDF or XML file before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setMessage(null);
      setError(null);
      setProgress(0);

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      });

      setMessage("Upload successful. Redirecting to review page...");
      setTimeout(() => router.push("/review"), 700);
    } catch (uploadError) {
      console.error(uploadError);
      setError("Upload failed. Confirm the file and backend are available.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <StepProgress />
      <SectionHeader
        badge="Step 1"
        title="Upload your bank statement"
        description="Upload a bank statement PDF or previously exported XML to parse transactions into the review flow. Existing rows are replaced each time so you can start fresh."
      />
      <section className="rounded-[2rem] bg-white p-8 shadow-xl shadow-slate-200/40">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-600">Upload</p>
          <h1 className="text-4xl font-semibold text-slate-900">Upload bank statement</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            Upload a clean statement PDF or a previously exported XML file. Existing transaction rows are replaced on every upload so the review list stays fresh.
          </p>
        </div>

        <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
          <label className="block text-sm font-medium text-slate-700">Statement PDF or XML</label>
          <input
            type="file"
            accept=".pdf,.xml"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-3 block w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              onClick={uploadFile}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-3xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Uploading..." : "Upload & Parse"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/review")}
              className="inline-flex items-center justify-center rounded-3xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Go to review
            </button>
          </div>

          {progress > 0 && (
            <div className="mt-4 rounded-3xl bg-white p-4 text-sm text-slate-700 shadow-sm">
              <div className="flex items-center justify-between font-medium text-slate-900">Uploading</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-slate-600">{progress}% complete</p>
            </div>
          )}

          {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
          {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
        </div>
      </section>

      <section className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl shadow-slate-900/30">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Need ledger upload?</p>
        <h2 className="mt-3 text-2xl font-semibold">Upload ledger XML or Excel</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          After uploading your statement, go to Ledgers to import a ledger master. Then use the review page to assign debit and credit ledgers with search suggestions.
        </p>
      </section>
    </div>
  );
}
