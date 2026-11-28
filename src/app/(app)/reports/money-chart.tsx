import { addDays, type DayMoney } from "@/lib/stats";
import { getT } from "@/lib/i18n/server";

/**
 * "Tushum va ish haqi" — bitta ustunda ikki qavat: pastda ish haqi, ustida
 * markazga qolgani. Shunda "ko'p tushdi, lekin ko'pi ish haqiga ketdi" degan
 * holat ikkita diagrammani solishtirmasdan ko'rinadi.
 *
 * Davr uzayganda kunlar ko'payib ustunlar ingichkalashib ketmasin deb
 * kunlar hafta yoki oyga yig'iladi (`step`).
 */
export async function MoneyChart({
  collected,
  salary,
  from,
  to,
  step,
}: {
  collected: DayMoney[];
  salary: DayMoney[];
  from: Date;
  to: Date;
  step: "kun" | "hafta" | "oy";
}) {
  const t = await getT();

  const keyOf = (d: Date) => {
    if (step === "oy") return `${d.getFullYear()}-${d.getMonth()}`;
    if (step === "hafta") {
      const w = new Date(d);
      w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
      return `${w.getFullYear()}-${w.getMonth()}-${w.getDate()}`;
    }
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  // Bo'sh kunlar ham turadi: ustunlar orasidagi bo'shliq "ish bo'lmagan" demak
  const buckets: { key: string; at: Date; cash: number; pay: number }[] = [];
  const index = new Map<string, number>();
  for (let d = new Date(from); d < to; d = addDays(d, 1)) {
    const key = keyOf(d);
    if (index.has(key)) continue;
    index.set(key, buckets.length);
    buckets.push({ key, at: new Date(d), cash: 0, pay: 0 });
  }
  for (const r of collected) {
    const i = index.get(keyOf(new Date(r.day)));
    if (i !== undefined) buckets[i].cash += r.amount;
  }
  for (const r of salary) {
    const i = index.get(keyOf(new Date(r.day)));
    if (i !== undefined) buckets[i].pay += r.amount;
  }

  const max = Math.max(1, ...buckets.map((b) => Math.max(b.cash, b.pay)));
  const labelEvery = step === "kun" ? (buckets.length > 20 ? 3 : 2) : 1;
  const labelOf = (d: Date) =>
    step === "oy" ? t.month(d.getMonth()).slice(0, 3) : step === "hafta" ? `${d.getDate()}` : `${d.getDate()}`;

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: "148px" }}>
        {buckets.map((b, i) => {
          const rest = Math.max(0, b.cash - b.pay);
          return (
            <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-px">
              <span
                className="block rounded-t bg-indigo-600 dark:bg-indigo-500"
                style={{ height: `${Math.round((rest / max) * 100)}%` }}
                title={`${labelOf(b.at)}: ${t("tushum")} ${t.money(b.cash)}, ${t("ish haqi")} ${t.money(b.pay)}`}
              />
              <span
                className="block rounded-b bg-amber-400 dark:bg-amber-500"
                style={{ height: `${Math.round((b.pay / max) * 100)}%` }}
                title={`${labelOf(b.at)}: ${t("ish haqi")} ${t.money(b.pay)}`}
              />
              <span className="mt-1 block truncate text-center text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                {i % labelEvery === 0 ? labelOf(b.at) : " "}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="h-2 w-2 rounded-sm bg-indigo-600 dark:bg-indigo-500" />
          {t("Markazga qolgani")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="h-2 w-2 rounded-sm bg-amber-400 dark:bg-amber-500" />
          {t("Mutaxassis haqi")}
        </span>
      </div>
    </div>
  );
}
