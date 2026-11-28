import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SPECIALIZATIONS, type Specialization } from "@/lib/constants";
import { requireRole, NOT_SOLO } from "@/lib/auth";
import { num } from "@/lib/format";
import { monthRange } from "@/lib/stats";
import { getSettings, minutesToTime } from "@/lib/settings";
import {
  Avatar,
  BarRow,
  Card,
  KeyRow,
  Empty,
  PageHeader,
  btnPrimary,
  card,
  input,
  label,
} from "@/components/ui";
import { createBranch, deleteBranch, updateBranch } from "./actions";
import { getT } from "@/lib/i18n/server";

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  await requireRole("OWNER");
  const t = await getT();
  const sp = await searchParams;
  const { from, to } = monthRange();

  const [branches, settings] = await Promise.all([
    prisma.branch.findMany({
      where: NOT_SOLO,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { clients: true, specialists: true, intakes: true } },
      },
    }),
    getSettings(),
  ]);

  // Shu oydagi tushum — qaysi filial qancha ishlayotganini ko'rsatadi
  const income = await Promise.all(
    branches.map(async (b) => {
      const [pay, intake] = await Promise.all([
        prisma.payment.aggregate({
          where: { branchId: b.id, paidAt: { gte: from, lt: to } },
          _sum: { amount: true },
        }),
        prisma.intake.aggregate({
          where: { branchId: b.id, paidAt: { gte: from, lt: to } },
          _sum: { price: true },
        }),
      ]);
      return (pay._sum.amount ?? 0) + (intake._sum.price ?? 0);
    }),
  );

  // Ish vaqti: filialniki bo'lsa o'shaniki, bo'lmasa markazning umumiy vaqti
  const hoursOf = (b: (typeof branches)[number]) =>
    `${b.workStartHour ?? settings.workStartHour}:00 — ${b.workEndHour ?? settings.workEndHour}:00`;
  const lunchOf = (b: (typeof branches)[number]) => {
    const start = b.lunchStartMin ?? settings.lunchStartMin;
    const end = b.lunchEndMin ?? settings.lunchEndMin;
    return start != null && end != null ? `${minutesToTime(start)}–${minutesToTime(end)}` : null;
  };

  // O'ngdagi panel: filialning to'liq ma'lumoti va shu yerdagi xodimlar
  const selected = branches.find((b) => b.id === sp.f) ?? branches[0] ?? null;
  const selectedIndex = selected ? branches.indexOf(selected) : -1;
  const staff = selected
    ? await prisma.specialist.findMany({
        where: { branchId: selected.id, isActive: true },
        include: { user: { select: { fullName: true } } },
        orderBy: { specialization: "asc" },
        take: 8,
      })
    : [];

  // Ish kunlari: filialniki bo'lsa o'shaniki, bo'lmasa markazning
  const daysOf = (b: (typeof branches)[number]) => {
    const raw = (b.workDays ?? "").trim();
    const list = raw
      ? raw.split(",").map((x) => Number(x.trim())).filter((n) => n >= 1 && n <= 7)
      : settings.workDays;
    return list.length > 0 ? list : settings.workDays;
  };

  const maxClients = Math.max(1, ...branches.map((b) => b._count.clients));
  const maxIncome = Math.max(1, ...income);

  return (
    <>
      <PageHeader
        title={t("Filiallar")}
        subtitle={`${t("{n} ta filial", { n: branches.length })} · ${t("faqat ega qo'shadi va o'zgartiradi")}`}
      />

      <details data-autoclose className={`${card} mb-5 p-4`} open={branches.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">
          + {t("Yangi filial qo'shish")}
        </summary>
        <form action={createBranch} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={label} htmlFor="name">
              {t("Filial nomi")} *
            </label>
            <input
              id="name"
              name="name"
              placeholder={t("Chilonzor filiali")}
              className={input}
              required
            />
          </div>
          <div className="lg:col-span-2">
            <label className={label} htmlFor="address">
              {t("Manzil")}
            </label>
            <input id="address" name="address" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="phone">
              {t("Telefon")}
            </label>
            <input id="phone" name="phone" type="tel" className={input} />
          </div>
          <div className="flex items-end">
            <button type="submit" className={`${btnPrimary} w-full`}>
              {t("Qo'shish")}
            </button>
          </div>
        </form>
      </details>

      {branches.length === 0 ? (
        <Card>
          <Empty>{t("Hali filial qo'shilmagan.")}</Empty>
        </Card>
      ) : (
        /* Jadval emas, kartochka: filial — bitta joy, uning raqamlari bir
           kartada turgani o'qishga oson. Jadval esa filiallarni solishtirish
           uchun edi — u pastda, chiziqlar bilan */
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-4">
          {branches.map((b, i) => (
            <section key={b.id} data-testid="branch-card" className={`${card} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d="M4 21V7l8-4 8 4v14M4 21h16M9.5 21v-5h5v5M8.5 11h1m5 0h1" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      <Link href={`/branches?f=${b.id}`} className="hover:text-indigo-700 dark:hover:text-indigo-300">
                        {b.name}
                      </Link>
                    </h2>
                    {b.address ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{b.address}</p>
                    ) : null}
                    {b.phone ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500">{b.phone}</p>
                    ) : null}
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {hoursOf(b)}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4 dark:border-slate-800">
                <Stat label={t("Mijoz")} value={num(b._count.clients)} />
                <Stat label={t("Mutaxassis")} value={num(b._count.specialists)} />
                <Stat label={t("Qabul")} value={num(b._count.intakes)} />
                <Stat label={t("Shu oy tushum")} value={t.money(income[i])} accent />
              </dl>

              {lunchOf(b) ? (
                <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
                  {t("tushlik")} {lunchOf(b)}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <details data-autoclose className="min-w-0 flex-1">
                  <summary className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                    ✎ {t("Tahrirlash")}
                  </summary>
                  <form
                    action={updateBranch}
                    className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-900/60"
                  >
                    <input type="hidden" name="branchId" value={b.id} />
                    <div>
                      <label className={label}>{t("Nomi")}</label>
                      <input name="name" defaultValue={b.name} className={input} required />
                    </div>
                    <div>
                      <label className={label}>{t("Manzil")}</label>
                      <input name="address" defaultValue={b.address ?? ""} className={input} />
                    </div>
                    <div>
                      <label className={label}>{t("Telefon")}</label>
                      <input name="phone" defaultValue={b.phone ?? ""} className={input} />
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className={`${btnPrimary} w-full`}>
                        {t("Saqlash")}
                      </button>
                    </div>
                  </form>
                </details>
                <form action={deleteBranch}>
                  <input type="hidden" name="branchId" value={b.id} />
                  <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                    {t("o'chirish")}
                  </button>
                </form>
              </div>
            </section>
          ))}
        </div>

        {/* O'ngdagi panel: filialning to'liq ma'lumoti va shu yerdagi xodimlar */}
        <aside className="flex min-w-0 flex-col gap-4">
          {selected ? (
            <section className={`${card} p-5`} data-testid="branch-panel">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">
                  {selected.name}
                </h2>
                <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {hoursOf(selected)}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <KeyRow k={t("Manzil")} v={selected.address || "—"} />
                <KeyRow k={t("Telefon")} v={selected.phone || "—"} />
                <KeyRow k={t("Tushlik")} v={lunchOf(selected) ?? t("belgilanmagan")} />
                <KeyRow k={t("Mijoz")} v={num(selected._count.clients)} />
                <KeyRow k={t("Mutaxassis")} v={num(selected._count.specialists)} />
                <KeyRow
                  k={t("Shu oy tushum")}
                  v={t.money(selectedIndex >= 0 ? income[selectedIndex] : 0)}
                />
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {t("Ish kunlari")}
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                    const on = daysOf(selected).includes(d);
                    return (
                      <span
                        key={d}
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium ${
                          on
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                            : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                        }`}
                      >
                        {t.isoWeekday(d).slice(0, 2)}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                  {t("Ish vaqti Sozlamalardan olinadi — filialga alohida qo'yilmagan bo'lsa markazniki.")}
                </p>
              </div>

              {staff.length > 0 ? (
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {t("Shu filialdagi xodimlar")}
                    </span>
                    <Link
                      href="/specialists"
                      className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {t("Hammasi")} →
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {staff.map((x) => (
                      <div key={x.id} className="flex items-center gap-2.5">
                        <Avatar name={x.user.fullName} />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                            {x.user.fullName}
                          </span>
                          <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                            {t(SPECIALIZATIONS[x.specialization as Specialization])}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>
        </div>
      )}

      {branches.length > 1 ? (
        <Card
          title={t("Filiallarni solishtirish")}
          subtitle={t.monthYear(from)}
          className="mt-4"
        >
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("Mijoz")}
              </span>
              {branches.map((b) => (
                <BarRow
                  key={b.id}
                  label={b.name}
                  value={num(b._count.clients)}
                  part={b._count.clients / maxClients}
                  labelWidth="w-40"
                />
              ))}
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("Shu oy tushum")}
              </span>
              {branches.map((b, i) => (
                <BarRow
                  key={b.id}
                  label={b.name}
                  value={t.money(income[i])}
                  part={income[i] / maxIncome}
                  labelWidth="w-40"
                />
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {t("Filialni faqat bo'sh bo'lsa o'chirish mumkin. Ichida mijoz, mutaxassis yoki to'lov bo'lsa, o'chirish o'rniga nomini o'zgartiring.")}
      </p>
      <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
        {t("Yakka mutaxassislarning filiali bu ro'yxatda ko'rinmaydi — ular markazga tegishli emas.")}
      </p>
    </>
  );
}

/** Filial kartochkasidagi bitta raqam */
function Stat({
  label: labelText,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-slate-500 dark:text-slate-400">{labelText}</dt>
      <dd
        className={`mt-0.5 truncate text-base font-semibold tabular-nums ${
          accent ? "text-indigo-700 dark:text-indigo-300" : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
