import { getSessionTypes } from "@/lib/session-types";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, NOT_SOLO, branchWhere, isSolo } from "@/lib/auth";
import { SPECIALIZATIONS, type Specialization } from "@/lib/constants";
import { daySlots, getWorkHours, isWorkDay, minutesToTime } from "@/lib/settings";
import { addDays, startOfDay } from "@/lib/stats";
import { dateShort, timeUz } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { Avatar, BarRow, Empty, PageHeader, Segmented, btn, btnPrimary, card, input, label } from "@/components/ui";
import { createSession } from "@/app/(app)/schedule/actions";

type Search = { w?: string; sp?: string; d?: string; b?: string; daq?: string; t?: string };

/** Haftaning dushanbasi */
function mondayOf(date: Date): Date {
  const x = startOfDay(date);
  const shift = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - shift);
  return x;
}

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireRole("OWNER", "BRANCH_ADMIN", "RECEPTION");
  const sp = await searchParams;
  // Yakka logoped o'z ish vaqti bo'yicha ishlaydi, markaz — umumiy ish vaqti bo'yicha
  const settings = await getWorkHours(isSolo(user) ? user.branchId : null);
  const t = await getT();

  // Seans davomiyligi: markaz oralig'i standart, lekin qabulxona 30 yoki 60
  // daqiqalik joy ham qidiradi — bo'sh vaqtlar shunga qarab qaytadan hisoblanadi
  const durations = [30, 45, 60];
  const duration = durations.includes(Number(sp.daq)) ? Number(sp.daq) : settings.slotMinutes;

  const weekOffset = Number.parseInt(sp.w ?? "0", 10) || 0;
  const from = addDays(mondayOf(new Date()), weekOffset * 7);
  const to = addDays(from, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));

  const branchId = user.role === "OWNER" ? (sp.b || null) : user.branchId;

  const [specialists, sessions, branches, sessionTypes] = await Promise.all([
    prisma.specialist.findMany({
      where: { isActive: true, ...branchWhere(branchId) },
      include: { user: { select: { fullName: true } }, branch: { select: { name: true } } },
      orderBy: [{ branch: { name: "asc" } }, { user: { fullName: "asc" } }],
    }),
    prisma.session.findMany({
      where: {
        startsAt: { gte: from, lt: to },
        status: { in: ["PLANNED", "DONE"] },
        ...branchWhere(branchId),
      },
      select: { specialistId: true, startsAt: true, durationMin: true },
    }),
    user.role === "OWNER"
      ? prisma.branch.findMany({ where: NOT_SOLO, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    getSessionTypes(user),
  ]);

  /**
   * Band vaqtlar: mutaxassis + kun bo'yicha.
   *
   * Seans oralig'i bo'sh vaqt oralig'iga to'g'ri kelmasligi mumkin (45 daqiqalik
   * seans 60 daqiqalik oraliqda), shuning uchun kesishish bo'yicha tekshiriladi.
   */
  const busy = new Map<string, { start: number; end: number }[]>();
  for (const s of sessions) {
    const list = busy.get(s.specialistId) ?? [];
    list.push({
      start: s.startsAt.getTime(),
      end: s.startsAt.getTime() + s.durationMin * 60_000,
    });
    busy.set(s.specialistId, list);
  }

  const freeSlots = (specialistId: string, day: Date): Date[] => {
    const taken = busy.get(specialistId) ?? [];
    const length = duration * 60_000;
    const now = Date.now();
    return daySlots(day, settings, duration).filter((slot) => {
      const start = slot.getTime();
      if (start < now) return false; // o'tgan vaqtni taklif qilishning ma'nisi yo'q
      return !taken.some((t) => t.start < start + length && t.end > start);
    });
  };

  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (weekOffset !== 0) p.set("w", String(weekOffset));
    if (sp.b) p.set("b", sp.b);
    if (sp.sp) p.set("sp", sp.sp);
    if (sp.d) p.set("d", sp.d);
    if (sp.daq) p.set("daq", sp.daq);
    if (sp.t) p.set("t", sp.t);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const q = p.toString();
    return q ? `/slots?${q}` : "/slots";
  };

  // Tanlangan katak: mutaxassis + kun
  const picked =
    sp.sp && sp.d
      ? {
          specialist: specialists.find((x) => x.id === sp.sp) ?? null,
          day: startOfDay(new Date(sp.d)),
        }
      : null;

  const pickedSlots =
    picked?.specialist && !Number.isNaN(picked.day.getTime())
      ? freeSlots(picked.specialist.id, picked.day)
      : [];

  const clients =
    picked?.specialist
      ? await prisma.client.findMany({
          where: { status: "ACTIVE", branchId: picked.specialist.branchId },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
      : [];

  // Tanlangan kun: manzilda bo'lmasa — bugungi (hafta ichida bo'lsa)
  const todayIso = isoDay(new Date());
  const pickedDayIso = sp.d && days.some((d) => isoDay(d) === sp.d)
    ? sp.d
    : days.some((d) => isoDay(d) === todayIso)
      ? todayIso
      : isoDay(days[0]);
  const pickedDay = days.find((d) => isoDay(d) === pickedDayIso) ?? days[0];

  // Shu kundagi har bir mutaxassisning bo'sh vaqtlari
  const rows = specialists.map((x) => ({
    id: x.id,
    name: x.user.fullName,
    role: t(SPECIALIZATIONS[x.specialization as Specialization]),
    branchName: x.branch.name,
    branchId: x.branchId,
    slots: freeSlots(x.id, pickedDay),
  }));
  const freeToday = rows.reduce((n, r) => n + r.slots.length, 0);
  const maxFree = Math.max(1, ...rows.map((r) => r.slots.length));

  // Tanlangan vaqt: mutaxassis + soat
  const pickedTime = sp.t ?? null;
  const pickedRow = rows.find((r) => r.id === sp.sp) ?? null;
  const pickedSlot =
    pickedRow && pickedTime
      ? pickedRow.slots.find((slot) => timeUz(slot) === pickedTime) ?? null
      : null;

  return (
    <>
      <PageHeader
        title={t("Bo'sh vaqtlar")}
        subtitle={`${t.weekday(pickedDay)}, ${dateShort(pickedDay)} · ${t("{n} ta bo'sh vaqt ({min} daqiqa)", { n: freeToday, min: duration })}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              items={durations.map((d) => ({
                href: qs({ daq: String(d), t: null }),
                label: t("{n} daq", { n: d }),
                active: d === duration,
              }))}
            />
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
              <Link
                href={qs({ w: String(weekOffset - 1), sp: null, d: null, t: null })}
                aria-label={t("O'tgan hafta")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                ‹
              </Link>
              <span className="whitespace-nowrap px-1.5 text-[13px] font-medium text-slate-800 dark:text-slate-200">
                {weekOffset === 0 ? t("Shu hafta") : `${dateShort(from)} — ${dateShort(addDays(from, 6))}`}
              </span>
              <Link
                href={qs({ w: String(weekOffset + 1), sp: null, d: null, t: null })}
                aria-label={t("Keyingi hafta")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                ›
              </Link>
            </div>
            {weekOffset !== 0 ? (
              <Link href={qs({ w: "0", sp: null, d: null, t: null })} className={btn}>
                {t("Shu haftaga qaytish")}
              </Link>
            ) : null}
          </div>
        }
      />

      {/* Kunlar: har birida o'sha kundagi bo'sh vaqtlar soni — qabulxona
          "qaysi kun bo'shroq" degan savolga shu qatordan javob topadi */}
      <div className="mb-4 flex flex-wrap gap-2">
        {days.map((d) => {
          const on = isoDay(d) === pickedDayIso;
          const count = specialists.reduce((n, x) => n + freeSlots(x.id, d).length, 0);
          return (
            <Link
              key={isoDay(d)}
              href={qs({ d: isoDay(d), t: null })}
              className={`flex flex-col gap-0.5 rounded-xl border px-3.5 py-2 transition ${
                on
                  ? "border-indigo-600 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
              }`}
            >
              <span
                className={`text-xs font-semibold ${
                  on ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-200"
                }`}
              >
                {t.weekdayShort(d)} {d.getDate()}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {t("{n} ta bo'sh", { n: count })}
              </span>
            </Link>
          );
        })}
      </div>

      {branches.length > 0 ? (
        <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
          {weekOffset !== 0 ? <input type="hidden" name="w" value={weekOffset} /> : null}
          {sp.daq ? <input type="hidden" name="daq" value={sp.daq} /> : null}
          <input type="hidden" name="d" value={pickedDayIso} />
          <select
            name="b"
            defaultValue={sp.b ?? ""}
            aria-label={t("Filial")}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">{t("Barcha filiallar")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {t("Ko'rsatish")}
          </button>
        </form>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <section className={`${card} min-w-0 p-5 lg:col-span-2`}>
          {specialists.length === 0 ? (
            <Empty>{t("Mutaxassis yo'q. Avval Xodimlar bo'limidan qo'shing.")}</Empty>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t("Mutaxassislarning bo'sh vaqti")}
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("vaqtni bosing — o'ngdagi forma to'ladi")}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-start gap-3 py-3">
                    <span className="flex w-[190px] shrink-0 items-center gap-2.5">
                      <Avatar name={r.name} tone="muted" size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">
                          {r.name}
                        </span>
                        <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                          {r.role}
                          {branchId ? "" : ` · ${r.branchName}`}
                        </span>
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {r.slots.length === 0 ? (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {t("bo'sh vaqt yo'q")}
                        </span>
                      ) : (
                        r.slots.map((slot) => {
                          const on = sp.sp === r.id && pickedTime === timeUz(slot);
                          return (
                            <Link
                              key={slot.toISOString()}
                              href={qs({ sp: r.id, d: pickedDayIso, t: timeUz(slot) })}
                              data-vaqt={localInput(slot)}
                              className={`rounded-lg border px-2.5 py-1 text-xs tabular-nums transition ${
                                on
                                  ? "border-indigo-600 bg-indigo-600 font-semibold text-white"
                                  : "border-indigo-200 bg-indigo-50 font-medium text-indigo-700 hover:border-indigo-400 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
                              }`}
                            >
                              {timeUz(slot)}
                            </Link>
                          );
                        })
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-400 dark:border-slate-800 dark:text-slate-500">
                {t("Ish vaqti {from}:00–{to}:00", { from: settings.workStartHour, to: settings.workEndHour })}
                {settings.lunchStartMin != null && settings.lunchEndMin != null
                  ? ` · ${t("tushlik")} ${minutesToTime(settings.lunchStartMin)}–${minutesToTime(settings.lunchEndMin)} ${t("taklif qilinmaydi")}`
                  : ""}
                {". "}
                {t("O'tib ketgan vaqtlar sanalmaydi.")}
              </p>
            </>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <section className={`${card} p-5`} data-testid="slot-booking">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("Shu vaqtga yozish")}
            </h2>
            {!pickedRow || !pickedSlot ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {t("Chapdan bo'sh vaqtni tanlang.")}
              </p>
            ) : clients.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {t("Bu filialda faol mijoz yo'q.")}
              </p>
            ) : (
              <form action={createSession} className="mt-3.5 flex flex-col gap-3">
                <input type="hidden" name="specialistId" value={pickedRow.id} />
                <input type="hidden" name="startsAt" value={localInput(pickedSlot)} />
                <input type="hidden" name="durationMin" value={duration} />
                <div className="rounded-xl bg-indigo-50 p-3.5 dark:bg-indigo-950/60">
                  <p className="text-xl font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                    {timeUz(pickedSlot)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {t.weekday(pickedDay)}, {dateShort(pickedDay)} · {pickedRow.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t("{n} daqiqa", { n: duration })} · {pickedRow.role}
                  </p>
                </div>
                <div>
                  <label className={label} htmlFor="slotClient">
                    {t("Mijoz")} *
                  </label>
                  <select id="slotClient" name="clientId" className={input} required defaultValue="">
                    <option value="" disabled>
                      {t("Mijozni tanlang")}
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                {sessionTypes.length > 0 ? (
                  <div>
                    <label className={label} htmlFor="slotService">
                      {t("Xizmat")}
                    </label>
                    <select id="slotService" name="sessionTypeId" defaultValue="" className={input}>
                      <option value="">{t("— mijozning xizmati —")}</option>
                      {sessionTypes.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} · {t.money(st.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <button type="submit" className={btnPrimary}>
                  {t("Yozish")}
                </button>
                <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                  {t("Seans faqat xizmat bilan yoziladi — narx va mutaxassis ulushi shundan olinadi va seans bilan birga saqlanadi.")}
                </p>
              </form>
            )}
          </section>

          <section className={`${card} p-5`}>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("{day} bandligi", { day: `${t.weekdayShort(pickedDay)} ${pickedDay.getDate()}` })}
            </h2>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {rows.map((r) => (
                <BarRow
                  key={r.id}
                  label={r.name.split(" ")[0]}
                  value={t("{n} ta bo'sh", { n: r.slots.length })}
                  part={r.slots.length / maxFree}
                  tone={r.slots.length === 0 ? "warn" : "accent"}
                  labelWidth="w-20"
                />
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
              {t("Chiziq uzun bo'lsa — mutaxassisning kuni bo'sh.")}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}

/** Manzilga yoziladigan kun: 2026-10-07 */
function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** datetime-local uchun qiymat (mahalliy vaqt, UTC emas) */
function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
