"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import StepProgress from "@/components/StepProgress";
import SectionHeader from "@/components/SectionHeader";

type ToastType = "success" | "error";

interface ToastState {
  message: string;
  type: ToastType;
}

function getUploadErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }
  return "Upload failed. Confirm the file and backend are available.";
}

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const uploadFile = async () => {
    if (!file) {
      setToast({ message: "Select a PDF or XML file before uploading.", type: "error" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setToast(null);
      setProgress(0);

      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      });

      const count = response.data?.count ?? 0;
      setToast({
        message: `Parsed ${count} transaction${count === 1 ? "" : "s"}. Redirecting to review...`,
        type: "success",
      });
      setTimeout(() => router.push("/review"), 900);
    } catch (uploadError) {
      console.error(uploadError);
      setToast({ message: getUploadErrorMessage(uploadError), type: "error" });
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
        description="Upload an ICICI bank statement PDF, a Care PMS transaction statement PDF, or previously exported XML. Existing rows are replaced each time so you can start fresh."
      />
      <section className="rounded-[2rem] bg-white p-8 shadow-xl shadow-slate-200/40">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-600">Upload</p>
          <h1 className="text-4xl font-semibold text-slate-900">Upload bank statement</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            Supported PDFs: ICICI savings account statements and Care Portfolio Managers (PMS) transaction
            statements. You can also upload a previously exported XML file. Existing transaction rows are replaced
            on every upload.
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

          {progress > 0 && loading && (
            <div className="mt-4 rounded-3xl bg-white p-4 text-sm text-slate-700 shadow-sm">
              <div className="flex items-center justify-between font-medium text-slate-900">Uploading</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-slate-600">{progress}% complete</p>
            </div>
          )}
        </div>
      </section>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div
            className={`pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border px-4 py-4 shadow-xl backdrop-blur-sm ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-900"
                : "border-rose-200 bg-rose-50/95 text-rose-900"
            }`}
            role="status"
          >
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                toast.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {toast.type === "success" ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
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
