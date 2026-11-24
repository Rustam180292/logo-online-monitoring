import type { ReactNode } from "react";
import { card } from "@/components/ui";

/* MAKET: hech qayerga saqlanmaydi, hamma qiymat qo'lda yozilgan */

export function Scale({
  title,
  hint,
  options,
  value,
}: {
  title: string;
  hint?: string;
  options: string[];
  value: number;
}) {
  return (
    <div className="border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800">
      <div className="mb-2">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</p>
        {hint ? <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o, i) => (
          <span
            key={o}
            className={
              i === value
                ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
                : "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }
          >
            {o}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Chips({
  title,
  options,
  picked,
}: {
  title: string;
  options: string[];
  picked: string[];
}) {
  return (
    <div className="border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800">
      <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <span
            key={o}
            className={
              picked.includes(o)
                ? "rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800"
                : "rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
            }
          >
            {o}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Bar({ value, max = 3 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max + 1 }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-6 rounded-sm ${
            i <= value ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
          }`}
        />
      ))}
    </div>
  );
}

export function MaketBelgisi({ children }: { children: ReactNode }) {
  return (
    <div className={`${card} mb-5 border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950`}>
      <p className="text-sm text-amber-900 dark:text-amber-200">{children}</p>
    </div>
  );
}
