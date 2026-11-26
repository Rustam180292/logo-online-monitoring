import Link from "next/link";
import { requireManager, branchWhere, isSolo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SESSION_STATUSES,
  SESSION_STATUS_STYLE,
  SPECIALIZATIONS,
  type SessionStatus,
  type Specialization,
} from "@/lib/constants";
import {
  dayRange,
  getBranchReport,
  getDailySessions,
  getOverview,
  getSpecialistRows,
  monthRange,
} from "@/lib/stats";
import { num, timeUz } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { Badge, Card, PageHeader, StatCard, card } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { MonthChart } from "./month-chart";

export default async function DashboardPage() {
  // Panel rahbarlarniki: ega, filial admini va yakka mutaxassis (o'ziga
  // rahbar). Markazdagi mutaxassis/ota-ona kabinetga, qabulxona jadvalga ketadi.
  const user = await requireManager();
  // Yakka mutaxassisda xodim yo'q — maosh, markaz ulushi va "kim ko'rdi"
  // ustunlari unga ma'nosiz (pulning hammasi o'ziniki)
  const solo = isSolo(user);

  const t = await getT();
  const money = t.money;
  const branchId = user.role === "OWNER" ? null : user.branchId;
  const month = monthRange();
  const today = dayRange();

  const [
    overview,
    todaySessions,
    activeClients,
    specialistRows,
    branchReport,
    noTelegram,
    dailySessions,
  ] = await Promise.all([
    getOverview({ branchId, ...month }),
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
    getSpecialistRows({ branchId, ...month }),
    // Filiallar kesimi faqat egaga kerak: filial admini bitta filialni ko'radi
    user.role === "OWNER" ? getBranchReport(month) : Promise.resolve([]),
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
    // Oy davomidagi ustunli diagramma uchun kunlar kesimi
    getDailySessions({ branchId, ...month }),
  ]);

  // Sarlavha — davr nomi: panelga kirgan odam birinchi "qaysi oy" ekanini
  // bilishi kerak, salomlashish esa hech narsa aytmaydi
  const monthName = t.monthYear(new Date());
  const monthTitle = monthName.charAt(0).toLocaleUpperCase(t.locale) + monthName.slice(1);

  return (
    <>
      <PageHeader
        title={monthTitle}
        subtitle={user.branchName ?? t("Barcha filiallar")}
      />

      {/* Ogohlantirish, lekin baqirmaydi: sariq nuqta ma'noni ko'rsatadi,
          qolgani sahifaning oddiy matni */}
      {noTelegram > 0 ? (
        <Link
          href="/clients?tg=yoq"
          className={`${card} mb-5 flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700`}
        >
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <span className="text-slate-600 dark:text-slate-400">
            <b className="font-medium text-slate-900 dark:text-white">
              {t("{n} ta faol mijozning", { n: noTelegram })}
            </b>{" "}
            {t("ota-onasi Telegram botga ulanmagan — ularga eslatma bormaydi")}
            <span className="ml-1 font-medium text-indigo-600 dark:text-indigo-400">
              {t("Ro'yxat →")}
            </span>
          </span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("Faol mijozlar")}
          value={num(activeClients)}
          hint={branchId ? t("bu filialda") : t("barcha filiallarda")}
        />
        <StatCard
          label={t("O'tgan seanslar")}
          value={num(overview.done)}
          hint={t("{n} ta rejada", { n: overview.planned })}
        />
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
        {/* Sahifadagi asosiy raqam — yagona urg'u shunga beriladi */}
        <StatCard
          label={t("Kassaga tushgan")}
          value={money(overview.collected)}
          hint={t("shu oyda")}
          tone="accent"
        />
      </div>

      {/* Diagramma keng, pul hisobi tor: bir xil o'lchamli kartalar qatori
          o'rniga sahifaga ritm beradi. Markazda abonement yo'q — qarzdorlik
          ham yo'q: har seans kelganda to'lanadi */}
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthChart days={dailySessions} from={month.from} to={month.to} />
        </div>

        <section className={`${card} min-w-0`}>
          <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("Oylik hisob")}
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

      {branchReport.length > 1 ? (
        <Card
          title={t("Filiallar bo'yicha (shu oy)")}
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

      <div className="mt-8">
        <Card
          title={t("Bugungi jadval")}
          subtitle={t("{n} ta seans", { n: todaySessions.length })}
          action={
            <Link href="/schedule" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {t("Butun hafta →")}
            </Link>
          }
        >
          <DataTable
            testId="dash-today"
            minWidth="min-w-[640px]"
            empty={t("Bugunga seans belgilanmagan.")}
            columns={[
              { label: t("Vaqt"), className: "font-semibold tabular-nums" },
              { label: t("Mijoz") },
              ...(!solo ? [{ label: t("Mutaxassis") }] : []),
              ...(!branchId ? [{ label: t("Filial") }] : []),
              { label: t("Holat") },
            ]}
            rows={todaySessions.map((s) => {
              const spec = t(SPECIALIZATIONS[s.specialist.specialization as Specialization]);
              const status = t(SESSION_STATUSES[s.status as SessionStatus]);
              return {
                key: s.id,
                search: [s.client.fullName, s.specialist.user.fullName, spec, s.branch.name, status].join(" "),
                sort: [
                  s.startsAt.getTime(),
                  s.client.fullName,
                  ...(!solo ? [s.specialist.user.fullName] : []),
                  ...(!branchId ? [s.branch.name] : []),
                  status,
                ],
                cells: [
                  timeUz(s.startsAt),
                  <Link
                    key="c"
                    href={`/clients/${s.client.id}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {s.client.fullName}
                  </Link>,
                  ...(!solo
                    ? [
                        <span key="s">
                          {s.specialist.user.fullName}
                          <span className="block text-xs text-slate-400">{spec}</span>
                        </span>,
                      ]
                    : []),
                  ...(!branchId ? [s.branch.name] : []),
                  <Badge key="b" className={SESSION_STATUS_STYLE[s.status as SessionStatus]}>
                    {status}
                  </Badge>,
                ],
              };
            })}
          />
        </Card>
      </div>

      {/* To'liq kenglikda: tor ustunda ish haqi ustuni sig'may, kesilib qolardi.
          Yakka mutaxassisda bu jadval faqat o'zidan iborat bo'lardi — ko'rsatilmaydi */}
      {solo ? null : (
      <Card
        title={t("Mutaxassislar")}
        subtitle={t("{month} natijalari", { month: monthName })}
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
                <span key="n" className="font-medium text-slate-800 dark:text-slate-200">{sp.fullName}</span>,
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

/** Oylik hisobning bitta qatori: chapda nomi, o'ngda raqami */
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
    <div className="flex items-baseline justify-between gap-3 px-4 py-3">
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
