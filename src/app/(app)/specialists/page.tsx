import { Fragment } from "react";
import Link from "next/link";
import { requireRole, NOT_SOLO, branchWhere } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { SPECIALIZATIONS, SPECIALIZATION_KEYS, type Specialization } from "@/lib/constants";
import { getSpecialistBalances, getSpecialistRows, monthRange } from "@/lib/stats";
import { dateShort, toDateInput } from "@/lib/format";
import {
  Avatar,
  Badge,
  Card,
  Empty,
  KeyRow,
  PageHeader,
  btn,
  btnPrimary,
  card,
  input,
  label,
  td,
  th,
} from "@/components/ui";
import {
  createOwner,
  createReception,
  createSpecialist,
  deletePayout,
  paySalary,
  toggleOwnerActive,
  updateOwner,
  toggleReceptionActive,
  toggleSpecialistActive,
  updateReception,
  updateSpecialist,
} from "./actions";
import { getT } from "@/lib/i18n/server";

export default async function SpecialistsPage({
  searchParams,
}: {
  searchParams: Promise<{ x?: string; kim?: string }>;
}) {
  const user = await requireRole("OWNER", "BRANCH_ADMIN");
  const sp = await searchParams;
  const t = await getT();
  const branchId = user.role === "OWNER" ? null : user.branchId;
  const settings = await getSettings();
  const month = monthRange();

  const [rows, inactive, branches, balances, payouts, reception, owners, specialistPhones] =
    await Promise.all([
    getSpecialistRows({ branchId, ...month }),
    prisma.specialist.findMany({
      where: { isActive: false, ...branchWhere(branchId) },
      include: { user: { select: { fullName: true } }, branch: { select: { name: true } } },
    }),
    user.role === "OWNER" ? prisma.branch.findMany({ where: NOT_SOLO, orderBy: { name: "asc" } }) : Promise.resolve([]),
    getSpecialistBalances({ branchId }),
    prisma.salaryPayout.findMany({
      where: { ...branchWhere(branchId) },
      orderBy: { paidAt: "desc" },
      take: 15,
      include: { specialist: { include: { user: { select: { fullName: true } } } } },
    }),
    prisma.user.findMany({
      where: { role: "RECEPTION", ...branchWhere(branchId) },
      include: { branch: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    }),
    // Egalik akkauntlari faqat eganing o'ziga ko'rinadi
    user.role === "OWNER"
      ? prisma.user.findMany({ where: { role: "OWNER" }, orderBy: { fullName: "asc" } })
      : Promise.resolve([]),
    // Tahrirlash formasi uchun telefon raqamlar (hisobot qatorlarida yo'q)
    prisma.specialist.findMany({
      where: { ...branchWhere(branchId) },
      select: { id: true, user: { select: { phone: true, telegramId: true } } },
    }),
  ]);

  const phoneOf = new Map(specialistPhones.map((x) => [x.id, x.user.phone]));
  // Botga ulanmagan xodim eslatma ham, zaxira ham olmaydi — buni ko'rsatib turamiz
  const tgOf = new Map(specialistPhones.map((x) => [x.id, Boolean(x.user.telegramId)]));
  // Eng katta ish haqi — jadvaldagi ulush chiziqlari shunga nisbatan chiziladi
  const maxSalary = Math.max(1, ...rows.map((r) => r.salary));

  // O'ngdagi panel: tanlanmagan bo'lsa birinchi xodim — panel bo'sh turmasin
  const selected = rows.find((r) => r.id === sp.x) ?? rows[0] ?? null;
  const selectedBalance = selected ? balances.find((b) => b.specialistId === selected.id) ?? null : null;

  // Tanlangan xodimning shu oydagi xizmatlari: ulush seans bilan saqlangani uchun
  // foizni seansdan olamiz (keyin o'zgarsa, o'tgan oy hisobi o'zgarmaydi)
  const [selectedMonthSessions, selectedSessions] = selected
    ? await Promise.all([
        prisma.session.findMany({
          where: {
            specialistId: selected.id,
            status: { in: ["DONE", "NO_SHOW"] },
            startsAt: { gte: month.from, lt: month.to },
          },
          select: { price: true, salaryPercent: true, sessionType: { select: { name: true } } },
        }),
        prisma.session.findMany({
          where: { specialistId: selected.id },
          orderBy: { startsAt: "desc" },
          take: 6,
          select: {
            id: true,
            startsAt: true,
            status: true,
            price: true,
            client: { select: { fullName: true } },
          },
        }),
      ])
    : [[], []];

  const serviceMap = new Map<string, { name: string; price: number; count: number; percent: number }>();
  for (const x of selectedMonthSessions) {
    const name = x.sessionType?.name ?? t("Xizmat ko'rsatilmagan");
    const prev = serviceMap.get(name);
    serviceMap.set(name, {
      name,
      price: x.price ?? prev?.price ?? 0,
      count: (prev?.count ?? 0) + 1,
      percent: x.salaryPercent ?? prev?.percent ?? 0,
    });
  }
  const selectedServices = [...serviceMap.values()].sort((a, b) => b.count - a.count);

  // Chiplar: bitta sahifada to'rt xil ro'yxat — maketdagidek
  const kim = ["nofaol", "ega", "qabul"].includes(sp.kim ?? "") ? sp.kim! : "faol";
  const groups = [
    { id: "faol", label: t("Faol"), count: rows.length },
    { id: "nofaol", label: t("Faol bo'lmaganlar"), count: inactive.length },
    ...(owners.length > 0 ? [{ id: "ega", label: t("Markaz egalari"), count: owners.length }] : []),
    { id: "qabul", label: t("Qabulxona"), count: reception.length },
  ];

  const totalSalary = rows.reduce((s, r) => s + r.salary, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  return (
    <>
      <PageHeader
        title={t("Xodimlar")}
        subtitle={t("{n} ta faol mutaxassis · {month}: xizmat {revenue}, ish haqi {salary}", {
          n: rows.length,
          month: t.monthYear(new Date()),
          revenue: t.money(totalRevenue),
          salary: t.money(totalSalary),
        })}
      />

      <details data-autoclose className={`${card} mb-5 p-4 ${kim === "faol" ? "" : "hidden"}`}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">
          + {t("Yangi mutaxassis qo'shish")}
        </summary>
        <form action={createSpecialist} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={label} htmlFor="fullName">
              {t("F.I.Sh.")} *
            </label>
            <input id="fullName" name="fullName" className={input} required />
          </div>
          <div>
            <label className={label} htmlFor="specialization">
              {t("Mutaxassislik")} *
            </label>
            <select id="specialization" name="specialization" className={input} required>
              {SPECIALIZATION_KEYS.map((s) => (
                <option key={s} value={s}>
                  {t(SPECIALIZATIONS[s])}
                </option>
              ))}
            </select>
          </div>
          {branches.length > 0 ? (
            <div>
              <label className={label} htmlFor="branchId">
                {t("Filial")} *
              </label>
              <select id="branchId" name="branchId" className={input} required>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className={label} htmlFor="phone">
              {t("Telefon (login)")} *
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+998901234567"
              className={input}
              required
            />
          </div>
          <div>
            <label className={label} htmlFor="password">
              {t("Parol")} *
            </label>
            <input id="password" name="password" type="text" className={input} required />
          </div>
          <div className="flex items-end">
            <button type="submit" className={`${btnPrimary} w-full`}>
              {t("Qo'shish")}
            </button>
          </div>
        </form>
      </details>

      {/* Chiplar: faol xodimlar, bo'shatilganlar, egalar va qabulxona — bitta sahifada */}
      <div className="mb-5 flex flex-wrap gap-2">
        {groups.map((g) => {
          const on = g.id === kim;
          return (
            <Link
              key={g.id}
              href={g.id === "faol" ? "/specialists" : `/specialists?kim=${g.id}`}
              className={`inline-flex items-center gap-2 rounded-full border py-[7px] pr-2 pl-3.5 text-[13px] transition ${
                on
                  ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "border-slate-200 bg-white font-medium text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {g.label}
              <span
                className={`rounded-full px-[7px] py-px text-[11px] tabular-nums ${
                  on
                    ? "bg-white text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {g.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Kartochkalar: xodim — odam, uning raqamlari bitta kartada tursin.
          Kartani bossangiz o'ngda tafsiloti va ish haqi hisob-kitobi */}
      {kim !== "faol" ? null : rows.length === 0 ? (
        <Card>
          <Empty>{t("Mutaxassis yo'q.")}</Empty>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:col-span-2">
            {rows.map((r) => {
              const on = selected?.id === r.id;
              return (
                <section
                  key={r.id}
                  data-testid="staff-card"
                  className={`${card} flex flex-col p-4 ${
                    on ? "border-indigo-600 ring-[3px] ring-indigo-600/10 dark:border-indigo-700" : ""
                  }`}
                >
                  <Link href={`/specialists?x=${r.id}`} className="flex items-start gap-3">
                    <Avatar name={r.fullName} tone={on ? "accent" : "default"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                        {r.fullName}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {t(SPECIALIZATIONS[r.specialization as Specialization])}
                        {branchId ? "" : ` · ${r.branchName}`}
                      </span>
                      {tgOf.get(r.id) ? null : (
                        <span className="mt-0.5 block text-[11px] text-amber-600 dark:text-amber-400">
                          {t("Telegram yo'q")}
                        </span>
                      )}
                    </span>
                  </Link>

                  <dl className="mt-3.5 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <div>
                      <dt className="text-[10px] text-slate-400 dark:text-slate-500">{t("Mijoz")}</dt>
                      <dd className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                        {r.clients}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-slate-400 dark:text-slate-500">{t("O'tdi")}</dt>
                      <dd className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {r.done}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] text-slate-400 dark:text-slate-500">{t("Ish haqi")}</dt>
                      <dd className="truncate text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                        {t.money(r.salary)}
                      </dd>
                    </div>
                  </dl>

                  {(() => {
                    const bal = balances.find((b) => b.specialistId === r.id);
                    const left = bal ? bal.balance : 0;
                    return (
                      <span
                        className={`mt-2.5 block rounded-lg px-2.5 py-1.5 text-[11px] ${
                          left > 0
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {left > 0
                          ? t("Ish haqi berilmagan: {sum}", { sum: t.money(left) })
                          : t("Ish haqi berilgan")}
                      </span>
                    );
                  })()}

                  <span className="mt-3 block h-[6px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <span
                      className="block h-full rounded-full bg-indigo-600 dark:bg-indigo-500"
                      style={{ width: `${Math.round((r.salary / maxSalary) * 100)}%` }}
                    />
                  </span>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <details data-autoclose className="min-w-0">
                      <summary className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        ✎ {t("Tahrirlash")}
                      </summary>
                      <form
                        action={updateSpecialist}
                        className="mt-2 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-900/60"
                      >
                        <input type="hidden" name="specialistId" value={r.id} />
                        <div>
                          <label className={label}>{t("F.I.Sh.")}</label>
                          <input name="fullName" defaultValue={r.fullName} className={input} required />
                        </div>
                        <div>
                          <label className={label}>{t("Telefon (login)")}</label>
                          <input
                            name="phone"
                            type="tel"
                            defaultValue={phoneOf.get(r.id) ?? ""}
                            className={input}
                            required
                          />
                        </div>
                        <div>
                          <label className={label}>{t("Mutaxassislik")}</label>
                          <select name="specialization" defaultValue={r.specialization} className={input}>
                            {SPECIALIZATION_KEYS.map((k) => (
                              <option key={k} value={k}>
                                {t(SPECIALIZATIONS[k])}
                              </option>
                            ))}
                          </select>
                        </div>
                        {branches.length > 0 ? (
                          <div>
                            <label className={label}>{t("Filial")}</label>
                            <select
                              name="branchId"
                              defaultValue={branches.find((b) => b.name === r.branchName)?.id ?? ""}
                              className={input}
                            >
                              {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        <div>
                          <label className={label}>{t("Yangi parol")}</label>
                          <input
                            name="password"
                            type="text"
                            placeholder={t("o'zgartirmasangiz bo'sh qoldiring")}
                            className={input}
                          />
                        </div>
                        <div className="flex items-end">
                          <button type="submit" className={`${btnPrimary} w-full`}>
                            {t("Saqlash")}
                          </button>
                        </div>
                      </form>
                    </details>
                    <form action={toggleSpecialistActive}>
                      <input type="hidden" name="specialistId" value={r.id} />
                      <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                        {t("bo'shatish")}
                      </button>
                    </form>
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            {selected ? (
              <section className={`${card} p-5`} data-testid="staff-panel">
                <div className="flex items-center gap-3">
                  <Avatar name={selected.fullName} size="lg" />
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                      {selected.fullName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t(SPECIALIZATIONS[selected.specialization as Specialization])} · {selected.branchName}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <KeyRow k={t("Telefon (login)")} v={phoneOf.get(selected.id) ?? "—"} />
                  <KeyRow k={t("Mijozlari")} v={t("{n} ta bola", { n: selected.clients })} />
                  <KeyRow
                    k={t("{month} seanslari", { month: t.monthYear(new Date()) })}
                    v={t("{done} o'tdi · {noShow} kelmadi", { done: selected.done, noShow: selected.noShow })}
                  />
                  <KeyRow k="Telegram" v={tgOf.get(selected.id) ? t("ulangan") : t("ulanmagan")} />
                </div>

                {selectedServices.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {t("Xizmatlari va ulushi")}
                    </span>
                    {selectedServices.map((x) => (
                      <div
                        key={x.name}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                            {x.name}
                          </span>
                          <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                            {t.money(x.price)} · {t("{n} seans", { n: x.count })}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          {x.percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-slate-900 dark:text-white">
                      {t("{month} uchun hisoblangan", { month: t.monthYear(new Date()) })}
                    </span>
                    <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                      {t.money(selected.salary)}
                    </span>
                  </div>
                  {selectedBalance ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t("Boshidan beri: hisoblangan {accrued}, to'langan {paid}, qolgan {left}", {
                        accrued: t.money(selectedBalance.accrued),
                        paid: t.money(selectedBalance.paid),
                        left: t.money(selectedBalance.balance),
                      })}
                    </p>
                  ) : null}
                  <form action={paySalary} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="specialistId" value={selected.id} />
                    <div className="min-w-0 flex-1">
                      <label className={label}>{t("Summa ({currency})", { currency: t.currency })}</label>
                      <input
                        name="amount"
                        inputMode="numeric"
                        defaultValue={selectedBalance ? Math.max(0, selectedBalance.balance) : 0}
                        className={input}
                      />
                    </div>
                    <button type="submit" className={btnPrimary}>
                      {t("to'lash")}
                    </button>
                  </form>
                  <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                    {t("Ish haqi to'lovdan emas, bajarilgan seansdan hisoblanadi. Foiz seans bilan saqlanadi — keyin o'zgartirsangiz, o'tgan oylar o'zgarmaydi.")}
                  </p>
                </div>

                {selectedSessions.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {t("Oxirgi seanslari")}
                    </span>
                    {selectedSessions.map((x) => (
                      <div key={x.id} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-[7px] w-[7px] shrink-0 rounded-full ${
                              x.status === "DONE"
                                ? "bg-emerald-600"
                                : x.status === "NO_SHOW"
                                  ? "bg-amber-600"
                                  : "bg-slate-300 dark:bg-slate-600"
                            }`}
                          />
                          <span className="truncate text-xs text-slate-700 dark:text-slate-300">
                            {x.client.fullName}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          {dateShort(x.startsAt)} · {t.money(x.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : (
              <section className={`${card} p-5`}>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("Xodimni tanlang — bu yerda uning xizmatlari, ish haqi va oxirgi seanslari ko'rinadi.")}
                </p>
              </section>
            )}
          </aside>
        </div>
      )}

      {kim === "faol" ? (
      <Card
        title={t("Ish haqi hisob-kitobi")}
        subtitle={t("boshidan beri: hisoblangan − to'langan = qolgan")}
        className="mt-5"
      >
        <div className="scroll-x">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className={th}>{t("Mutaxassis")}</th>
                {!branchId ? <th className={th}>{t("Filial")}</th> : null}
                <th className={th}>{t("Hisoblangan")}</th>
                <th className={th}>{t("To'langan")}</th>
                <th className={th}>{t("Qolgan")}</th>
                <th className={th}>{t("To'lab berish")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {balances.map((b) => (
                <tr key={b.specialistId}>
                  <td className={`${td} font-medium`}>
                    {b.fullName}
                    <span className="block text-xs text-slate-400">
                      {t(SPECIALIZATIONS[b.specialization as Specialization])}
                    </span>
                  </td>
                  {!branchId ? <td className={td}>{b.branchName}</td> : null}
                  <td className={`${td} tabular-nums`}>{t.money(b.accrued)}</td>
                  <td className={`${td} tabular-nums`}>{t.money(b.paid)}</td>
                  <td className={`${td} font-semibold tabular-nums`}>
                    <span
                      className={
                        b.balance > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {t.money(b.balance)}
                    </span>
                  </td>
                  <td className={td}>
                    <form action={paySalary} className="flex flex-wrap items-center gap-1.5">
                      <input type="hidden" name="specialistId" value={b.specialistId} />
                      <input type="hidden" name="paidAt" value={toDateInput(new Date())} />
                      <input
                        name="amount"
                        inputMode="numeric"
                        defaultValue={b.balance > 0 ? String(b.balance) : ""}
                        placeholder={t("summa")}
                        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950"
                        aria-label={t("To'lov summasi")}
                        required
                      />
                      <select
                        name="method"
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
                        aria-label={t("To'lov usuli")}
                      >
                        <option value="CASH">{t("Naqd")}</option>
                        <option value="CARD">{t("Karta")}</option>
                        <option value="TRANSFER">{t("O'tkazma")}</option>
                      </select>
                      <button type="submit" className="text-xs font-semibold text-indigo-600 hover:underline">
                        {t("to'lash")}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payouts.length > 0 ? (
          <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("Oxirgi to'lovlar")}
            </p>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-slate-700 dark:text-slate-300">
                    {dateShort(p.paidAt)} · {p.specialist.user.fullName}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {t.money(p.amount)}
                    </span>
                    <form action={deletePayout}>
                      <input type="hidden" name="payoutId" value={p.id} />
                      <button
                        type="submit"
                        className="text-xs text-slate-400 hover:text-rose-600"
                        title={t("O'chirish")}
                      >
                        ✕
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
      ) : null}

      {user.role === "OWNER" && kim === "ega" ? (
        <Card
          title={t("Markaz egalari")}
          subtitle={t("hamma filialni va hamma bo'limni ko'radi")}
          className="mt-5"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {owners.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {o.fullName}
                    {o.id === user.id ? (
                      <span className="ml-2 text-xs font-normal text-indigo-600 dark:text-indigo-400">
                        (siz)
                      </span>
                    ) : null}
                    {!o.isActive ? (
                      <span className="ml-2 text-xs font-normal text-slate-400">{t("(faol emas)")}</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-400">{o.phone}</p>

                  {/* Qabulxona xodimlaridagidek: ism, login va parolni shu yerda tuzatish */}
                  <details data-autoclose className="mt-1" data-testid="owner-edit">
                    <summary className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                      ✎ {t("Tahrirlash")}
                    </summary>
                    <form
                      action={updateOwner}
                      className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-900/60"
                    >
                      <input type="hidden" name="userId" value={o.id} />
                      <div>
                        <label className={label}>{t("F.I.Sh.")}</label>
                        <input name="fullName" defaultValue={o.fullName} className={input} required />
                      </div>
                      <div>
                        <label className={label}>{t("Telefon (login)")}</label>
                        <input name="phone" type="tel" defaultValue={o.phone} className={input} required />
                      </div>
                      <div>
                        <label className={label}>{t("Yangi parol")}</label>
                        <input
                          name="password"
                          type="text"
                          placeholder={t("o'zgartirmasangiz bo'sh qoldiring")}
                          className={input}
                        />
                      </div>
                      <div className="flex items-end">
                        <button type="submit" className={`${btnPrimary} w-full`}>
                          {t("Saqlash")}
                        </button>
                      </div>
                    </form>
                  </details>
                </div>
                {o.id === user.id ? null : (
                  <form action={toggleOwnerActive}>
                    <input type="hidden" name="userId" value={o.id} />
                    <button
                      type="submit"
                      className={
                        o.isActive
                          ? "text-xs text-slate-400 hover:text-rose-600"
                          : "text-xs font-semibold text-indigo-600 hover:underline"
                      }
                    >
                      {o.isActive ? t("o'chirish") : t("qaytarish")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>

          <details data-autoclose className="border-t border-slate-200 p-4 dark:border-slate-800">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">
              + {t("Egalik akkaunti qo'shish")}
            </summary>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t("Yangi ega sizdek to'liq huquqqa ega bo'ladi: hamma filial, to'lovlar, ish haqi va hisobotlar. Faqat ishonchli odamga bering.")}
            </p>
            <form action={createOwner} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={label} htmlFor="oFullName">
                  {t("F.I.Sh.")} *
                </label>
                <input id="oFullName" name="fullName" className={input} required />
              </div>
              <div>
                <label className={label} htmlFor="oPhone">
                  {t("Telefon (login)")} *
                </label>
                <input
                  id="oPhone"
                  name="phone"
                  type="tel"
                  placeholder="+998901234567"
                  className={input}
                  required
                />
              </div>
              <div>
                <label className={label} htmlFor="oPassword">
                  {t("Parol")} *
                </label>
                <input id="oPassword" name="password" type="text" className={input} required />
              </div>
              <div className="flex items-end">
                <button type="submit" className={`${btnPrimary} w-full`}>
                  {t("Qo'shish")}
                </button>
              </div>
            </form>
          </details>
        </Card>
      ) : null}

      {kim === "qabul" ? (
      <Card
        title={t("Qabulxona xodimlari")}
        subtitle={t("mijoz qabul qiladi va to'lov oladi; maosh, hisobot va xodimlar bo'limi ularga ko'rinmaydi")}
        className="mt-5"
      >
        {reception.length === 0 ? (
          <Empty>{t("Qabulxona xodimi qo'shilmagan.")}</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {reception.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {r.fullName}
                    {!r.isActive ? (
                      <span className="ml-2 text-xs font-normal text-slate-400">{t("(faol emas)")}</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {r.phone}
                    {!branchId ? ` · ${r.branch?.name ?? ""}` : ""}
                  </p>
                  {r.telegramId ? null : (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{t("Telegram yo'q")}</p>
                  )}

                  <details data-autoclose className="mt-1">
                    <summary className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                      ✎ {t("Tahrirlash")}
                    </summary>
                    <form
                      action={updateReception}
                      className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-900/60"
                    >
                      <input type="hidden" name="userId" value={r.id} />
                      <div>
                        <label className={label}>{t("F.I.Sh.")}</label>
                        <input name="fullName" defaultValue={r.fullName} className={input} required />
                      </div>
                      <div>
                        <label className={label}>{t("Telefon (login)")}</label>
                        <input name="phone" type="tel" defaultValue={r.phone} className={input} required />
                      </div>
                      {branches.length > 0 ? (
                        <div>
                          <label className={label}>{t("Filial")}</label>
                          <select name="branchId" defaultValue={r.branchId ?? ""} className={input}>
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <div>
                        <label className={label}>{t("Yangi parol")}</label>
                        <input
                          name="password"
                          type="text"
                          placeholder={t("o'zgartirmasangiz bo'sh qoldiring")}
                          className={input}
                        />
                      </div>
                      <div className="flex items-end">
                        <button type="submit" className={`${btnPrimary} w-full`}>
                          {t("Saqlash")}
                        </button>
                      </div>
                    </form>
                  </details>
                </div>
                <form action={toggleReceptionActive}>
                  <input type="hidden" name="userId" value={r.id} />
                  <button
                    type="submit"
                    className={
                      r.isActive
                        ? "text-xs text-slate-400 hover:text-rose-600"
                        : "text-xs font-semibold text-indigo-600 hover:underline"
                    }
                  >
                    {r.isActive ? t("bo'shatish") : t("qaytarish")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <details data-autoclose className="border-t border-slate-200 p-4 dark:border-slate-800">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">
            + {t("Qabulxona xodimi qo'shish")}
          </summary>
          <form action={createReception} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={label} htmlFor="rFullName">
                {t("F.I.Sh.")} *
              </label>
              <input id="rFullName" name="fullName" className={input} required />
            </div>
            <div>
              <label className={label} htmlFor="rPhone">
                {t("Telefon (login)")} *
              </label>
              <input
                id="rPhone"
                name="phone"
                type="tel"
                placeholder="+998901234567"
                className={input}
                required
              />
            </div>
            <div>
              <label className={label} htmlFor="rPassword">
                {t("Parol")} *
              </label>
              <input id="rPassword" name="password" type="text" className={input} required />
            </div>
            {branches.length > 0 ? (
              <div>
                <label className={label} htmlFor="rBranch">
                  {t("Filial")} *
                </label>
                <select id="rBranch" name="branchId" className={input} required>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="flex items-end">
              <button type="submit" className={`${btnPrimary} w-full`}>
                {t("Qo'shish")}
              </button>
            </div>
          </form>
        </details>
      </Card>
      ) : null}

      {kim === "nofaol" ? (
        <Card title={t("Faol bo'lmaganlar")} className="mt-5">
          {inactive.length === 0 ? <Empty>{t("Bo'shatilgan xodim yo'q.")}</Empty> : null}
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {inactive.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {s.user.fullName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {t(SPECIALIZATIONS[s.specialization as Specialization])} · {s.branch.name}
                  </p>
                </div>
                <form action={toggleSpecialistActive}>
                  <input type="hidden" name="specialistId" value={s.id} />
                  <button type="submit" className={btn}>
                    {t("Qaytarish")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
