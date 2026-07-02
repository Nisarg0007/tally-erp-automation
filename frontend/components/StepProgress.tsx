"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const steps = [
  { label: "Upload", href: "/upload" },
  { label: "Ledgers", href: "/settings" },
  { label: "Trade", href: "/trade" },
  { label: "Review", href: "/review" },
  { label: "Export", href: "/export" },
];

export default function StepProgress() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto mb-6 hidden max-w-7xl items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm sm:flex">
      {steps.map((step, index) => {
        const active = pathname === step.href;
        return (
          <div key={step.href} className="flex items-center gap-3">
            <Link
              href={step.href}
              className={`rounded-full px-4 py-2 transition ${
                active ? "bg-slate-900 text-white shadow" : "hover:bg-slate-200"
              }`}
            >
              {step.label}
            </Link>
            {index < steps.length - 1 && <span className="text-slate-400">→</span>}
          </div>
        );
      })}
    </nav>
  );
}
