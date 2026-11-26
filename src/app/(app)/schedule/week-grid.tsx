import Link from "next/link";
import { SESSION_STATUSES, type SessionStatus } from "@/lib/constants";
import { addDays } from "@/lib/stats";
import { timeUz } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { card } from "@/components/ui";

export type GridSession = {
  id: string;
  startsAt: Date;
  status: string;
  clientName: string;
  specialistName: string;
};

/**
 * Haftaning ko'rinishi: soatlar — qatorlar, kunlar — ustunlar.
 *
 * Pastdagi kunlik ro'yxat "nima qilish kerak" degan savolga javob beradi
 * (har qatorda O'tdi / Kelmadi tugmalari). Lekin "qaysi kun band, qayerda
 * teshik bor" degan savolga uzun ro'yxat javob bermaydi — buning uchun
 * haftani bir ekranda ko'rish kerak. Shuning uchun ikkisi birga turadi.
 *
 * Katakcha bosilsa, o'sha kunning ro'yxatiga olib tushadi: belgilash
 * tugmalari o'sha yerda.
 */
export async function WeekGrid({
  sessions,
  from,
}: {
  sessions: GridSession[];
  from: Date;
}) {
  const t = await getT();
  if (sessions.length === 0) return null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const todayKey = dayKey(new Date());

  // Faqat ish bor soatlar ko'rsatiladi: bo'sh 09:00—20:00 panjarasi ekranni
  // behuda egallaydi va kun ichidagi zichlikni ko'rsatmaydi
  const hours = [...new Set(sessions.map((s) => s.startsAt.getHours()))].sort((a, b) => a - b);

  const cellOf = new Map<string, GridSession[]>();
  for (const s of sessions) {
    const key = `${dayKey(s.startsAt)}|${s.startsAt.getHours()}`;
    const list = cellOf.get(key) ?? [];
    list.push(s);
    cellOf.set(key, list);
  }

  const chipStyle: Record<string, string> = {
    DONE: "bg-emerald-50 text-emerald-800 shadow-[inset_2px_0_0] shadow-emerald-600 dark:bg-emerald-950 dark:text-emerald-200",
    NO_SHOW: "bg-amber-50 text-amber-800 shadow-[inset_2px_0_0] shadow-amber-600 dark:bg-amber-950 dark:text-amber-200",
    PLANNED: "bg-slate-100 text-slate-700 shadow-[inset_2px_0_0] shadow-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:shadow-slate-600",
    CANCELLED: "bg-slate-50 text-slate-400 line-through dark:bg-slate-900 dark:text-slate-500",
    CANCELLED_CLIENT: "bg-slate-50 text-slate-400 line-through dark:bg-slate-900 dark:text-slate-500",
  };

  return (
    <section className={`${card} mb-5 p-4`} data-testid="week-grid">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("Hafta")}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-emerald-600" />
            {t("o'tdi")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-slate-300 dark:bg-slate-600" />
            {t("rejada")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-amber-600" />
            {t("kelmadi")}
          </span>
        </div>
      </div>

      <div className="scroll-x">
        <div className="grid min-w-[760px] gap-1" style={{ gridTemplateColumns: "50px repeat(7, minmax(0, 1fr))" }}>
          <span />
          {days.map((d) => {
            const isToday = dayKey(d) === todayKey;
            return (
              <div
                key={dayKey(d)}
                className={`flex flex-col gap-0.5 rounded-lg px-2 py-1.5 ${
                  isToday ? "bg-indigo-50 dark:bg-indigo-950/60" : ""
                }`}
              >
                <span
                  className={`text-xs font-semibold ${
                    isToday ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {t.weekdayShort(d)}
                </span>
                <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                  {d.getDate()}
                </span>
              </div>
            );
          })}

          {hours.map((h) => (
            <Row key={h} hour={h} days={days} dayKey={dayKey} todayKey={todayKey} cellOf={cellOf} chipStyle={chipStyle} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Row({
  hour,
  days,
  dayKey,
  todayKey,
  cellOf,
  chipStyle,
  t,
}: {
  hour: number;
  days: Date[];
  dayKey: (d: Date) => string;
  todayKey: string;
  cellOf: Map<string, GridSession[]>;
  chipStyle: Record<string, string>;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  return (
    <>
      <span className="pt-1.5 pr-1 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
        {String(hour).padStart(2, "0")}:00
      </span>
      {days.map((d, i) => {
        const list = cellOf.get(`${dayKey(d)}|${hour}`) ?? [];
        const isToday = dayKey(d) === todayKey;
        return (
          <div
            key={dayKey(d)}
            className={`flex min-h-[46px] flex-col gap-1 rounded-lg p-1 ${
              isToday ? "bg-indigo-50/60 dark:bg-indigo-950/30" : "bg-slate-50/70 dark:bg-slate-950/30"
            }`}
          >
            {list.map((s) => (
              <Link
                key={s.id}
                href={`#kun-${i}`}
                title={`${timeUz(s.startsAt)} · ${s.clientName} · ${s.specialistName} · ${t(
                  SESSION_STATUSES[s.status as SessionStatus],
                )}`}
                className={`block overflow-hidden rounded-md px-2 py-1 ${chipStyle[s.status] ?? chipStyle.PLANNED}`}
              >
                <span className="block truncate text-[11px] font-semibold">{s.clientName}</span>
                <span className="block truncate text-[10px] opacity-75">{timeUz(s.startsAt)}</span>
              </Link>
            ))}
          </div>
        );
      })}
    </>
  );
}
