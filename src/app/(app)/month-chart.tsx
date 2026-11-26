import { card } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import type { DayCount } from "@/lib/stats";

/**
 * Oy davomidagi mashg'ulotlar — paneldagi asosiy ko'rsatkich.
 *
 * Nega diagramma: "126 ta seans" degan raqam oyning qanday ketayotganini
 * aytmaydi — ish bir tekis bormi, qaysi kunlar bo'sh, bugungi kun o'rtachadan
 * yuqorimi. Ustunlar shu savolga bir qarashda javob beradi.
 *
 * Ranglar ataylab kam: o'tgan kunlar — sokin kulrang, bugun — ilovaning
 * asosiy rangi, oldinda turgan rejadagi seanslar — ochroq ustun. Shu bilan
 * ko'zga bugungi kun va ish hajmi tashlanadi, rang esa ma'no tashiydi.
 */
export async function MonthChart({
  days,
  from,
  to,
}: {
  days: DayCount[];
  from: Date;
  to: Date;
}) {
  const t = await getT();
  const today = new Date();
  const dayCount = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const byDay = new Map(days.map((d) => [new Date(d.day).getDate(), d]));

  const columns = Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(from.getFullYear(), from.getMonth(), i + 1);
    const row = byDay.get(i + 1);
    return {
      date,
      done: row?.done ?? 0,
      noShow: row?.noShow ?? 0,
      planned: row?.planned ?? 0,
      isToday:
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate(),
    };
  });

  const max = Math.max(1, ...columns.map((c) => c.done + c.noShow + c.planned));
  const totalDone = columns.reduce((n, c) => n + c.done, 0);
  const busiest = columns.reduce((a, b) => (b.done > a.done ? b : a), columns[0]);

  return (
    <section className={`${card} flex min-w-0 flex-col`} data-testid="dash-chart">
      <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t("Oy davomida")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {busiest && busiest.done > 0
            ? t("{n} ta mashg'ulot o'tdi · eng band kun {d}-sana, {m} ta", {
                n: totalDone,
                d: busiest.date.getDate(),
                m: busiest.done,
              })
            : t("{n} ta mashg'ulot o'tdi", { n: totalDone })}
        </p>
      </header>

      <div className="flex flex-1 flex-col justify-end p-4">
        <div className="flex h-44 items-end gap-1">
          {columns.map((c) => {
            const held = c.done + c.noShow;
            return (
              <div
                key={c.date.getDate()}
                className="flex h-full flex-1 flex-col justify-end gap-[2px]"
                title={t("{d}-sana: {done} o'tdi, {planned} rejada", {
                  d: c.date.getDate(),
                  done: held,
                  planned: c.planned,
                })}
              >
                {/* Rejadagi seanslar — o'sha rangning ochrog'i, boshqa rang
                    emas: diagrammada bitta ranglar oilasi tursin */}
                {c.planned > 0 ? (
                  <div
                    className={`w-full rounded-t-sm ${
                      c.isToday
                        ? "bg-indigo-600/30 dark:bg-indigo-400/30"
                        : "bg-slate-400/30 dark:bg-slate-500/30"
                    }`}
                    style={{ height: `${(c.planned / max) * 100}%` }}
                  />
                ) : null}
                {held > 0 ? (
                  <div
                    className={`w-full ${c.planned > 0 ? "rounded-none" : "rounded-t-sm"} ${
                      c.isToday
                        ? "bg-indigo-600 dark:bg-indigo-400"
                        : "bg-slate-400 dark:bg-slate-500"
                    }`}
                    style={{ height: `${(held / max) * 100}%` }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Kun raqamlari beshtadan: har kunni yozsak, ustunlar ustida raqam
            devori paydo bo'ladi va diagramma o'qilmay qoladi */}
        <div className="mt-2 flex gap-1 border-t border-slate-200 pt-2 dark:border-slate-800">
          {columns.map((c) => (
            <span
              key={c.date.getDate()}
              className={`flex-1 text-center text-[10px] tabular-nums ${
                c.isToday
                  ? "font-semibold text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {c.isToday || c.date.getDate() % 5 === 0 ? c.date.getDate() : " "}
            </span>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-slate-400 dark:bg-slate-500" />
            {t("o'tgan")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-slate-400/30 dark:bg-slate-500/30" />
            {t("rejada")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-indigo-600 dark:bg-indigo-400" />
            {t("bugun")}
          </span>
        </div>
      </div>
    </section>
  );
}
