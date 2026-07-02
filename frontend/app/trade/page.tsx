"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import StepProgress from "@/components/StepProgress";
import SectionHeader from "@/components/SectionHeader";
import { API_BASE_URL } from "@/lib/api";

interface TradeRow {
  id: number;
  date: string | null;
  tally_date: string | null;
  stock_code: string | null;
  action: string | null;
  quantity: number | string | null;
  price: number | string | null;
  total_amount: number | string | null;
  calculated_trade_value: number | string | null;
  charges: number | string | null;
  party_ledger: string | null;
  purchase_ledger: string | null;
  sales_ledger: string | null;
  charges_ledger: string | null;
  narration: string | null;
  status: string | null;
  source: string | null;
  include_charges_in_stock_value: boolean;
  charge_posting_mode: string | null;
}

interface LedgerOption {
  name: string;
}

const STATUS_OPTIONS = ["Pending", "Approved"];
const CHARGE_MODE_OPTIONS = ["separate", "include"];

function normalizeNumeric(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return value;
}

export default function TradePage() {
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [partyLedgerDefault, setPartyLedgerDefault] = useState("");
  const [tradeLedgerDefault, setTradeLedgerDefault] = useState("");
  const [chargesLedgerDefault, setChargesLedgerDefault] = useState("");

  const approvedCount = useMemo(() => rows.filter((row) => row.status === "Approved").length, [rows]);

  useEffect(() => {
    loadRows();
    loadLedgers();
  }, []);

  const loadRows = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/trade/rows`);
      setRows(response.data || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load trade rows.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/trade/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setToast(`Imported ${response.data?.count ?? 0} trade rows.`);
      await loadRows();
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "Upload failed.";
      setToast(typeof detail === "string" ? detail : "Upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const loadLedgers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/ledgers`);
      setLedgers((response.data || []).map((ledger: { name: string }) => ({ name: ledger.name })));
    } catch (err) {
      console.error(err);
    }
  };

  const applyDefaultLedgers = () => {
    const nextRows = rows.map((row) => {
      const nextRow = { ...row };
      if (partyLedgerDefault.trim()) {
        nextRow.party_ledger = partyLedgerDefault.trim();
      }
      if (tradeLedgerDefault.trim()) {
        if ((row.action || "Buy").toLowerCase() === "sell") {
          nextRow.sales_ledger = tradeLedgerDefault.trim();
        } else {
          nextRow.purchase_ledger = tradeLedgerDefault.trim();
        }
      }
      if (chargesLedgerDefault.trim()) {
        nextRow.charges_ledger = chargesLedgerDefault.trim();
      }
      return nextRow;
    });

    setRows(nextRows);
    setToast("Defaults applied to all rows.");
  };

  const saveRows = async () => {
    setLoading(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/trade/rows/bulk`, {
        rows: rows.map((row) => ({
          id: row.id,
          date: row.date,
          stock_code: row.stock_code,
          action: row.action,
          quantity: row.quantity,
          price: row.price,
          total_amount: row.total_amount,
          calculated_trade_value: row.calculated_trade_value,
          charges: row.charges,
          party_ledger: row.party_ledger,
          purchase_ledger: row.purchase_ledger,
          sales_ledger: row.sales_ledger,
          charges_ledger: row.charges_ledger,
          narration: row.narration,
          status: row.status,
          include_charges_in_stock_value: row.include_charges_in_stock_value,
          charge_posting_mode: row.charge_posting_mode,
        })),
      });
      setToast(response.data?.success ? "Trade rows saved." : "Unable to save trade rows.");
    } catch (err) {
      setToast("Unable to save trade rows.");
    } finally {
      setLoading(false);
    }
  };

  const exportVouchers = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/trade/export`, {}, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "trade_vouchers.xml";
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      setToast("Trade vouchers exported.");
    } catch (err) {
      setToast("Unable to export trade vouchers.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <StepProgress />
      <SectionHeader
        badge="Trade Book"
        title="Trade Book Import"
        description="Import equity trade-book PDFs or Excel files, review each row, and export Tally purchase/sales vouchers without affecting the bank-statement workflow."
      />

      <section className="rounded-[2rem] bg-white p-8 shadow-xl shadow-slate-200/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Import</p>
            <h2 className="text-2xl font-semibold text-slate-900">Upload trade-book file</h2>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500">
            <span>{uploading ? "Uploading..." : "Choose PDF or Excel"}</span>
            <input type="file" accept=".pdf,.xlsx,.xls" className="hidden" onChange={handleUpload} />
          </label>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-600">The importer will parse Buy/Sell rows, calculate trade value and charges, and prepare them for approval before export.</p>
      </section>

      <section className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl shadow-slate-900/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Review</p>
            <h2 className="text-2xl font-semibold">Editable trade rows</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={saveRows} className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white">Save rows</button>
            <button onClick={exportVouchers} className="rounded-2xl border border-white/20 px-5 py-2 text-sm font-semibold text-white">Export XML</button>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-300">{approvedCount} approved rows ready for export. Only approved rows are included in the generated vouchers.</p>

        <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label className="text-sm font-medium text-slate-300">Party ledger</label>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/90 px-3 py-2 text-sm text-slate-900"
              value={partyLedgerDefault}
              onChange={(e) => setPartyLedgerDefault(e.target.value)}
            >
              <option value="">Select from imported ledgers</option>
              {ledgers.map((ledger) => (
                <option value={ledger.name} key={ledger.name}>{ledger.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Purchase / Sales ledger</label>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/90 px-3 py-2 text-sm text-slate-900"
              value={tradeLedgerDefault}
              onChange={(e) => setTradeLedgerDefault(e.target.value)}
            >
              <option value="">Select from imported ledgers</option>
              {ledgers.map((ledger) => (
                <option value={ledger.name} key={ledger.name}>{ledger.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Charges ledger</label>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/90 px-3 py-2 text-sm text-slate-900"
              value={chargesLedgerDefault}
              onChange={(e) => setChargesLedgerDefault(e.target.value)}
            >
              <option value="">Select from imported ledgers</option>
              {ledgers.map((ledger) => (
                <option value={ledger.name} key={ledger.name}>{ledger.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={applyDefaultLedgers}
            className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Apply to all rows
          </button>
        </div>
      </section>

      {toast && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{toast}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">Loading trade rows...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-700 shadow-sm">No trade rows yet. Upload a trade-book file to begin.</div>
      ) : (
        <div className="overflow-x-auto rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-left">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Date</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Stock</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Action</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Qty</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Rate</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Total</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Charges</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Party Ledger</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Purchase/Sales Ledger</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Charges Ledger</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Narration</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Mode</th>
                <th className="border-b px-3 py-3 text-sm font-medium text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="even:bg-slate-50">
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><input className="w-full rounded-xl border border-slate-200 px-2 py-2" value={row.date ?? ""} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, date: e.target.value } : item))} /></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><input className="w-full rounded-xl border border-slate-200 px-2 py-2" value={row.stock_code ?? ""} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, stock_code: e.target.value } : item))} /></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><select className="w-full rounded-xl border border-slate-200 px-2 py-2" value={row.action ?? "Buy"} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, action: e.target.value } : item))}><option value="Buy">Buy</option><option value="Sell">Sell</option></select></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><input className="w-full rounded-xl border border-slate-200 px-2 py-2" value={normalizeNumeric(row.quantity)} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, quantity: e.target.value } : item))} /></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><input className="w-full rounded-xl border border-slate-200 px-2 py-2" value={normalizeNumeric(row.price)} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, price: e.target.value } : item))} /></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><input className="w-full rounded-xl border border-slate-200 px-2 py-2" value={normalizeNumeric(row.total_amount)} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, total_amount: e.target.value } : item))} /></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><input className="w-full rounded-xl border border-slate-200 px-2 py-2" value={normalizeNumeric(row.charges)} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, charges: e.target.value } : item))} /></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><input className="w-full rounded-xl border border-slate-200 px-2 py-2" value={row.party_ledger ?? ""} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, party_ledger: e.target.value } : item))} /></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><input className="w-full rounded-xl border border-slate-200 px-2 py-2" value={row.purchase_ledger ?? ""} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, purchase_ledger: e.target.value } : item))} /></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><input className="w-full rounded-xl border border-slate-200 px-2 py-2" value={row.charges_ledger ?? ""} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, charges_ledger: e.target.value } : item))} /></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><input className="w-full rounded-xl border border-slate-200 px-2 py-2" value={row.narration ?? ""} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, narration: e.target.value } : item))} /></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><select className="w-full rounded-xl border border-slate-200 px-2 py-2" value={row.charge_posting_mode ?? "separate"} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, charge_posting_mode: e.target.value } : item))}>{CHARGE_MODE_OPTIONS.map((option) => <option key={option} value={option}>{option === "separate" ? "Post charges separately" : "Include charges in stock value"}</option>)}</select></td>
                  <td className="border-b px-3 py-3 text-sm text-slate-700"><select className="w-full rounded-xl border border-slate-200 px-2 py-2" value={row.status ?? "Pending"} onChange={(e) => setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, status: e.target.value } : item))}>{STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
