"use client";

interface SectionHeaderProps {
  title: string;
  description: string;
  badge?: string;
}

export default function SectionHeader({ title, description, badge }: SectionHeaderProps) {
  return (
    <div className="rounded-[2rem] bg-white p-8 shadow-xl shadow-slate-200/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-600">{badge ?? "Step"}</p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-900">{title}</h1>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}
