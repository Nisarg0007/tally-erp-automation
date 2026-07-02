"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import StepProgress from "@/components/StepProgress";
import SectionHeader from "@/components/SectionHeader";
import { API_BASE_URL } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelection = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError(null);
    setMessage(null);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    handleFileSelection(event.dataTransfer.files?.[0] || null);
  };

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
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed px-6 py-10 text-center transition ${
                dragActive ? "border-indigo-400 bg-slate-800" : "border-slate-700 bg-slate-800/80"
              }`}
            >
              <svg className="h-10 w-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 0 1-.88-7.9A5.5 5.5 0 0 1 19 9.5a5.5 5.5 0 0 1-1.1 10.9H7Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m12 13 2.5 2.5M12 13l-2.5 2.5M12 13v8" />
              </svg>
              <p className="mt-4 text-sm font-semibold text-slate-100">{dragActive ? "Drop your ledger file here" : "Drag and drop your ledger file here, or click to browse"}</p>
              <p className="mt-2 text-sm text-slate-400">Supported formats: XML or Excel (.xlsx)</p>
              {file ? (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <p className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-300">Selected: {file.name}</p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFileSelection(null);
                    }}
                    className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No file selected yet</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.xlsx"
              onChange={(event: ChangeEvent<HTMLInputElement>) => handleFileSelection(event.target.files?.[0] || null)}
              className="hidden"
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
