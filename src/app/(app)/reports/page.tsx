import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireManager, NOT_SOLO, branchWhere, isSolo } from "@/lib/auth";
import {
  BILLABLE_STATUSES,
  SPECIALIZATIONS,
  type SessionStatus,
  type Specialization,
} from "@/lib/constants";
import {
  getDailyCollected,
  getDailySalary,
  getOverview,
  getSpecialistRows,
  monthRange,
  quarterRange,
} from "@/lib/stats";
import { MoneyChart } from "./money-chart";
import { num } from "@/lib/format";
import {
  Avatar,
  Card,
  Empty,
  HeroStat,
  KeyRow,
  PageHeader,
  Segmented,
  StatCard,
  btn,
  card,
  td,
  th,
} from "@/components/ui";
import { getT } from "@/lib/i18n/server";

type Search = { m?: string; davr?: string };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  // Yakka mutaxassis ham o'z hisobotini ko'radi — doirasi o'z filiali
  const user = await requireManager();
  const solo = isSolo(user);
  const t = await getT();
  const sp = await searchParams;

  const offset = Number.parseInt(sp.m ?? "0", 10) || 0;
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);

  // Davr: oy / 3 oy / yil. Diagramma ustunlari shunga qarab kun, hafta yoki
  // oyga yig'iladi — aks holda yillik ko'rinishda 365 ta ingichka chiziq chiqadi
  const davr = ["chorak", "yil"].includes(sp.davr ?? "") ? sp.davr! : "oy";
  const { from, to } =
    davr === "yil"
      ? { from: new Date(base.getFullYear(), 0, 1), to: new Date(base.getFullYear() + 1, 0, 1) }
      : davr === "chorak"
        ? quarterRange(base)
        : monthRange(base);
  const chartStep = davr === "yil" ? "oy" : davr === "chorak" ? "hafta" : "kun";
  const periodLabel =
    davr === "yil"
      ? String(from.getFullYear())
      : davr === "chorak"
        ? `${t.month(from.getMonth())} — ${t.monthYear(new Date(to.getFullYear(), to.getMonth() - 1, 1))}`
        : t.monthYear(from);

  const branchId = user.role === "OWNER" ? null : user.branchId;

  const [overview, specialistRows, branches, sessions, dailyCash, dailyPay] = await Promise.all([
    getOverview({ branchId, from, to }),
    getSpecialistRows({ branchId, from, to }),
    user.role === "OWNER" ? prisma.branch.findMany({ where: NOT_SOLO, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.session.findMany({
      where: {
        startsAt: { gte: from, lt: to },
        ...branchWhere(branchId),
      },
      select: {
        status: true,
        price: true,
        branchId: true,
        specialist: { select: { specialization: true } },
      },
    }),
    getDailyCollected({ branchId, from, to }),
    getDailySalary({ branchId, from, to }),
  ]);

  // Konsultatsiya puli abonement to'lovlaridan alohida yuritiladi (qabul hali
  // mijoz emas), shuning uchun hisobotda ham alohida ko'rsatiladi.
  const intakeAgg = await prisma.intake.aggregate({
    where: {
      paidAt: { gte: from, lt: to },
      ...branchWhere(branchId),
    },
    _sum: { price: true },
    _count: true,
  });

  // Filiallar kesimi
  const branchStats = await Promise.all(
    branches.map(async (b) => {
      const ov = await getOverview({ branchId: b.id, from, to });
      const clients = await prisma.client.count({
        where: { branchId: b.id, status: "ACTIVE" },
      });
      return { ...b, ...ov, clients };
    }),
  );

  // Eng katta ish haqi — jadvaldagi chiziqlarni shunga nisbatan chizamiz
  const maxSalary = Math.max(1, ...specialistRows.map((r) => r.salary));

  // Yo'nalishlar kesimi
  const bySpec = new Map<string, { done: number; revenue: number }>();
  for (const s of sessions) {
    const key = s.specialist.specialization;
    const cur = bySpec.get(key) ?? { done: 0, revenue: 0 };
    if (s.status === "DONE") cur.done++;
    if (BILLABLE_STATUSES.includes(s.status as SessionStatus)) cur.revenue += s.price;
    bySpec.set(key, cur);
  }
  const specRows = [...bySpec.entries()]
    .map(([k, v]) => ({ specialization: k, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const qs = (o: number) => {
    const q = new URLSearchParams();
    if (o !== 0) q.set("m", String(o));
    if (davr !== "oy") q.set("davr", davr);
    const x = q.toString();
    return x ? `/reports?${x}` : "/reports";
  };
  const qsDavr = (d: string) => {
    const q = new URLSearchParams();
    if (offset !== 0) q.set("m", String(offset));
    if (d !== "oy") q.set("davr", d);
    const x = q.toString();
    return x ? `/reports?${x}` : "/reports";
  };
  const profit = overview.earned - overview.salary;

  return (
    <>
      <PageHeader
        title={t("Hisobotlar")}
        subtitle={
          solo ? periodLabel : `${periodLabel} · ${user.branchName ?? t("barcha filiallar")}`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              items={[
                { label: t("Oy"), href: qsDavr("oy"), active: davr === "oy" },
                { label: t("3 oy"), href: qsDavr("chorak"), active: davr === "chorak" },
                { label: t("Yil"), href: qsDavr("yil"), active: davr === "yil" },
              ]}
            />
            <Link href="/settings#jadval" className={btn}>
              {t("Google jadvalga")}
            </Link>
            {davr === "oy" ? (
              <Link href={qs(offset - 1)} className={btn}>
                ← {t("O'tgan oy")}
              </Link>
            ) : null}
            {davr === "oy" && offset !== 0 ? (
              <Link href={qs(0)} className={btn}>
                {t("Bu oy")}
              </Link>
            ) : null}
            {davr === "oy" && offset < 0 ? (
              <Link href={qs(offset + 1)} className={btn}>
                {t("Keyingi oy")} →
              </Link>
            ) : null}
          </div>
        }
      />

      {/* Oyning asosiy raqami — kassa. Yonida uchta kichik: ular bilan
          "pul qayerga ketdi" degan savolga javob beriladi */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-9">
        <div className="sm:col-span-2 lg:col-span-3">
          <HeroStat
            label={t("Kassaga tushgan")}
            value={t.money(overview.collected)}
            badge={periodLabel}
            hint={t("Xizmat qiymati {sum}", { sum: t.money(overview.earned) })}
          />
        </div>
        {solo ? null : (
          <>
            <div className="lg:col-span-2">
              <StatCard label={t("Mutaxassis haqi")} value={t.money(overview.salary)} tone="warn" />
            </div>
            <div className="lg:col-span-2">
              <StatCard
                label={t("Markaz ulushi")}
                value={t.money(profit)}
                hint={t("xizmat qiymati − ish haqi")}
                tone="accent"
              />
            </div>
          </>
        )}
        <div className={solo ? "lg:col-span-3" : "lg:col-span-2"}>
          <StatCard
            label={t("Davomat")}
            value={overview.attendanceRate === null ? "—" : `${overview.attendanceRate}%`}
            hint={t("{noShow} kelmadi · {cancelled} bekor", { noShow: overview.noShow, cancelled: overview.cancelled })}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("O'tgan seanslar")} value={num(overview.done)} tone="good" />
        <StatCard label={t("Rejadagi seanslar")} value={num(overview.planned)} />
        <StatCard label={t("Xizmat qiymati")} value={t.money(overview.earned)} />
        <StatCard
          label={t("Konsultatsiyalardan")}
          value={t.money(intakeAgg._sum.price ?? 0)}
          hint={t("{n} ta to'langan qabul", { n: intakeAgg._count })}
          href="/intakes"
        />
      </div>

      {/* Tushum va ish haqi bitta ustunda: "ko'p tushdi, lekin ko'pi ish haqiga
          ketdi" degan holat ikki diagrammani solishtirmasdan ko'rinadi */}
      <section className={`${card} mt-4 p-5`}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("Tushum va ish haqi")}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {chartStep === "oy"
              ? t("{period} · oylar bo'yicha", { period: periodLabel })
              : chartStep === "hafta"
                ? t("{period} · haftalar bo'yicha", { period: periodLabel })
                : t("{period} · kunlar bo'yicha", { period: periodLabel })}
          </span>
        </div>
        <MoneyChart
          collected={dailyCash}
          salary={dailyPay}
          from={from}
          to={to}
          step={chartStep}
        />
      </section>

      {/* Filiallar kesimi: kartochkada har filialning uch raqami yonma-yon
          turadi — jadvalda ko'z ustunlar bo'ylab yurishi kerak edi */}
      {branchStats.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            {t("Filiallar kesimi")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {branchStats.map((b) => (
              <div key={b.id} className={`${card} p-4`} data-testid="report-branch">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {b.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                    {t("{n} faol mijoz", { n: b.clients })}
                  </span>
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {t.money(b.collected)}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("Tushum")}</p>

                {/* Xizmat qiymatining qanchasi ish haqiga ketganini ko'rsatadi */}
                <span className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <span
                    className="block bg-amber-400 dark:bg-amber-500"
                    style={{ width: `${b.earned > 0 ? Math.round((b.salary / b.earned) * 100) : 0}%` }}
                  />
                  <span className="block flex-1 bg-indigo-600 dark:bg-indigo-500" />
                </span>

                <dl className="mt-3 flex flex-col gap-1.5">
                  <KeyRow k={t("O'tdi")} v={String(b.done)} />
                  <KeyRow
                    k={t("Davomat")}
                    v={b.attendanceRate === null ? "—" : `${b.attendanceRate}%`}
                  />
                  <KeyRow k={t("Xizmat qiymati")} v={t.money(b.earned)} />
                  <KeyRow k={t("Ish haqi")} v={t.money(b.salary)} />
                  <KeyRow k={t("Markaz ulushi")} v={t.money(b.earned - b.salary)} />
                </dl>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Mutaxassis va yo'nalish kesimi yakka ishlaganda bitta qatordan iborat bo'lardi */}
      {solo ? null : (
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title={t("Mutaxassislar bo'yicha")}>
          {specialistRows.length === 0 ? (
            <Empty>{t("Ma'lumot yo'q.")}</Empty>
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[520px]">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className={th}>{t("Mutaxassis")}</th>
                    <th className={th}>{t("O'tdi")}</th>
                    <th className={th}>{t("Xizmat")}</th>
                    <th className={th}>{t("Ish haqi")}</th>
                    <th className={th}>{t("Ulush")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {specialistRows.map((r) => (
                    <tr key={r.id}>
                      <td className={td}>
                        <span className="flex items-center gap-2.5">
                          <Avatar name={r.fullName} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-800 dark:text-slate-200">
                              {r.fullName}
                            </span>
                            <span className="block truncate text-xs text-slate-400">
                              {t(SPECIALIZATIONS[r.specialization as Specialization])}
                              {!branchId ? ` · ${r.branchName}` : ""}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className={`${td} tabular-nums`}>{r.done}</td>
                      <td className={`${td} tabular-nums`}>{t.money(r.revenue)}</td>
                      <td className={`${td} font-semibold tabular-nums`}>{t.money(r.salary)}</td>
                      {/* Chiziq: kim ko'p ishlaganini raqamlarni solishtirmasdan ko'rsatadi */}
                      <td className={`${td} w-28`}>
                        <span className="block h-[7px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <span
                            className="block h-full rounded-full bg-indigo-600 dark:bg-indigo-500"
                            style={{ width: `${Math.round((r.salary / maxSalary) * 100)}%` }}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-4 pb-4 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            {t("Ish haqi bajarilgan seansdan hisoblanadi: seans narxi × foizi, \"O'tdi/Kelmadi\" belgilangan payt. Foiz seans bilan birga saqlanadi — keyin o'zgarsa, o'tgan hisob o'zgarmaydi.")}
          </p>
        </Card>

        <Card title={t("Yo'nalishlar bo'yicha")}>
          {specRows.length === 0 ? (
            <Empty>{t("Ma'lumot yo'q.")}</Empty>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {specRows.map((r) => {
                const max = specRows[0].revenue || 1;
                const pct = Math.round((r.revenue / max) * 100);
                return (
                  <li key={r.specialization} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {t(SPECIALIZATIONS[r.specialization as Specialization])}
                      </span>
                      <span className="tabular-nums text-slate-600 dark:text-slate-400">
                        {t("{n} seans", { n: r.done })} · {t.money(r.revenue)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      )}
    </>
  );
}
