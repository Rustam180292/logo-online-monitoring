import { card } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { addDays, type DayCount } from "@/lib/stats";

/**
 * Davr davomidagi mashg'ulotlar — paneldagi asosiy ko'rsatkich.
 *
 * Nega diagramma: "126 ta seans" degan raqam oyning qanday ketayotganini
 * aytmaydi — ish bir tekis bormi, qaysi kunlar bo'sh, bugungi kun o'rtachadan
 * yuqorimi. Ustunlar shu savolga bir qarashda javob beradi.
 *
 * Ranglar ataylab kam: o'tgan kunlar — sokin kulrang, bugun — ilovaning
 * asosiy rangi, oldinda turgan rejadagi seanslar — ochroq ustun. Shu bilan
 * ko'zga bugungi kun va ish hajmi tashlanadi, rang esa ma'no tashiydi.
 *
 * Davr hafta ham, chorak ham bo'lishi mumkin: ustunlar `from` dan `to` ga
 * qarab yasaladi, kun raqamlari esa ustunlar soniga qarab siyraklashadi —
 * aks holda 90 kunlik diagrammada raqam devori paydo bo'ladi.
 */
export async function MonthChart({
  days,
  from,
  to,
  title,
}: {
  days: DayCount[];
  from: Date;
  to: Date;
  title?: string;
}) {
  const t = await getT();
  const today = new Date();
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = new Map(days.map((d) => [key(new Date(d.day)), d]));

  const columns = [];
  for (let date = new Date(from); date < to; date = addDays(date, 1)) {
    const row = byDay.get(key(date));
    columns.push({
      date,
      done: row?.done ?? 0,
      noShow: row?.noShow ?? 0,
      planned: row?.planned ?? 0,
      isToday: key(date) === key(today),
    });
  }

  const max = Math.max(1, ...columns.map((c) => c.done + c.noShow + c.planned));
  const totalDone = columns.reduce((n, c) => n + c.done, 0);
  const busiest = columns.reduce((a, b) => (b.done > a.done ? b : a), columns[0]);
  // Kun raqamlari: haftada hammasi, oyda beshtadan, chorakda haftada bir
  const labelEvery = columns.length <= 10 ? 1 : columns.length <= 35 ? 5 : 7;

  return (
    <section className={`${card} flex min-w-0 flex-col`} data-testid="dash-chart">
      <header className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {title ?? t("Oy davomida")}
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

      <div className="flex flex-1 flex-col justify-end p-5">
        <div className="flex h-44 items-end gap-1">
          {columns.map((c) => {
            const held = c.done + c.noShow;
            return (
              <div
                key={key(c.date)}
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
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                    style={{ height: `${(c.planned / max) * 100}%` }}
                  />
                ) : null}
                {held > 0 ? (
                  <div
                    className={`w-full ${c.planned > 0 ? "rounded-none" : "rounded-t-sm"} ${
                      c.isToday
                        ? "bg-indigo-600 dark:bg-indigo-400"
                        : "bg-slate-300 dark:bg-slate-600"
                    }`}
                    style={{ height: `${(held / max) * 100}%` }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex gap-1 border-t border-slate-200 pt-2 dark:border-slate-800">
          {columns.map((c) => (
            <span
              key={key(c.date)}
              className={`flex-1 text-center text-[10px] tabular-nums ${
                c.isToday
                  ? "font-semibold text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {c.isToday || c.date.getDate() % labelEvery === 0 ? c.date.getDate() : " "}
            </span>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-slate-300 dark:bg-slate-600" />
            {t("o'tgan")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-slate-200 dark:bg-slate-700" />
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
