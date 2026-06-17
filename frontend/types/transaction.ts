export interface Transaction {
  id: number;
  date: string;
  narration: string;
  transaction_type: string;
  amount: number | null;
  balance: number;

  voucher_type: string | null;
  debit_ledger: string | null;
  credit_ledger: string | null;
  final_narration: string | null;
  source: string | null;

  status: string | null;
}