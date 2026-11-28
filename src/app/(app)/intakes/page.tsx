import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, NOT_SOLO, branchWhere, isSolo } from "@/lib/auth";
import {
  INTAKE_RESULTS,
  INTAKE_RESULT_KEYS,
  INTAKE_RESULT_STYLE,
  INTAKE_STATUSES,
  INTAKE_STATUS_STYLE,
  PAYMENT_METHODS,
  PAYMENT_METHOD_KEYS,
  SPECIALIZATIONS,
  type IntakeResult,
  type IntakeStatus,
  type Specialization,
} from "@/lib/constants";
import { monthRange } from "@/lib/stats";
import { dateShort, num, timeUz, toDateInput, toDateTimeInput } from "@/lib/format";
import {
  Badge,
  Empty,
  KeyRow,
  PageHeader,
  StatCard,
  btn,
  btnPrimary,
  card,
  input,
  label,
} from "@/components/ui";
import {
  convertIntake,
  createIntake,
  deleteIntake,
  payIntake,
  setIntakeResult,
  setIntakeStatus,
  updateIntake,
} from "./actions";
import { BranchSpecialistFields } from "./branch-specialist";
import { getT } from "@/lib/i18n/server";

/** Jadvaldagi tugmalar uchun qisqa yozuv — to'liq nomi ustunga sig'maydi */
const SHORT_STATUS: Record<IntakeStatus, string> = {
  PLANNED: "rejada",
  DONE: "o'tdi",
  NO_SHOW: "kelmadi",
  CANCELLED: "bekor",
};

type Search = { m?: string; b?: string; q?: string };

