import Link from "next/link";
import { requireManager, branchWhere, isSolo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BILLABLE_STATUSES,
  SESSION_STATUSES,
  SESSION_STATUS_STYLE,
  SPECIALIZATIONS,
  type SessionStatus,
  type Specialization,
} from "@/lib/constants";
import {
  addDays,
  dayRange,
  getBranchReport,
  getDailyCollected,
  getDailySessions,
  getOverview,
  getSpecialistRows,
  monthRange,
  quarterRange,
  startOfDay,
  weekRange,
} from "@/lib/stats";
import { num, timeUz } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import {
  AttentionRow,
  Avatar,
  Badge,
  Card,
  HeroStat,
  PageHeader,
  Segmented,
  StatCard,
  btnPrimary,
  card,
} from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { MonthChart } from "./month-chart";

type Period = "hafta" | "oy" | "chorak";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ davr?: string }>;
}) {
  // Panel rahbarlarniki: ega, filial admini va yakka mutaxassis (o'ziga
  // rahbar). Markazdagi mutaxassis/ota-ona kabinetga, qabulxona jadvalga ketadi.
  const user = await requireManager();
  // Yakka mutaxassisda xodim yo'q — maosh, markaz ulushi va "kim ko'rdi"
  // ustunlari unga ma'nosiz (pulning hammasi o'ziniki)
  const solo = isSolo(user);

  const t = await getT();
  const money = t.money;
  const branchId = user.role === "OWNER" ? null : user.branchId;

  // Davr manzilda turadi (`?davr=`): sahifa server komponenti, shuning uchun
  // almashtirgich oddiy havolalardan — brauzerning "orqaga" tugmasi ham ishlaydi
  const { davr } = await searchParams;
  const period: Period = davr === "hafta" ? "hafta" : davr === "chorak" ? "chorak" : "oy";
  const range =
    period === "hafta" ? weekRange() : period === "chorak" ? quarterRange() : monthRange();
  const today = dayRange();
  const now = new Date();

  const [
    overview,
    todaySessions,
    activeClients,
    specialistRows,
    branchReport,
    noTelegram,
    dailySessions,
    dailyCash,
    unmarked,
    paidRows,
    earnedRows,
  ] = await Promise.all([
    getOverview({ branchId, ...range }),
    prisma.session.findMany({
      where: {
        startsAt: { gte: today.from, lt: today.to },
        ...branchWhere(branchId),
      },
      orderBy: { startsAt: "asc" },
      include: {
        client: { select: { id: true, fullName: true } },
        specialist: { include: { user: { select: { fullName: true } } } },
        branch: { select: { name: true } },
      },
    }),
    prisma.client.count({
      where: {
        status: "ACTIVE",
        ...branchWhere(branchId),
      },
    }),
    getSpecialistRows({ branchId, ...range }),
    // Filiallar kesimi faqat egaga kerak: filial admini bitta filialni ko'radi
    user.role === "OWNER" ? getBranchReport(range) : Promise.resolve([]),
    // Botga ulanmagan ota-onaga eslatma bormaydi, lekin bu hech qayerda
    // bilinmaydi — xodim "yubordik" deb o'ylab yuradi. Shuning uchun sonini
    // bosh panelda ko'rsatamiz.
    prisma.client.count({
      where: {
        status: "ACTIVE",
        ...branchWhere(branchId),
        OR: [{ parentUserId: null }, { parent: { is: { telegramId: null } } }],
      },
    }),
    // Kunlar kesimi: ustunli diagramma va to'q kartadagi chiziqcha uchun
    getDailySessions({ branchId, ...range }),
    getDailyCollected({ branchId, ...range }),
    // O'tib ketgan, lekin "O'tdi/Kelmadi" deb belgilanmagan seanslar: ular
    // turgancha ish haqi ham, kassa hisobi ham to'liq emas
    prisma.session.count({
      where: {
        startsAt: { lt: startOfDay(now) },
        status: "PLANNED",
        ...branchWhere(branchId),
      },
    }),
    // Qarzdor mijozlar — Mijozlar sahifasidagi bilan bir xil hisob:
    // to'langan puli ko'rsatilgan xizmatdan kam bo'lsa, qoldiq manfiy
    prisma.payment.groupBy({
      by: ["clientId"],
      where: { client: { status: "ACTIVE", ...branchWhere(branchId) } },
      _sum: { amount: true },
    }),
    prisma.session.groupBy({
      by: ["clientId"],
      where: {
        status: { in: BILLABLE_STATUSES },
        client: { status: "ACTIVE", ...branchWhere(branchId) },
      },
      _sum: { price: true },
    }),
  ]);

  const paidBy = new Map(paidRows.map((r) => [r.clientId, r._sum.amount ?? 0]));
  let debtors = 0;
  let debtTotal = 0;
  for (const r of earnedRows) {
    const balance = (paidBy.get(r.clientId) ?? 0) - (r._sum.price ?? 0);
    if (balance < 0) {
      debtors++;
      debtTotal += -balance;
    }
  }

  // Sarlavha — davr nomi: panelga kirgan odam birinchi "qaysi oy" ekanini
  // bilishi kerak, salomlashish esa hech narsa aytmaydi
  const monthName = t.monthYear(now);
  const monthTitle = monthName.charAt(0).toLocaleUpperCase(t.locale) + monthName.slice(1);
  const periodTitle =
    period === "hafta" ? t("Shu hafta") : period === "chorak" ? t("Oxirgi 3 oy") : monthTitle;
  const chartTitle =
    period === "hafta"
      ? t("Hafta davomida")
      : period === "chorak"
        ? t("3 oy davomida")
        : t("Oy davomida");
  const periodBadge =
    period === "hafta" ? t("shu hafta") : period === "chorak" ? t("3 oy") : monthTitle;

  // To'q kartadagi chiziqcha: davr kunlari bo'yicha kassa. Kalit to'liq sana —
  // chorakda uch oyning bir xil kun raqamlari aralashib ketmasin
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const cashByDay = new Map(dailyCash.map((d) => [dayKey(new Date(d.day)), d.amount]));
  const spark: number[] = [];
  for (let d = new Date(range.from); d < range.to; d = addDays(d, 1)) {
    spark.push(cashByDay.get(dayKey(d)) ?? 0);
  }

  return (
    <>
      <PageHeader
        title={periodTitle}
        subtitle={`${t.weekday(now)}, ${t.date(now)} · ${user.branchName ?? t("Barcha filiallar")}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              items={[
                { href: "/?davr=hafta", label: t("Hafta"), active: period === "hafta" },
                { href: "/", label: t("Oy"), active: period === "oy" },
                { href: "/?davr=chorak", label: t("Chorak"), active: period === "chorak" },
              ]}
            />
            <Link href="/slots" className={btnPrimary}>
              + {t("Seans yozish")}
            </Link>
          </div>
        }
      />

      {/* Bitta katta raqam + uchta kichik: sahifaning urg'usi kassada.
          Kichiklari bir xil o'lchamda — ular o'zaro teng ahamiyatda */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <div className="sm:col-span-2 lg:col-span-4">
          <HeroStat
            label={t("Kassaga tushgan")}
            value={money(overview.collected)}
            badge={periodBadge}
            hint={t("Xizmat qiymati {sum} — farqi mijozlarning oldindan to'lovi", {
              sum: money(overview.earned),
            })}
          >
            <Sparkline values={spark} />
          </HeroStat>
        </div>
        <div className="lg:col-span-2">
          <StatCard
            label={t("Faol mijozlar")}
            value={num(activeClients)}
            hint={branchId ? t("bu filialda") : t("barcha filiallarda")}
          />
        </div>
        <div className="lg:col-span-2">
          <StatCard
            label={t("O'tgan seanslar")}
            value={num(overview.done)}
            hint={t("{n} ta rejada", { n: overview.planned })}
          />
        </div>
        <div className="lg:col-span-2">
          {/* Rang faqat ma'no tashiydi: davomat pasaysa — ko'zga tashlanadi */}
          <StatCard
            label={t("Davomat")}
            value={overview.attendanceRate === null ? "—" : `${overview.attendanceRate}%`}
            hint={t("{n} ta kelmadi", { n: overview.noShow })}
            tone={
              overview.attendanceRate === null || overview.attendanceRate >= 85
                ? "default"
                : overview.attendanceRate >= 70
                  ? "warn"
                  : "bad"
            }
          />
        </div>
        {/* Maketdagi punktir kartochka: qolgan ko'rsatkichlar hisobotda */}
        <Link
          href="/reports"
          className="flex min-h-[112px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-[11px] leading-snug text-slate-500 transition hover:border-indigo-500 hover:text-indigo-600 sm:col-span-2 lg:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
        >
          <span aria-hidden="true" className="text-base leading-none">
            +
          </span>
          {t("Boshqa ko'rsatkichlar — Hisobotlar")}
        </Link>
      </div>

      {/* Diagramma keng, pul hisobi tor: bir xil o'lchamli kartalar qatori
          o'rniga sahifaga ritm beradi. Markazda abonement yo'q — qarzdorlik
          ham yo'q: har seans kelganda to'lanadi */}
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthChart days={dailySessions} from={range.from} to={range.to} title={chartTitle} />
        </div>

        <section className={`${card} min-w-0`}>
          <header className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("Davr hisobi")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("o'tgan seanslar bo'yicha")}
            </p>
          </header>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            <MoneyRow label={t("Xizmat qiymati")} value={money(overview.earned)} />
            {solo ? (
              <MoneyRow label={t("Rejadagi seanslar")} value={num(overview.planned)} />
            ) : (
              <>
                <MoneyRow label={t("Mutaxassis haqi")} value={money(overview.salary)} />
                <MoneyRow
                  label={t("Markaz ulushi")}
                  value={money(overview.earned - overview.salary)}
                  strong
                />
              </>
            )}
          </dl>
        </section>
      </div>

      {/* Bugungi kun va qolgan ishlar yonma-yon: rahbar ertalab shu ikkisiga
          qaraydi — "hozir nima bo'layapti" va "nima qilinmagan" */}
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
        <section className={`${card} min-w-0 lg:col-span-2`} data-testid="dash-today">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t("Bugungi jadval")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("{n} ta seans", { n: todaySessions.length })}
              </p>
            </div>
            <Link
              href="/schedule"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
            >
              {t("Butun hafta →")}
            </Link>
          </header>

          {todaySessions.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("Bugunga seans belgilanmagan.")}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 p-1.5 dark:divide-slate-800/70">
              {todaySessions.map((s) => {
                const spec = t(SPECIALIZATIONS[s.specialist.specialization as Specialization]);
                const status = t(SESSION_STATUSES[s.status as SessionStatus]);
                const endsAt = new Date(s.startsAt.getTime() + s.durationMin * 60_000);
                // "Hozir" — faqat rejadagi seans uchun: belgilangani o'tib ketgan
                const live = s.status === "PLANNED" && s.startsAt <= now && now < endsAt;
                return (
                  <li
                    key={s.id}
                    className={`flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3 ${
                      live ? "bg-indigo-50/70 dark:bg-indigo-950/40" : ""
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        s.status === "DONE"
                          ? "bg-emerald-600 dark:bg-emerald-400"
                          : s.status === "NO_SHOW"
                            ? "bg-amber-600 dark:bg-amber-400"
                            : live
                              ? "bg-indigo-600 dark:bg-indigo-400"
                              : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    />
                    <span
                      className={`w-11 shrink-0 text-sm tabular-nums ${
                        s.status === "PLANNED"
                          ? "text-slate-500 dark:text-slate-400"
                          : "font-semibold text-slate-900 dark:text-white"
                      }`}
                    >
                      {timeUz(s.startsAt)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        href={`/clients/${s.client.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-700 dark:text-white dark:hover:text-indigo-300"
                      >
                        {s.client.fullName}
                      </Link>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {solo ? spec : `${s.specialist.user.fullName} · ${spec}`}
                        {branchId ? "" : ` · ${s.branch.name}`}
                      </span>
                    </span>
                    {live ? <Badge tone="accent">{t("Hozir")}</Badge> : null}
                    <Badge className={SESSION_STATUS_STYLE[s.status as SessionStatus]}>
                      {status}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${card} min-w-0`}>
          <header className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("Diqqat talab qiladi")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("bugun qo'l tegishi kerak bo'lgan ishlar")}
            </p>
          </header>
          <div className="flex flex-col gap-2.5 p-4">
            {unmarked === 0 && noTelegram === 0 && debtors === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t("Hammasi joyida — qolib ketgan ish yo'q.")}
              </p>
            ) : null}
            {unmarked > 0 ? (
              <AttentionRow
                count={num(unmarked)}
                title={t("Seans belgilanmagan")}
                note={t("ish haqi va kassa hisobi to'liq emas")}
                href="/schedule"
                action={t("Belgilash")}
              />
            ) : null}
            {noTelegram > 0 ? (
              <AttentionRow
                count={num(noTelegram)}
                title={t("Ota-ona botga ulanmagan")}
                note={t("ularga eslatma bormaydi")}
                href="/clients?tg=yoq"
                action={t("Ro'yxat")}
              />
            ) : null}
            {debtors > 0 ? (
              <AttentionRow
                count={num(debtors)}
                title={t("Qoldig'i manfiy mijoz")}
                note={t("jami {sum}", { sum: money(debtTotal) })}
                href="/clients"
                action={t("Ko'rish")}
                tone="muted"
              />
            ) : null}
          </div>
        </section>
      </div>

      {branchReport.length > 1 ? (
        <Card
          title={t("Filiallar bo'yicha")}
          subtitle={t("har bir filialning mijozi, bajarilgan ishi va puli")}
          className="mt-8"
          action={
            <Link href="/reports" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {t("Batafsil hisobot →")}
            </Link>
          }
        >
          <DataTable
            testId="dash-branches"
            columns={[
              { label: t("Filial") },
              { label: t("Faol mijoz"), className: "tabular-nums" },
              { label: t("O'tgan seans"), className: "tabular-nums" },
              { label: t("Xizmat qiymati"), className: "tabular-nums" },
              { label: t("Kassaga tushgan"), className: "tabular-nums" },
            ]}
            rows={branchReport.map((b) => ({
              key: b.id,
              search: b.name,
              sort: [b.name, b.clients, b.done, b.earned, b.collected],
              cells: [
                <span key="n" className="font-medium text-slate-800 dark:text-slate-200">{b.name}</span>,
                num(b.clients),
                num(b.done),
                money(b.earned),
                <span key="c" className="font-semibold">{money(b.collected)}</span>,
              ],
            }))}
            footer={[
              t("Jami"),
              num(branchReport.reduce((n, b) => n + b.clients, 0)),
              num(branchReport.reduce((n, b) => n + b.done, 0)),
              money(branchReport.reduce((n, b) => n + b.earned, 0)),
              money(branchReport.reduce((n, b) => n + b.collected, 0)),
            ]}
          />
        </Card>
      ) : null}

      {/* To'liq kenglikda: tor ustunda ish haqi ustuni sig'may, kesilib qolardi.
          Yakka mutaxassisda bu jadval faqat o'zidan iborat bo'lardi — ko'rsatilmaydi */}
      {solo ? null : (
      <Card
        title={t("Mutaxassislar")}
        subtitle={t("{month} natijalari", { month: periodBadge })}
        className="mt-8"
      >
        <DataTable
          testId="dash-specialists"
          empty={t("Mutaxassis qo'shilmagan.")}
          columns={[
            { label: t("Mutaxassis") },
            { label: t("Yo'nalish") },
            ...(!branchId ? [{ label: t("Filial") }] : []),
            { label: t("Mijoz"), className: "tabular-nums" },
            { label: t("O'tdi"), className: "tabular-nums" },
            { label: t("Ish haqi"), className: "tabular-nums" },
          ]}
          rows={specialistRows.map((sp) => {
            const spec = t(SPECIALIZATIONS[sp.specialization as Specialization]);
            return {
              key: sp.id,
              search: `${sp.fullName} ${spec} ${sp.branchName}`,
              sort: [
                sp.fullName,
                spec,
                ...(!branchId ? [sp.branchName] : []),
                sp.clients,
                sp.done,
                sp.salary,
              ],
              cells: [
                <span key="n" className="flex items-center gap-2.5">
                  <Avatar name={sp.fullName} tone="muted" size="sm" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">{sp.fullName}</span>
                </span>,
                spec,
                ...(!branchId ? [sp.branchName] : []),
                sp.clients,
                sp.done,
                <span key="s" className="font-semibold">{money(sp.salary)}</span>,
              ],
            };
          })}
        />
      </Card>
      )}
    </>
  );
}

/**
 * To'q kartadagi ingichka chiziqcha: davr ichida kassa qanday to'lgani.
 * Oxirgi kun yorqinroq — "bugun qanday ketdi" ko'rinib tursin.
 */
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-10 items-end gap-[3px]" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-sm ${
            i === values.length - 1 ? "bg-white/90" : "bg-white/35"
          }`}
          style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** Davr hisobining bitta qatori: chapda nomi, o'ngda raqami */
function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 py-3">
      <dt className="text-sm text-slate-600 dark:text-slate-400">{label}</dt>
      <dd
        className={`tabular-nums ${
          strong
            ? "text-base font-semibold text-slate-900 dark:text-white"
            : "text-sm text-slate-900 dark:text-slate-200"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
