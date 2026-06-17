import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tally Automation",
  description: "Bank statement review, ledger upload, and Tally XML export.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-8">
            <Link href="/" className="text-lg font-semibold text-slate-900">
              Tally Automation
            </Link>
            <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
              <Link href="/upload" className="rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900">
                Upload
              </Link>
              <Link href="/review" className="rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900">
                Review
              </Link>
              <Link href="/settings" className="rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900">
                Ledgers
              </Link>
              <Link href="/export" className="rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900">
                Export
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
