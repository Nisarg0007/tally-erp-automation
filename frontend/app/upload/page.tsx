"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import StepProgress from "@/components/StepProgress";
import SectionHeader from "@/components/SectionHeader";
import { API_BASE_URL } from "@/lib/api";

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleFileSelection = (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "xml" && extension !== "xlsx" && extension !== "xls") {
      setToast({ message: "Please upload a PDF, Excel, or XML file.", type: "error" });
      return;
    }

    setFile(selectedFile);
    setToast(null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const droppedFile = event.dataTransfer.files?.[0] || null;
    handleFileSelection(droppedFile);
  };

  const uploadFile = async () => {
    if (!file) {
      setToast({ message: "Select a PDF, Excel, or XML file before uploading.", type: "error" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setToast(null);
      setProgress(0);

      const response = await axios.post(`${API_BASE_URL}/upload-pdf`, formData, {
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
        description="Upload an ICICI bank statement PDF, a trade book PDF/Excel export, a Care PMS transaction statement PDF, or previously exported XML. Existing rows are replaced each time so you can start fresh."
      />
      <section className="rounded-[2rem] bg-white p-8 shadow-xl shadow-slate-200/40">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-600">Upload</p>
          <h1 className="text-4xl font-semibold text-slate-900">Upload bank statement</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            Supported files: ICICI savings account PDFs, trade book PDF/Excel exports, and Care Portfolio Managers (PMS) transaction
            statements. You can also upload a previously exported XML file. Existing transaction rows are replaced
            on every upload.
          </p>
        </div>

        <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
          <label className="block text-sm font-medium text-slate-700">Statement PDF, Excel, or XML</label>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed px-6 py-10 text-center transition ${
              dragActive
                ? "border-indigo-500 bg-indigo-50"
                : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50"
            }`}
          >
            <svg className="h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 0 1-.88-7.9A5.5 5.5 0 0 1 19 9.5a5.5 5.5 0 0 1-1.1 10.9H7Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m12 13 2.5 2.5M12 13l-2.5 2.5M12 13v8" />
            </svg>
            <p className="mt-4 text-sm font-semibold text-slate-800">
              {dragActive ? "Drop your file here" : "Drag and drop your file here, or click to browse"}
            </p>
            <p className="mt-2 text-sm text-slate-500">Accepted formats: PDF, Excel (.xlsx), or XML</p>
            {file ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <p className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                  Selected: {file.name}
                </p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFileSelection(null);
                  }}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No file selected yet</p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xml,.xlsx,.xls"
            onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
            className="hidden"
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