export default async function IntakesPage({
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

  const [intakes, branches, specialists] = await Promise.all([
    prisma.intake.findMany({
      where: {
        scheduledAt: { gte: from, lt: to },
        ...branchWhere(branchId),
      },
      orderBy: { scheduledAt: "desc" },
      include: {
        branch: { select: { name: true } },
        specialist: {
          select: { specialization: true, user: { select: { fullName: true } } },
        },
        client: { select: { id: true, fullName: true } },
      },
    }),
    user.role === "OWNER"
      ? prisma.branch.findMany({ where: NOT_SOLO, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    prisma.specialist.findMany({
      // Egada branchId bo'sh — bo'sh obyekt begona yakka logopedni ham
      // qamrab olardi, shuning uchun doim branchWhere()
      where: { isActive: true, ...branchWhere(user.branchId) },
      include: { user: { select: { fullName: true } }, branch: { select: { name: true } } },
      orderBy: [{ branch: { name: "asc" } }, { user: { fullName: "asc" } }],
    }),
  ]);

  const paidSum = intakes.reduce((s, i) => s + (i.paidAt ? i.price : 0), 0);
  const unpaid = intakes.filter((i) => !i.paidAt && i.status === "DONE");
  const converted = intakes.filter((i) => i.result === "CONVERTED").length;
  const held = intakes.filter((i) => i.status === "DONE").length;

  // O'ngdagi panel: tanlanmagan bo'lsa birinchisi — panel bo'sh turmasin
  const selected = intakes.find((i) => i.id === sp.q) ?? intakes[0] ?? null;

  // Kanban: qabulning yo'li — rejada -> o'tdi -> mijoz bo'ldi
  const columns = [
    {
      id: "PLANNED",
      label: t("Rejada"),
      dot: "bg-slate-400",
      items: intakes.filter((i) => i.status === "PLANNED"),
    },
    {
      id: "DONE",
      label: t("O'tdi"),
      dot: "bg-emerald-600",
      items: intakes.filter((i) => i.status === "DONE" && i.result !== "CONVERTED"),
    },
    {
      id: "CONVERTED",
      label: t("Mijoz bo'ldi"),
      dot: "bg-indigo-600",
      items: intakes.filter((i) => i.result === "CONVERTED"),
    },
    {
      id: "CANCELLED",
      label: t("Kelmadi / bekor"),
      dot: "bg-amber-600",
      items: intakes.filter(
        (i) => (i.status === "NO_SHOW" || i.status === "CANCELLED") && i.result !== "CONVERTED",
      ),
    },
  ];

  // "Qayerdan kelgan": reklamani qayerga qo'yishni shu raqam aytadi
  const sourceCount = new Map<string, number>();
  for (const i of intakes) {
    const k = (i.source ?? "").trim();
    if (!k) continue;
    sourceCount.set(k, (sourceCount.get(k) ?? 0) + 1);
  }
  const sources = [...sourceCount.entries()]
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 6);
  const sourceMax = Math.max(1, ...sources.map((x) => x.v));

  // Tanlangan qabul URL'da turadi: sahifa yangilansa ham o'sha karta ochiq qoladi
  const qs2 = (id: string) => {
    const p = new URLSearchParams();
    if (offset !== 0) p.set("m", String(offset));
    if (sp.b) p.set("b", sp.b);
    p.set("q", id);
    return `/intakes?${p.toString()}`;
  };

  const qs = (o: number) => {
    const p = new URLSearchParams();
    if (o !== 0) p.set("m", String(o));
    if (sp.b) p.set("b", sp.b);
    const s = p.toString();
    return s ? `/intakes?${s}` : "/intakes";
  };

  return (
    <>
      <PageHeader
        title={t("Konsultatsiya uchun qabullar")}
        subtitle={`${t.monthYear(from)} · ${t("{n} ta qabul", { n: intakes.length })}`}
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("Qabullar")} value={num(intakes.length)} hint={t("{n} tasi bo'lib o'tdi", { n: held })} />
        <StatCard
          label={t("Mijoz bo'ldi")}
          value={num(converted)}
          hint={held > 0 ? `${Math.round((converted / held) * 100)}%` : t("hali yo'q")}
          tone={converted > 0 ? "good" : "default"}
        />
        <StatCard label={t("Konsultatsiyadan tushgan")} value={t.money(paidSum)} tone="good" />
        <StatCard
          label={t("To'lanmagan")}
          value={num(unpaid.length)}
          hint={t("o'tgan, lekin puli olinmagan")}
          tone={unpaid.length > 0 ? "bad" : "default"}
        />
      </div>

      <details data-autoclose className={`${card} mt-5 p-4`}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">
          + {t("Yangi qabul yozish")}
        </summary>
        <form action={createIntake} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={label} htmlFor="childName">
              {t("Bolaning F.I.Sh.")} *
            </label>
            <input id="childName" name="childName" className={input} required />
          </div>
          <div>
            <label className={label} htmlFor="birthDate">
              {t("Tug'ilgan sana")} *
            </label>
            <input id="birthDate" name="birthDate" type="date" className={input} required />
          </div>
          <div>
            <label className={label} htmlFor="parentName">
              {t("Ota-ona F.I.Sh.")} *
            </label>
            <input id="parentName" name="parentName" className={input} required />
          </div>
          <div>
            <label className={label} htmlFor="parentPhone">
              {t("Telefon")} *
            </label>
            <input
              id="parentPhone"
              name="parentPhone"
              type="tel"
              placeholder="+998901234567"
              className={input}
              required
            />
          </div>
          <div>
            <label className={label} htmlFor="scheduledAt">
              {t("Qabul vaqti")} *
            </label>
            <input
              id="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
              defaultValue={toDateTimeInput(new Date())}
              className={input}
              required
            />
          </div>
          {/* Yakka mutaxassisda "kim ko'radi" degan savol yo'q — doim o'zi (server ham shuni qo'yadi) */}
          {isSolo(user) ? null : (
          <BranchSpecialistFields
            branches={branches.map((b) => ({ id: b.id, name: b.name }))}
            specialists={specialists.map((x) => ({
              id: x.id,
              branchId: x.branchId,
              label: `${x.user.fullName} · ${t(SPECIALIZATIONS[x.specialization as Specialization])}`,
            }))}
          />
          )}
          <div>
            <label className={label} htmlFor="price">
              {t("Konsultatsiya narxi")}
            </label>
            <input
              id="price"
              name="price"
              inputMode="numeric"
              placeholder="150000"
              className={input}
            />
          </div>
          <div>
            <label className={label} htmlFor="source">
              {t("Qayerdan eshitdi")}
            </label>
            <input
              id="source"
              name="source"
              list="intake-sources"
              placeholder={t("Instagram, tavsiya, Telegram...")}
              className={input}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="note">
              {t("Izoh (shikoyat, kim tavsiya qilgan)")}
            </label>
            <input id="note" name="note" className={input} />
          </div>
          <div className="flex items-end">
            <button type="submit" className={`${btnPrimary} w-full`}>
              {t("Saqlash")}
            </button>
          </div>
        </form>
      </details>

      {/* Avval yozilgan manbalar — har safar qaytadan yozilmasin */}
      <datalist id="intake-sources">
        {sources.map((x) => (
          <option key={x.k} value={x.k} />
        ))}
      </datalist>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {/* Yo'l: rejada -> o'tdi -> mijoz bo'ldi. Ustunlar shu yo'lni ko'rsatadi */}
          <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {columns.map((col) => (
              <div key={col.id} className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                    {col.label}
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                    {col.items.length}
                  </span>
                </div>
                {col.items.length === 0 ? (
                  <span className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-600">
                    {t("bo'sh")}
                  </span>
                ) : (
                  col.items.map((i) => {
                    const on = selected?.id === i.id;
                    return (
                      <Link
                        key={i.id}
                        href={qs2(i.id)}
                        data-testid="intake-card"
                        className={`${card} flex flex-col gap-1.5 p-3 transition ${
                          on
                            ? "border-indigo-600 ring-[3px] ring-indigo-600/10 dark:border-indigo-700"
                            : "hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                            {i.childName}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                            {dateShort(i.scheduledAt)} {timeUz(i.scheduledAt)}
                          </span>
                        </span>
                        <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {i.specialist
                            ? `${i.specialist.user.fullName} · ${t(
                                SPECIALIZATIONS[i.specialist.specialization as Specialization],
                              )}`
                            : t("Hali aniq emas")}
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate rounded-full bg-slate-100 px-2 py-px text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {i.source?.trim() || t("manba yozilmagan")}
                          </span>
                          <span
                            className={`shrink-0 text-[11px] font-semibold tabular-nums ${
                              i.paidAt
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {i.price > 0 ? t.money(i.price) : "—"}
                          </span>
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            ))}
          </div>

      {/* Qabuldan mijozga: uchta raqamni yonma-yon qo'yganda "qayerda
            yo'qotyapmiz" ko'rinadi — kelmaganlarmi yoki kelib ketganlarmi */}
          <section className={`${card} p-5`}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t("Qabuldan mijozga")}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {held > 0
                  ? t("har {n} ta qabuldan 1 tasi mijoz bo'lgan", {
                      n: converted > 0 ? Math.max(1, Math.round(intakes.length / converted)) : intakes.length,
                    })
                  : t("hali natija yo'q")}
              </span>
            </div>
            <div className="flex items-end gap-3">
              {[
                { label: t("Qabul yozildi"), value: intakes.length },
                { label: t("Keldi"), value: held },
                { label: t("Mijoz bo'ldi"), value: converted },
              ].map((step) => {
                const part = intakes.length > 0 ? step.value / intakes.length : 0;
                return (
                  <div key={step.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                      {num(step.value)}
                    </span>
                    <span
                      className="w-full rounded-t-lg bg-indigo-600 dark:bg-indigo-500"
                      style={{ height: `${Math.max(6, Math.round(part * 86))}px`, opacity: 0.35 + part * 0.65 }}
                    />
                    <span className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
              {t("Konsultatsiya puli mijozga emas, qabulga yoziladi — mijoz bo'lmasa ham kassada qoladi.")}
            </p>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          {selected ? (
            <section className={`${card} p-5`} data-testid="intake-panel">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                  {dateShort(selected.scheduledAt)} · {timeUz(selected.scheduledAt)}
                </span>
                <Badge className={INTAKE_STATUS_STYLE[selected.status as IntakeStatus]}>
                  {t(INTAKE_STATUSES[selected.status as IntakeStatus])}
                </Badge>
              </div>
              <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                {selected.childName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.age(selected.birthDate)} · {selected.parentPhone}
              </p>

              <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <KeyRow k={t("Ota-ona")} v={selected.parentName} />
                <KeyRow
                  k={t("Kim ko'radi")}
                  v={
                    selected.specialist
                      ? `${selected.specialist.user.fullName} · ${t(
                          SPECIALIZATIONS[selected.specialist.specialization as Specialization],
                        )}`
                      : t("Hali aniq emas")
                  }
                />
                <KeyRow k={t("Qayerdan")} v={selected.source?.trim() || "—"} />
                <KeyRow k={t("Filial")} v={selected.branch.name} />
                <KeyRow
                  k={t("Konsultatsiya puli")}
                  v={
                    selected.paidAt
                      ? `${t.money(selected.price)} · ${t(
                          PAYMENT_METHODS[selected.method as keyof typeof PAYMENT_METHODS],
                        )}`
                      : t("olinmagan")
                  }
                />
              </div>

              {selected.note ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
                  {selected.note}
                </p>
              ) : null}

              {/* Konsultatsiya puli: qabulga yoziladi, mijozga emas */}
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                {selected.paidAt ? (
                  <form action={payIntake}>
                    <input type="hidden" name="intakeId" value={selected.id} />
                    <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                      {t("to'lovni qaytarish")}
                    </button>
                  </form>
                ) : (
                  <form action={payIntake} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="intakeId" value={selected.id} />
                    <div className="min-w-0 flex-1">
                      <label className={label}>{t("Konsultatsiya summasi")}</label>
                      <input
                        name="price"
                        inputMode="numeric"
                        defaultValue={selected.price || ""}
                        placeholder={t("summa")}
                        aria-label={t("Konsultatsiya summasi")}
                        className={input}
                      />
                    </div>
                    <select name="method" aria-label={t("To'lov usuli")} className={`${input} w-auto`}>
                      {PAYMENT_METHOD_KEYS.map((m) => (
                        <option key={m} value={m}>
                          {t(PAYMENT_METHODS[m])}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={btnPrimary}>
                      {t("To'landi")}
                    </button>
                  </form>
                )}
              </div>

              {/* Holat va natija: bir bosishda */}
              <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                {selected.client ? (
                  <Link
                    href={`/clients/${selected.client.id}`}
                    className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {t("Mijoz bo'ldi")} →
                  </Link>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {selected.status === "DONE" ? (
                        <form action={convertIntake}>
                          <input type="hidden" name="intakeId" value={selected.id} />
                          <button type="submit" className={btnPrimary}>
                            {t("Mijozga o'tkazish")}
                          </button>
                        </form>
                      ) : null}
                      {selected.status === "PLANNED"
                        ? (["DONE", "NO_SHOW", "CANCELLED"] as IntakeStatus[]).map((st) => (
                            <form key={st} action={setIntakeStatus}>
                              <input type="hidden" name="intakeId" value={selected.id} />
                              <input type="hidden" name="status" value={st} />
                              <button type="submit" className={btn}>
                                {t(SHORT_STATUS[st])}
                              </button>
                            </form>
                          ))
                        : null}
                    </div>
                    {selected.status === "PLANNED" ? (
                      // Kelmagan odamni mijoz qilib bo'lmaydi. Lekin tugma
                      // shunchaki yo'qolsa, uni qidirib ovora bo'ladi.
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {t("Mijozga o'tkazish uchun avval «o'tdi» deb belgilang")}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={INTAKE_RESULT_STYLE[selected.result as IntakeResult]}>
                        {t(INTAKE_RESULTS[selected.result as IntakeResult])}
                      </Badge>
                      {INTAKE_RESULT_KEYS.filter(
                        (r) => r !== "CONVERTED" && r !== selected.result,
                      ).map((r) => (
                        <form key={r} action={setIntakeResult}>
                          <input type="hidden" name="intakeId" value={selected.id} />
                          <input type="hidden" name="result" value={r} />
                          <button
                            type="submit"
                            className="text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400"
                          >
                            {t(INTAKE_RESULTS[r])}
                          </button>
                        </form>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <details data-autoclose>
                  <summary className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                    ✎ {t("Tahrirlash")}
                  </summary>
                  <form
                    action={updateIntake}
                    className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-900/60"
                  >
                    <input type="hidden" name="intakeId" value={selected.id} />
                    <div>
                      <label className={label}>{t("Bolaning F.I.Sh.")}</label>
                      <input name="childName" defaultValue={selected.childName} className={input} required />
                    </div>
                    <div>
                      <label className={label}>{t("Tug'ilgan sana")}</label>
                      <input
                        name="birthDate"
                        type="date"
                        defaultValue={toDateInput(selected.birthDate)}
                        className={input}
                        required
                      />
                    </div>
                    <div>
                      <label className={label}>{t("Ota-ona F.I.Sh.")}</label>
                      <input name="parentName" defaultValue={selected.parentName} className={input} required />
                    </div>
                    <div>
                      <label className={label}>{t("Telefon")}</label>
                      <input name="parentPhone" defaultValue={selected.parentPhone} className={input} required />
                    </div>
                    <div>
                      <label className={label}>{t("Qabul vaqti")}</label>
                      <input
                        name="scheduledAt"
                        type="datetime-local"
                        defaultValue={toDateTimeInput(selected.scheduledAt)}
                        className={input}
                        required
                      />
                    </div>
                    <div>
                      <label className={label}>{t("Kim ko'radi")}</label>
                      <select
                        name="specialistId"
                        defaultValue={selected.specialistId ?? ""}
                        className={input}
                      >
                        <option value="">{t("Hali aniq emas")}</option>
                        {specialists
                          .filter((x) => x.branchId === selected.branchId)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.user.fullName} ·{" "}
                              {t(SPECIALIZATIONS[x.specialization as Specialization])}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className={label}>{t("Konsultatsiya narxi")}</label>
                      <input
                        name="price"
                        inputMode="numeric"
                        defaultValue={selected.price || ""}
                        className={input}
                        disabled={Boolean(selected.paidAt)}
                      />
                      {selected.paidAt ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {t("To'langan — summani o'zgartirish uchun avval to'lovni qaytaring.")}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className={label}>{t("Qayerdan eshitdi")}</label>
                      <input
                        name="source"
                        list="intake-sources"
                        defaultValue={selected.source ?? ""}
                        className={input}
                      />
                    </div>
                    <div>
                      <label className={label}>{t("Izoh")}</label>
                      <input name="note" defaultValue={selected.note ?? ""} className={input} />
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className={`${btnPrimary} w-full`}>
                        {t("Saqlash")}
                      </button>
                    </div>
                  </form>
                </details>
                <form action={deleteIntake}>
                  <input type="hidden" name="intakeId" value={selected.id} />
                  <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                    {t("o'chirish")}
                  </button>
                </form>
              </div>
            </section>
          ) : (
            <section className={`${card} p-5`}>
              <Empty>{t("Bu oyda qabul yozilmagan.")}</Empty>
            </section>
          )}

          {/* Qayerdan kelgan: reklamani qayerga qo'yishni shu raqam aytadi */}
          {sources.length > 0 ? (
            <section className={`${card} p-5`}>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t("Qayerdan kelgan")}
              </h2>
              <div className="mt-3 flex flex-col gap-2.5">
                {sources.map((x) => (
                  <div key={x.k} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">
                      {x.k}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <span
                        className="block h-full rounded-full bg-indigo-600 dark:bg-indigo-500"
                        style={{ width: `${Math.round((x.v / sourceMax) * 100)}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {x.v}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
                {t("Reklamani qayerga qo'yishni shu raqam aytadi.")}
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
