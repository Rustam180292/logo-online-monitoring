import Link from "next/link";
import type { ReactNode } from "react";

/* ---------- Qayta ishlatiladigan klasslar ----------
 *
 * Ko'rinishning asosi: oq karta, bitta ingichka chegara, 16px burchak va
 * soyasiz yuza. Soya o'rniga chegara ishlatilgan — ro'yxatlar ko'p bo'lgan
 * sahifada o'nlab soya "iflos" ko'rinadi.
 */

export const card =
  "rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

/* Karta ichidagi ichki quti (ro'yxat elementi, hisob-kitob bloki) */
export const cardSoft =
  "rounded-xl border border-slate-200/70 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40";

export const input =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 " +
  "focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export const label = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

export const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 " +
  "bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 " +
  "disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 " +
  "text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50";

export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 " +
  "bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 " +
  "dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300";

/* Jadval sarlavhasi: BOSH HARFLAR emas — gap qatori kabi o'qiladi */
export const th =
  "whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-medium text-slate-400 dark:text-slate-400";

export const td = "px-4 py-3 text-sm text-slate-700 dark:text-slate-300";

/* ---------- Komponentlar ---------- */

/**
 * Sahifa sarlavhasi. Izoh sarlavhaning USTIDA turadi: odam avval "qaysi
 * davr, qaysi filial" ni o'qib, keyin sahifa nomini ko'radi — sarlavha esa
 * sahifaning eng katta yozuvi bo'lib qoladi.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {subtitle ? (
          <p className="mb-1.5 text-[13px] text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}

export function Card({
  id,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  /** Sahifa ichidagi langar (Sozlamalardagi bo'limlar menyusi shunga o'tadi) */
  id?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    // min-w-0: kartadagi keng jadval kartani ekrandan kengaytirib yubormasin —
    // jadval o'zining scroll-x qutisida suriladi, sahifa esa yonga oshmaydi
    <section id={id} className={`${card} min-w-0 scroll-mt-24 ${className}`}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
            {subtitle ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label: labelText,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad" | "accent";
  href?: string;
}) {
  const tones = {
    default: "text-slate-900 dark:text-white",
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    bad: "text-rose-600 dark:text-rose-400",
    accent: "text-indigo-600 dark:text-indigo-400",
  };
  const body = (
    <div
      className={`${card} flex h-full min-h-[118px] flex-col p-4.5 ${
        href ? "transition hover:border-indigo-300" : ""
      }`}
    >
      <p className="text-xs text-slate-500 dark:text-slate-400">{labelText}</p>
      <p className={`mt-2 text-[22px] font-semibold tracking-tight tabular-nums ${tones[tone]}`}>
        {value}
      </p>
      {hint ? (
        <p className="mt-auto pt-2 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/**
 * Sahifaning eng muhim raqami — to'q kartada. Bir sahifada BITTA bo'ladi:
 * ikkitasi bo'lsa, ko'z qaysi biri muhimligini bilmay qoladi.
 */
export function HeroStat({
  label,
  value,
  hint,
  badge,
  children,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  badge?: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex h-full min-h-[118px] flex-col gap-3 rounded-2xl bg-slate-900 p-5 text-white dark:ring-1 dark:ring-indigo-900/70">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-white/70">{label}</span>
        {badge ? (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-white/75">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="text-[32px] font-semibold tracking-tight tabular-nums">{value}</p>
      {children}
      {hint ? <p className="mt-auto text-xs text-white/60">{hint}</p> : null}
    </section>
  );
}

/**
 * Davr almashtirgich (Hafta / Oy / Chorak). Havolalardan yasalgan: sahifalar
 * server komponenti, davr manzilda turadi — orqaga qaytish ham ishlaydi.
 */
export function Segmented({
  items,
  className = "",
}: {
  items: { href: string; label: string; active?: boolean }[];
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800/70 ${className}`}
    >
      {items.map((it) => (
        <Link
          key={it.href + it.label}
          href={it.href}
          className={`rounded-[10px] px-3.5 py-1.5 text-[13px] transition ${
            it.active
              ? "bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
              : "font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

/** Filtr tugmalari: "Hammasi 24", "Qarzdor 4" — soni bilan birga */
export function FilterChips({
  items,
}: {
  items: { href: string; label: string; count?: number | string; active?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <Link
          key={it.href + it.label}
          href={it.href}
          className={`inline-flex items-center gap-2 rounded-full border py-1.5 pl-3.5 text-[13px] transition ${
            it.count === undefined ? "pr-3.5" : "pr-2"
          } ${
            it.active
              ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              : "border-slate-200 bg-white font-medium text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <span>{it.label}</span>
          {it.count === undefined ? null : (
            <span
              className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${
                it.active
                  ? "bg-white text-indigo-700 dark:bg-slate-900 dark:text-indigo-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {it.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** Ism bosh harflari — rasm yo'q joyda odamni ajratib turadi */
export function Avatar({
  name,
  tone = "default",
  size = "md",
}: {
  name: string;
  tone?: "default" | "accent" | "warn" | "muted" | "dark";
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const tones = {
    default: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    accent: "bg-indigo-600 text-white",
    warn: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    muted: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    dark: "bg-slate-900 text-white dark:bg-slate-700",
  };
  const sizes = {
    sm: "h-7 w-7 rounded-lg text-[10px]",
    md: "h-9 w-9 rounded-xl text-xs",
    lg: "h-12 w-12 rounded-2xl text-sm",
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-semibold ${tones[tone]} ${sizes[size]}`}
    >
      {initials}
    </span>
  );
}

/**
 * Nomi — chiziq — raqami qatori. Ro'yxatni diagrammaga aylantirmasdan
 * taqqoslash imkonini beradi (kim ko'p ishladi, qaysi filial ko'p tushdi).
 */
export function BarRow({
  label,
  value,
  part,
  tone = "accent",
  labelWidth = "w-28",
}: {
  label: string;
  value: string;
  part: number;
  tone?: "accent" | "warn" | "muted";
  labelWidth?: string;
}) {
  const tones = {
    accent: "bg-indigo-600 dark:bg-indigo-500",
    warn: "bg-amber-600 dark:bg-amber-500",
    muted: "bg-slate-300 dark:bg-slate-600",
  };
  const pct = Math.max(0, Math.min(100, Math.round(part * 100)));
  return (
    <div className="flex items-center gap-3">
      <span className={`${labelWidth} truncate text-xs text-slate-500 dark:text-slate-400`}>
        {label}
      </span>
      <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <span className={`block h-full rounded-full ${tones[tone]}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {value}
      </span>
    </div>
  );
}

/** Kalit — qiymat qatori (yon paneldagi tafsilotlar) */
export function KeyRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-slate-500 dark:text-slate-400">{k}</span>
      <span className="text-right text-[13px] font-medium text-slate-800 dark:text-slate-200">
        {v}
      </span>
    </div>
  );
}

export type BadgeTone = "muted" | "good" | "warn" | "bad" | "accent" | "plan";

const badgeTones: Record<BadgeTone, string> = {
  muted:
    "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  plan: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  warn: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  bad: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900",
  accent:
    "bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900",
};

export function Badge({
  children,
  tone,
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const look = className || badgeTones[tone ?? "muted"];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${look}`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
      {children}
    </p>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
      {message}
    </p>
  );
}

/**
 * Diqqat talab qiladigan ish: belgilanmagan seans, botga ulanmagan ota-ona,
 * manfiy qoldiq. Raqam oldinda — nechta ish qolganini bir qarashda ko'rsatadi.
 */
export function AttentionRow({
  count,
  title,
  note,
  href,
  action,
  tone = "warn",
}: {
  count: string;
  title: string;
  note?: string;
  href?: string;
  action?: string;
  tone?: "warn" | "muted";
}) {
  const box =
    tone === "warn"
      ? "border-amber-100 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
      : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40";
  const num =
    tone === "warn"
      ? "text-amber-700 dark:text-amber-300"
      : "text-slate-700 dark:text-slate-200";
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${box}`}>
      <span className={`shrink-0 text-xl font-semibold tabular-nums ${num}`}>{count}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {title}
        </span>
        {note ? (
          <span className="block text-[11px] text-slate-500 dark:text-slate-400">{note}</span>
        ) : null}
      </span>
      {href && action ? (
        <Link
          href={href}
          className="shrink-0 text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
        >
          {action}
        </Link>
      ) : null}
    </div>
  );
}
