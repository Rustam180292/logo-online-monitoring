import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, NOT_SOLO, branchWhere } from "@/lib/auth";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_KEYS,
  type PaymentMethod,
} from "@/lib/constants";
import { dayRange, monthRange } from "@/lib/stats";
import { dateTimeUz, toDateInput } from "@/lib/format";
import {
  Badge,
  BarRow,
  Card,
  Empty,
  HeroStat,
  PageHeader,
  StatCard,
  btn,
  btnPrimary,
  card,
  input,
  label,
  td,
  th,
} from "@/components/ui";
import { addPayment, updatePayment } from "@/app/(app)/clients/actions";
import { getT } from "@/lib/i18n/server";

type Search = { m?: string; b?: string; pm?: string; q?: string; tab?: string };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireRole("OWNER", "BRANCH_ADMIN", "RECEPTION");
  const t = await getT();
  const sp = await searchParams;

  const offset = Number.parseInt(sp.m ?? "0", 10) || 0;
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const { from, to } = monthRange(base);

  const branchId = user.role === "OWNER" ? (sp.b || null) : user.branchId;
  const methodFilter = PAYMENT_METHOD_KEYS.includes(sp.pm as PaymentMethod)
    ? (sp.pm as PaymentMethod)
    : null;
  // Bitta bolaning to'lovlarini topish eng ko'p so'raladigan narsa
  const nameFilter = (sp.q ?? "").trim();
  // Ikki ro'yxat bir vaqtda ekranni egallamasin: bo'lim bo'lib almashadi
  const tab = sp.tab === "qabul" ? "qabul" : "tolov";

  const today = dayRange();
  const [payments, branches, clients, intakes, todayPays, todayIntakes] = await Promise.all([
    prisma.payment.findMany({
      where: {
        paidAt: { gte: from, lt: to },
        ...branchWhere(branchId),
        ...(methodFilter ? { method: methodFilter } : {}),
        ...(nameFilter
          ? { client: { fullName: { contains: nameFilter, mode: "insensitive" as const } } }
          : {}),
      },
      orderBy: { paidAt: "desc" },
      include: {
        client: { select: { id: true, fullName: true, status: true } },
        branch: { select: { name: true } },
      },
    }),
    user.role === "OWNER" ? prisma.branch.findMany({ where: NOT_SOLO, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.client.findMany({
      where: { status: "ACTIVE", ...branchWhere(branchId) },
      select: { id: true, fullName: true, branch: { select: { name: true } } },
      orderBy: [{ branch: { name: "asc" } }, { fullName: "asc" }],
    }),
    // Konsultatsiya puli ham kassaga tushadi — shu sahifada ko'rinishi kerak
    prisma.intake.findMany({
      where: {
        paidAt: { gte: from, lt: to },
        ...branchWhere(branchId),
        ...(methodFilter ? { method: methodFilter } : {}),
        ...(nameFilter
          ? { childName: { contains: nameFilter, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { paidAt: "desc" },
      include: {
        branch: { select: { name: true } },
        specialist: { select: { user: { select: { fullName: true } } } },
      },
    }),
    // "Bugungi kassa": kun davomida qaysi usulda qancha tushgani — qabulxona
    // kun oxirida pulni shu raqam bilan solishtiradi
    prisma.payment.groupBy({
      by: ["method"],
      where: { paidAt: { gte: today.from, lt: today.to }, ...branchWhere(branchId) },
      _sum: { amount: true },
    }),
    prisma.intake.groupBy({
      by: ["method"],
      where: { paidAt: { gte: today.from, lt: today.to }, ...branchWhere(branchId) },
      _sum: { price: true },
    }),
  ]);

  const intakeTotal = intakes.reduce((s, i) => s + i.price, 0);
  const total = payments.reduce((s, p) => s + p.amount, 0) + intakeTotal;
  const byMethod = PAYMENT_METHOD_KEYS.map((m) => ({
    method: m,
    sum:
      payments.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0) +
      intakes.filter((i) => i.method === m).reduce((s, i) => s + i.price, 0),
    // Summa yonida soni: "5 200 000" ning orqasida 2 ta katta to'lov turibdimi
    // yoki 40 ta kichikmi — bu boshqa-boshqa manzara
    count:
      payments.filter((p) => p.method === m).length +
      intakes.filter((i) => i.method === m).length,
  }));

  const todayByMethod = PAYMENT_METHOD_KEYS.map((m) => ({
    method: m,
    sum:
      (todayPays.find((x) => x.method === m)?._sum.amount ?? 0) +
      (todayIntakes.find((x) => x.method === m)?._sum.price ?? 0),
  }));
  const todayTotal = todayByMethod.reduce((n, x) => n + x.sum, 0);

  // Egasi barcha filiallarni ko'radi — ro'yxatni filial bo'yicha guruhlaymiz
  const clientGroups = new Map<string, typeof clients>();
  for (const c of clients) {
    const list = clientGroups.get(c.branch.name) ?? [];
    list.push(c);
    clientGroups.set(c.branch.name, list);
  }

  /** Mijoz ro'yxati: egasi hamma filialni ko'rsa — filial bo'yicha guruhlangan */
  const clientOptions = () =>
    user.role === "OWNER" && !branchId
      ? [...clientGroups.entries()].map(([branchName, items]) => (
          <optgroup key={branchName} label={branchName}>
            {items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </optgroup>
        ))
      : clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.fullName}
          </option>
        ));

  // Qabulxona xodimi faqat bugun kiritilgan to'lovni tuzata oladi (serverda ham tekshiriladi)
  const todayKey = new Date().toDateString();
  const canEditPayment = (p: (typeof payments)[number]) =>
    user.role !== "RECEPTION" || p.createdAt.toDateString() === todayKey;

  const qs = (o: number) => {
    const p = new URLSearchParams();
    p.set("m", String(o));
    if (sp.b) p.set("b", sp.b);
    if (sp.pm) p.set("pm", sp.pm);
    if (tab === "qabul") p.set("tab", "qabul");
    return `/payments?${p.toString()}`;
  };

  /** Bo'limni almashtirish: davr va filial saqlanadi, qidiruv tozalanadi */
  const qsTab = (id: string) => {
    const p = new URLSearchParams();
    if (offset !== 0) p.set("m", String(offset));
    if (sp.b) p.set("b", sp.b);
    if (id === "qabul") p.set("tab", "qabul");
    const q = p.toString();
    return q ? `/payments?${q}` : "/payments";
  };

  // Yuklab olinadigan fayl ham shu oy va shu filialga tegishli bo'lsin
  const csvQuery = (() => {
    const p = new URLSearchParams();
    if (offset !== 0) p.set("m", String(offset));
    if (sp.b) p.set("b", sp.b);
    const q = p.toString();
    return q ? `?${q}` : "";
  })();

  return (
    <>
      <PageHeader
        title={t("To'lovlar")}
        subtitle={`${t.monthYear(from)} · ${t("{n} ta to'lov", { n: payments.length })}${
          intakes.length > 0 ? ` · ${t("{n} ta konsultatsiya", { n: intakes.length })}` : ""
        }`}
        action={
          <div className="flex gap-2">
            <Link href={qs(offset - 1)} className={btn}>
              ← {t("O'tgan oy")}
            </Link>
            {offset !== 0 ? (
              <Link href={qs(0)} className={btn}>
                {t("Bu oy")}
              </Link>
            ) : null}
            {offset < 0 ? (
              <Link href={qs(offset + 1)} className={btn}>
                {t("Keyingi oy")} →
              </Link>
            ) : null}
          </div>
        }
      />

      {/* Kassa — sahifaning bitta asosiy raqami. Ostidagi chiziq mijoz
          to'lovlari bilan konsultatsiya pulining nisbatini ko'rsatadi:
          ikkisi ham kassaga tushadi, lekin bazada alohida turadi */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-9">
        <div className="sm:col-span-2 lg:col-span-3">
          <HeroStat
            label={t("Jami tushum")}
            value={t.money(total)}
            badge={t.monthYear(from)}
            hint={
              intakeTotal > 0
                ? t("{sum} konsultatsiyadan", { sum: t.money(intakeTotal) })
                : undefined
            }
          >
            {total > 0 ? (
              <div className="flex gap-2">
                <span
                  className="flex flex-col gap-1.5"
                  style={{ flex: Math.max(1, total - intakeTotal) }}
                >
                  <span className="h-1.5 rounded-full bg-white/90" />
                  <span className="text-[11px] text-white/70">{t("Mijoz to'lovlari")}</span>
                </span>
                {intakeTotal > 0 ? (
                  <span className="flex flex-col gap-1.5" style={{ flex: intakeTotal }}>
                    <span className="h-1.5 rounded-full bg-white/40" />
                    <span className="text-[11px] text-white/70">{t("Konsultatsiya")}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </HeroStat>
        </div>
        {byMethod.map((m) => (
          <div key={m.method} className="lg:col-span-2">
            <StatCard
              label={t(PAYMENT_METHODS[m.method])}
              value={t.money(m.sum)}
              hint={t("{n} ta to'lov", { n: m.count })}
            />
          </div>
        ))}
        {/* Maketdagi punktir kartochka: ro'yxatni Excel ochadigan faylga yuklash */}
        <a
          href={`/api/payments.csv${csvQuery}`}
          className="flex min-h-[126px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-[11px] leading-snug text-slate-500 transition hover:border-indigo-500 hover:text-indigo-600 lg:col-span-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
        >
          {t("Excel'ga yuklash")}
        </a>
      </div>


      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <section className={`${card} min-w-0 lg:col-span-2`}>
          {/* Mijoz to'lovlari va konsultatsiya puli — ikki alohida ro'yxat
              (bazada ham alohida), lekin bitta kartada bo'lim bo'lib almashadi */}
          <div className="flex flex-wrap gap-1 border-b border-slate-200 px-4 pt-2 dark:border-slate-800">
            {[
              { id: "tolov", label: t("Mijoz to'lovlari"), count: payments.length },
              { id: "qabul", label: t("Konsultatsiyalar"), count: intakes.length },
            ].map((x) => {
              const on = tab === x.id;
              return (
                <Link
                  key={x.id}
                  href={qsTab(x.id)}
                  className={`inline-flex items-center gap-2 px-3.5 pb-2.5 pt-1.5 text-[13px] transition ${
                    on
                      ? "font-semibold text-indigo-700 shadow-[inset_0_-2px_0] shadow-indigo-600 dark:text-indigo-300 dark:shadow-indigo-400"
                      : "font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  {x.label}
                  <span
                    className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${
                      on
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {x.count}
                  </span>
                </Link>
              );
            })}
          </div>

          <form
            method="get"
            className="flex flex-wrap items-end gap-2.5 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800"
          >
            <input type="hidden" name="m" value={offset} />
            {tab === "qabul" ? <input type="hidden" name="tab" value="qabul" /> : null}
            {branches.length > 0 ? (
              <div className="min-w-[150px]">
                <label className={label} htmlFor="b">
                  {t("Filial")}
                </label>
                <select id="b" name="b" defaultValue={sp.b ?? ""} className={input}>
                  <option value="">{t("Barchasi")}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="min-w-[140px]">
              <label className={label} htmlFor="pm">
                {t("To'lov usuli")}
              </label>
              <select id="pm" name="pm" defaultValue={sp.pm ?? ""} className={input}>
                <option value="">{t("Barchasi")}</option>
                {PAYMENT_METHOD_KEYS.map((m) => (
                  <option key={m} value={m}>
                    {t(PAYMENT_METHODS[m])}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[170px] flex-1">
              <label className={label} htmlFor="q">
                {t("Bola ismi")}
              </label>
              <input
                id="q"
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder={t("ism bo'yicha qidirish")}
                className={input}
              />
            </div>
            <button type="submit" className={btnPrimary}>
              {t("Filtrlash")}
            </button>
            {sp.q || sp.pm || sp.b ? (
              <Link href={qsTab(tab)} className={btn}>
                {t("Tozalash")}
              </Link>
            ) : null}
          </form>

          {tab === "tolov" ? (
            payments.length === 0 ? (
              <Empty>{t("Bu davrda to'lov yo'q.")}</Empty>
            ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className={th}>{t("Sana")}</th>
                    <th className={th}>{t("Mijoz")}</th>
                    {!branchId ? <th className={th}>{t("Filial")}</th> : null}
                    <th className={th}>{t("Usul")}</th>
                    <th className={th}>{t("Summa")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map((p) => (
                    <Fragment key={p.id}>
                    <tr>
                      <td className={`${td} tabular-nums`}>{dateTimeUz(p.paidAt)}</td>
                      <td className={td}>
                        <Link
                          href={`/clients/${p.client.id}`}
                          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {p.client.fullName}
                        </Link>
                        {p.note ? (
                          <span className="block max-w-[240px] truncate text-xs text-slate-400">{p.note}</span>
                        ) : null}
                      </td>
                      {!branchId ? <td className={td}>{p.branch.name}</td> : null}
                      <td className={td}>
                        <Badge>{t(PAYMENT_METHODS[p.method as PaymentMethod])}</Badge>
                      </td>
                      <td className={`${td} font-semibold tabular-nums`}>{t.money(p.amount)}</td>
                    </tr>
                    {canEditPayment(p) ? (
                      <tr>
                        <td colSpan={branchId ? 4 : 5} className="px-4 pb-2">
                          <details data-autoclose>
                            <summary className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                              ✎ {t("Tahrirlash")}
                            </summary>
                            <form
                              action={updatePayment}
                              data-testid="payment-edit-form"
                              className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-5 dark:bg-slate-900/60"
                            >
                              <input type="hidden" name="paymentId" value={p.id} />
                              <div className="lg:col-span-2">
                                <label className={label}>{t("Mijoz")}</label>
                                <select name="clientId" defaultValue={p.client.id} className={input} required>
                                  {/* Faol bo'lmagan mijoz ro'yxatda yo'q — uni ham tanlangan holda ko'rsatamiz */}
                                  {clients.some((c) => c.id === p.client.id) ? null : (
                                    <option value={p.client.id}>{p.client.fullName}</option>
                                  )}
                                  {clientOptions()}
                                </select>
                              </div>
                              <div>
                                <label className={label}>{t("Summa ({currency})", { currency: t.currency })}</label>
                                <input
                                  name="amount"
                                  inputMode="numeric"
                                  defaultValue={p.amount}
                                  className={input}
                                  required
                                />
                              </div>
                              <div>
                                <label className={label}>{t("Usul")}</label>
                                <select name="method" defaultValue={p.method} className={input}>
                                  {PAYMENT_METHOD_KEYS.map((m) => (
                                    <option key={m} value={m}>
                                      {t(PAYMENT_METHODS[m])}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className={label}>{t("Sana")}</label>
                                <input
                                  name="paidAt"
                                  type="date"
                                  defaultValue={toDateInput(p.paidAt)}
                                  className={input}
                                />
                              </div>
                              <div className="sm:col-span-2 lg:col-span-4">
                                <label className={label}>{t("Izoh")}</label>
                                <input name="note" defaultValue={p.note ?? ""} className={input} />
                              </div>
                              <div className="flex items-end">
                                <button type="submit" className={`${btnPrimary} w-full`}>
                                  {t("Saqlash")}
                                </button>
                              </div>
                            </form>
                          </details>
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            )
          ) : intakes.length === 0 ? (
            <Empty>{t("Bu davrda konsultatsiya puli yo'q.")}</Empty>
          ) : (
<div className="scroll-x">
              <table className="w-full min-w-[620px]">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className={th}>{t("Sana")}</th>
                    <th className={th}>{t("Bola")}</th>
                    <th className={th}>{t("Kim ko'rdi")}</th>
                    {!branchId ? <th className={th}>{t("Filial")}</th> : null}
                    <th className={th}>{t("Usul")}</th>
                    <th className={th}>{t("Summa")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {intakes.map((i) => (
                    <tr key={i.id}>
                      <td className={`${td} whitespace-nowrap`}>{dateTimeUz(i.paidAt!)}</td>
                      <td className={td}>{i.childName}</td>
                      <td className={td}>
                        {i.specialist?.user.fullName ?? (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      {!branchId ? <td className={td}>{i.branch.name}</td> : null}
                      <td className={td}>
                        <Badge>{t(PAYMENT_METHODS[i.method as PaymentMethod])}</Badge>
                      </td>
                      <td className={`${td} font-semibold tabular-nums`}>{t.money(i.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="border-t border-slate-200 px-5 py-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {tab === "tolov"
              ? t("To'lov mijozdan markazga keladi — mutaxassisga bog'lanmaydi. Mutaxassisning ish haqi to'lovdan emas, bajarilgan seansdan hisoblanadi.")
              : t("Konsultatsiya puli mijozga emas, qabulga yoziladi (qabul hali mijoz emas), lekin kassaga va hisobotga qo'shiladi.")}
          </p>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          {/* Tez to'lov doim ochiq turadi: qabulxona kun bo'yi shu formadan
              foydalanadi, har safar bo'lim ochib o'tirmasin */}
          <section className={`${card} p-5`} data-testid="quick-payment">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("Tez to'lov")}
            </h2>
            {clients.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {t("Avval mijoz qo'shing.")}
              </p>
            ) : (
              <form action={addPayment} className="mt-3.5 flex flex-col gap-3">
                <div>
                  <label className={label} htmlFor="clientId">
                    {t("Mijoz")} *
                  </label>
                  {/* Bo'sh tanlov bilan boshlanadi: oldindan birinchi mijoz tanlanib
                      tursa, e'tibor berilmasa pul o'shanga yozilib ketardi */}
                  <select id="clientId" name="clientId" className={input} required defaultValue="">
                    <option value="" disabled>
                      {t("Mijozni tanlang")}
                    </option>
                    {clientOptions()}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="amount">
                    {t("Summa ({currency})", { currency: t.currency })} *
                  </label>
                  <input
                    id="amount"
                    name="amount"
                    inputMode="numeric"
                    placeholder="500000"
                    className={input}
                    required
                  />
                </div>
                <div>
                  <span className={label}>{t("Qanday keldi")}</span>
                  <div className="flex gap-1.5">
                    {PAYMENT_METHOD_KEYS.map((m, i) => (
                      <label
                        key={m}
                        className="flex-1 cursor-pointer rounded-xl border border-slate-300 px-2 py-2 text-center text-xs font-medium text-slate-600 transition has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50 has-[:checked]:font-semibold has-[:checked]:text-indigo-700 dark:border-slate-700 dark:text-slate-300 dark:has-[:checked]:bg-indigo-950 dark:has-[:checked]:text-indigo-300"
                      >
                        <input
                          type="radio"
                          name="method"
                          value={m}
                          defaultChecked={i === 0}
                          className="sr-only"
                        />
                        {t(PAYMENT_METHODS[m])}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={label} htmlFor="paidAt">
                    {t("Sana")}
                  </label>
                  <input
                    id="paidAt"
                    name="paidAt"
                    type="date"
                    defaultValue={toDateInput(new Date())}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="note">
                    {t("Izoh")}
                  </label>
                  <input id="note" name="note" className={input} placeholder={t("ixtiyoriy")} />
                </div>
                <button type="submit" className={btnPrimary}>
                  {t("Qabul qilish")}
                </button>
                <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                  {t("Saqlangach yashil xabar chiqadi — to'lov ro'yxatdan boshqa oyga o'tib ketsa ham bilinadi.")}
                </p>
              </form>
            )}
          </section>

          <section className={`${card} p-5`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t("Bugungi kassa")}
              </h2>
              <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {t.money(todayTotal)}
              </span>
            </div>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {todayByMethod.map((m) => (
                <BarRow
                  key={m.method}
                  label={t(PAYMENT_METHODS[m.method])}
                  value={t.money(m.sum)}
                  part={todayTotal > 0 ? m.sum / todayTotal : 0}
                  labelWidth="w-20"
                />
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
              {t("Konsultatsiya puli ham shu yerda — kassaga u ham tushadi.")}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
