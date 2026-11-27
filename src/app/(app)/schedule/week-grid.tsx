import Link from "next/link";
import { SESSION_STATUSES, type SessionStatus } from "@/lib/constants";
import { addDays } from "@/lib/stats";
import { timeUz } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export type GridSession = {
  id: string;
  startsAt: Date;
  status: string;
  clientName: string;
  specialistId: string;
  specialistName: string;
};

/**
 * Jadval panjarasi: soatlar — qatorlar.
 *
 * "Hafta" da ustunlar — kunlar: hafta qanday to'lganini ko'rsatadi.
 * "Kun" da ustunlar — mutaxassislar: "kim bo'sh, kim band" degan savolga
 * javob shu ko'rinishda ko'rinadi (qabulxona kun davomida shunga qaraydi).
 *
 * Pastdagi kunlik ro'yxat "nima qilish kerak" ni aytadi — katakni bosganda
 * o'sha kunga olib tushadi, belgilash tugmalari o'sha yerda.
 */
export async function WeekGrid({
  sessions,
  from,
  mode,
  dayIndex,
  dayHref,
}: {
  sessions: GridSession[];
  from: Date;
  mode: "hafta" | "kun";
  dayIndex: number;
  dayHref: (i: number) => string;
}) {
  const t = await getT();
  if (sessions.length === 0) return null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const todayKey = dayKey(new Date());
  const pickedDay = days[Math.min(6, Math.max(0, dayIndex))];

  // Kunlik ko'rinishda faqat o'sha kunning seanslari
  const shown =
    mode === "kun" ? sessions.filter((s) => dayKey(s.startsAt) === dayKey(pickedDay)) : sessions;

  // Ustunlar: kunlar yoki mutaxassislar
  const columns =
    mode === "kun"
      ? [...new Map(shown.map((s) => [s.specialistId, s.specialistName])).entries()]
          .sort((a, b) => a[1].localeCompare(b[1], "uz"))
          .map(([id, name]) => ({ key: id, label: name.split(" ")[0], sub: name.split(" ")[1] ?? "", highlight: false }))
      : days.map((d) => ({
          key: dayKey(d),
          label: t.weekdayShort(d),
          sub: String(d.getDate()),
          highlight: dayKey(d) === todayKey,
        }));

  // Faqat ish bor soatlar ko'rsatiladi: bo'sh panjara ekranni behuda egallaydi
  const hours = [...new Set(shown.map((s) => s.startsAt.getHours()))].sort((a, b) => a - b);

  const cellOf = new Map<string, GridSession[]>();
  for (const s of shown) {
    const col = mode === "kun" ? s.specialistId : dayKey(s.startsAt);
    const key = `${col}|${s.startsAt.getHours()}`;
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

  if (columns.length === 0) return null;

  return (
    <div className="scroll-x">
      <div
        className="grid min-w-[760px] gap-1"
        style={{ gridTemplateColumns: `50px repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        <span />
        {columns.map((c) => (
          <div
            key={c.key}
            className={`flex flex-col gap-0.5 rounded-lg px-2 py-1.5 ${
              c.highlight ? "bg-indigo-50 dark:bg-indigo-950/60" : ""
            }`}
          >
            <span
              className={`truncate text-xs font-semibold ${
                c.highlight
                  ? "text-indigo-700 dark:text-indigo-300"
                  : "text-slate-800 dark:text-slate-200"
              }`}
            >
              {c.label}
            </span>
            <span className="truncate text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {c.sub}
            </span>
          </div>
        ))}

        {hours.map((h) => (
          <Row
            key={h}
            hour={h}
            columns={columns}
            cellOf={cellOf}
            chipStyle={chipStyle}
            mode={mode}
            dayIndex={dayIndex}
            days={days}
            dayKey={dayKey}
            t={t}
          />
        ))}
      </div>

      {mode === "kun" ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {days.map((d, i) => {
            const on = i === dayIndex;
            return (
              <Link
                key={dayKey(d)}
                href={dayHref(i)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  on
                    ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "border-slate-200 bg-white font-medium text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {t.weekdayShort(d)} {d.getDate()}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  hour,
  columns,
  cellOf,
  chipStyle,
  mode,
  dayIndex,
  days,
  dayKey,
  t,
}: {
  hour: number;
  columns: { key: string; label: string; sub: string; highlight: boolean }[];
  cellOf: Map<string, GridSession[]>;
  chipStyle: Record<string, string>;
  mode: "hafta" | "kun";
  dayIndex: number;
  days: Date[];
  dayKey: (d: Date) => string;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  return (
    <>
      <span className="pt-1.5 pr-1 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
        {String(hour).padStart(2, "0")}:00
      </span>
      {columns.map((c) => {
        const list = cellOf.get(`${c.key}|${hour}`) ?? [];
        // Katak bosilsa pastdagi kunlik ro'yxatga olib tushadi
        const anchor =
          mode === "kun" ? dayIndex : days.findIndex((d) => dayKey(d) === c.key);
        return (
          <div
            key={c.key}
            className={`flex min-h-[46px] flex-col gap-1 rounded-lg p-1 ${
              c.highlight ? "bg-indigo-50/60 dark:bg-indigo-950/30" : "bg-slate-50/70 dark:bg-slate-950/30"
            }`}
          >
            {list.map((s) => (
              <Link
                key={s.id}
                href={`#kun-${anchor < 0 ? 0 : anchor}`}
                title={`${timeUz(s.startsAt)} · ${s.clientName} · ${s.specialistName} · ${t(
                  SESSION_STATUSES[s.status as SessionStatus],
                )}`}
                className={`block overflow-hidden rounded-md px-2 py-1 ${chipStyle[s.status] ?? chipStyle.PLANNED}`}
              >
                <span className="block truncate text-[11px] font-semibold">{s.clientName}</span>
                <span className="block truncate text-[10px] opacity-75">
                  {timeUz(s.startsAt)}
                  {mode === "hafta" ? ` · ${s.specialistName.split(" ")[0]}` : ""}
                </span>
              </Link>
            ))}
          </div>
        );
      })}
    </>
  );
}
