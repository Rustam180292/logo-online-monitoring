import { getSessionTypes } from "@/lib/session-types";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, sessionScope, clientScope, branchWhere, NOT_SOLO } from "@/lib/auth";
import {
  SESSION_STATUSES,
  SESSION_STATUS_STYLE,
  SPECIALIZATIONS,
  type SessionStatus,
  type Specialization,
} from "@/lib/constants";
import { addDays, weekRange } from "@/lib/stats";
import { dateShort, timeUz } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import {
  Badge,
  Card,
  Empty,
  KeyRow,
  PageHeader,
  Segmented,
  btn,
  btnPrimary,
  card,
  input,
  label,
} from "@/components/ui";
import { createSession, deleteSession, setSessionStatus } from "./actions";
import { WeekGrid } from "./week-grid";

type Search = {
  w?: string;
  b?: string;
  s?: string;
  yangi?: string;
  kun?: string;
  bekor?: string;
  /** O'ngdagi panelda ochilgan seans */
  sid?: string;
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = await getT();
  const money = t.money;

  const offset = Number.parseInt(sp.w ?? "0", 10) || 0;
  const base = addDays(new Date(), offset * 7);
  const { from, to } = weekRange(base);

  // Ko'rinish: hafta (ustunlar — kunlar) yoki kun (ustunlar — mutaxassislar)
  const dayMode = sp.kun !== undefined && sp.kun !== "";
  const todayIndex = Math.min(6, Math.max(0, Math.round((new Date().getTime() - weekRange(base).from.getTime()) / 86_400_000)));
  const dayIndex = dayMode ? Math.min(6, Math.max(0, Number.parseInt(sp.kun ?? "", 10) || 0)) : todayIndex;
  // Bekor qilinganlar panjarani chalg'itadi — ularni yashirib qo'yish mumkin
  const hideCancelled = sp.bekor === "yoq";

  const canEdit = user.role !== "PARENT";
  const branchFilter =
    user.role === "OWNER" ? (sp.b || null) : user.branchId;
  const specialistFilter =
    user.role === "SPECIALIST" ? user.specialistId : (sp.s || null);

  const [sessions, branches, specialists, clients, sessionTypes, presetService] = await Promise.all([
    prisma.session.findMany({
      where: {
        ...sessionScope(user),
        startsAt: { gte: from, lt: to },
        ...(branchFilter ? { branchId: branchFilter } : {}),
        ...(specialistFilter ? { specialistId: specialistFilter } : {}),
      },
      orderBy: { startsAt: "asc" },
      include: {
        client: { select: { id: true, fullName: true } },
        specialist: { include: { user: { select: { fullName: true } } } },
        branch: { select: { name: true } },
        sessionType: { select: { name: true } },
      },
    }),
    user.role === "OWNER"
      ? prisma.branch.findMany({ where: NOT_SOLO, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    user.role === "PARENT" || user.role === "SPECIALIST"
      ? Promise.resolve([])
      : prisma.specialist.findMany({
          // Egada branchId bo'sh — bo'sh obyekt begona yakka logopedni ham
          // qamrab olardi, shuning uchun doim branchWhere()
          where: { isActive: true, ...branchWhere(user.branchId) },
          include: { user: { select: { fullName: true } }, branch: { select: { name: true } } },
          orderBy: { specialization: "asc" },
        }),
    canEdit
      ? prisma.client.findMany({
          where: { ...clientScope(user), status: "ACTIVE" },
          select: { id: true, fullName: true, branch: { select: { name: true } } },
          orderBy: [{ branch: { name: "asc" } }, { fullName: "asc" }],
        })
      : Promise.resolve([]),
    canEdit ? getSessionTypes(user) : Promise.resolve([]),
    // Mijoz kartasidagi "Seans yozish" dan kelinsa — uning xizmati oldindan tanlanadi
    sp.yangi
      ? prisma.clientService.findFirst({
          where: { clientId: sp.yangi, sessionType: { isActive: true } },
          orderBy: { createdAt: "asc" },
          select: { sessionTypeId: true },
        })
      : Promise.resolve(null),
  ]);

  // Mutaxassis o'ziga seans qo'shishi uchun ro'yxat
  const specialistOptions =
    user.role === "SPECIALIST"
      ? [{ id: user.specialistId!, name: `${user.fullName} (${t("men")})`, branchName: "" }]
      : specialists.map((s) => ({
          id: s.id,
          name: `${s.user.fullName} — ${t(SPECIALIZATIONS[s.specialization as Specialization])}`,
          branchName: s.branch.name,
        }));

  // Egasi barcha filiallarni ko'radi: ro'yxatlarni filial bo'yicha guruhlaymiz,
  // shunda turli filialdagi mijoz bilan mutaxassisni adashib tanlab qo'yilmaydi.
  const groupByBranch = <T extends { branchName: string }>(items: T[]) => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const list = map.get(item.branchName) ?? [];
      list.push(item);
      map.set(item.branchName, list);
    }
    return [...map.entries()];
  };

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.fullName,
    branchName: c.branch.name,
  }));
  const showGroups = user.role === "OWNER";

  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const visible = hideCancelled
    ? sessions.filter((x) => x.status !== "CANCELLED" && x.status !== "CANCELLED_CLIENT")
    : sessions;
  const byDay = new Map<string, typeof sessions>();
  for (const s of visible) {
    const key = dateShort(s.startsAt);
    const list = byDay.get(key) ?? [];
    list.push(s);
    byDay.set(key, list);
  }

  const todayKey = dateShort(new Date());
  // Chip ko'rinishidagi tanlov — filtrlar jadvalning ustida, tugmachalar qatorida
  const chipSelect =
    "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 " +
    "focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

  /** Manzilni qayta yig'adi: faqat berilgan qismi o'zgaradi */
  const link = (patch: Partial<Record<"w" | "b" | "s" | "kun" | "bekor" | "sid", string | null>>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      w: offset !== 0 ? String(offset) : undefined,
      b: sp.b || undefined,
      s: sp.s || undefined,
      kun: dayMode ? String(dayIndex) : undefined,
      bekor: hideCancelled ? "yoq" : undefined,
      sid: sp.sid || undefined,
    };
    for (const [k, v] of Object.entries({ ...base, ...patch })) {
      if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
    }
    const q = p.toString();
    return q ? `/schedule?${q}` : "/schedule";
  };
  const qs = (o: number) => link({ w: o === 0 ? null : String(o) });

  // O'ngdagi panel: katakni bosganda seansning tafsiloti va belgilash tugmalari
  const picked = visible.find((x) => x.id === sp.sid) ?? null;

  // "Shu hafta" raqamlari: belgilanmagan seans ish haqini ham, kassani ham
  // to'liq ko'rsatmaydi — shuning uchun alohida sanaladi
  const nowTs = Date.now();
  const weekStats = {
    planned: visible.filter((x) => x.status === "PLANNED").length,
    done: visible.filter((x) => x.status === "DONE").length,
    unmarked: visible.filter((x) => x.status === "PLANNED" && x.startsAt.getTime() < nowTs).length,
  };

  const done = visible.filter((s) => s.status === "DONE").length;
  const planned = visible.filter((s) => s.status === "PLANNED").length;

  return (
    <>
      <PageHeader
        title={t("Jadval")}
        subtitle={`${dateShort(from)} — ${dateShort(addDays(from, 6))} · ${t("{n} ta seans ({done} o'tdi, {planned} rejada)", { n: visible.length, done, planned })}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              items={[
                { href: link({ kun: null }), label: t("Hafta"), active: !dayMode },
                { href: link({ kun: String(dayIndex) }), label: t("Kun"), active: dayMode },
              ]}
            />
            {/* Hafta almashtirgich — bitta tugmachada: sarlavha qatori
                tugmalar bilan to'lib ketmasin */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
              <Link
                href={qs(offset - 1)}
                aria-label={t("O'tgan hafta")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                ‹
              </Link>
              <span className="whitespace-nowrap px-1.5 text-[13px] font-medium text-slate-800 dark:text-slate-200">
                {offset === 0 ? t("Bu hafta") : `${dateShort(from)} — ${dateShort(addDays(from, 6))}`}
              </span>
              <Link
                href={qs(offset + 1)}
                aria-label={t("Keyingi hafta")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                ›
              </Link>
            </div>
            {offset !== 0 ? (
              <Link href={qs(0)} className={btn}>
                {t("Bu haftaga qaytish")}
              </Link>
            ) : null}
            {canEdit && clients.length > 0 ? (
              <Link href="#yangi" className={btnPrimary}>
                + {t("Seans yozish")}
              </Link>
            ) : null}
          </div>
        }
      />

      {canEdit && clients.length > 0 ? (
        <details id="yangi" data-autoclose open={Boolean(sp.yangi)} className={`${card} mb-5 p-4`}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">
            + {t("Yangi seans qo'shish")}
          </summary>
          <form action={createSession} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label className={label} htmlFor="clientId">
                {t("Mijoz")}
              </label>
              {/* Mijoz oldindan tanlanmaydi (mijoz kartasidagi "Seans yozish"dan
                  kelgandagina o'sha mijoz tanlangan bo'ladi) — aks holda seans
                  e'tiborsiz birinchi turgan mijozga yozilib ketardi */}
              <select
                id="clientId"
                name="clientId"
                defaultValue={sp.yangi || ""}
                className={input}
                required
              >
                <option value="" disabled>
                  {t("Mijozni tanlang")}
                </option>
                {showGroups
                  ? groupByBranch(clientOptions).map(([branchName, items]) => (
                      <optgroup key={branchName} label={branchName}>
                        {items.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  : clientOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={label} htmlFor="specialistId">
                {t("Mutaxassis")}
              </label>
              <select
                id="specialistId"
                name="specialistId"
                className={input}
                required
                defaultValue={specialistOptions.length === 1 ? specialistOptions[0].id : ""}
              >
                {specialistOptions.length > 1 ? (
                  <option value="" disabled>
                    {t("Mutaxassisni tanlang")}
                  </option>
                ) : null}
                {showGroups
                  ? groupByBranch(specialistOptions).map(([branchName, items]) => (
                      <optgroup key={branchName} label={branchName}>
                        {items.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  : specialistOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="startsAt">
                {t("Sana va vaqt")}
              </label>
              <input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                className={input}
                required
              />
            </div>
            <div>
              <label className={label} htmlFor="durationMin">
                {t("Davomiyligi (daqiqa)")}
              </label>
              <input
                id="durationMin"
                name="durationMin"
                type="number"
                min={15}
                max={180}
                step={5}
                defaultValue={45}
                className={input}
              />
            </div>
            {sessionTypes.length > 0 ? (
              <div className="lg:col-span-2">
                <label className={label} htmlFor="sessionTypeId">
                  {t("Xizmat")}
                </label>
                {/* Tanlanmasa mijozga biriktirilgan xizmat olinadi */}
                <select
                  id="sessionTypeId"
                  name="sessionTypeId"
                  defaultValue={presetService?.sessionTypeId ?? ""}
                  className={input}
                >
                  <option value="">{t("— mijozning xizmati —")}</option>
                  {sessionTypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} · {money(st.price)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-amber-700 lg:col-span-2 dark:text-amber-400">
                {t("Seans yozish uchun avval Sozlamalarda xizmat qo'shing.")}
              </p>
            )}
            <div>
              <label className={label} htmlFor="note">
                {t("Izoh (ixtiyoriy)")}
              </label>
              <input id="note" name="note" className={input} placeholder={t("masalan: ota-ona bilan")} />
            </div>
            <div className="flex items-end">
              <button type="submit" className={`${btnPrimary} w-full`}>
                {t("Qo'shish")}
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {/* Avval butun hafta bir ekranda, keyin kunlik ro'yxat: panjara
          "qayerda teshik bor" ni, ro'yxat esa "nima qilish kerak" ni aytadi */}
      <div className="mb-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card
        title={dayMode ? t("Kun") : t("Hafta")}
        subtitle={
          dayMode
            ? `${t.weekday(days[dayIndex])}, ${dateShort(days[dayIndex])}`
            : t("ustunlar — kunlar, katakni bossangiz o'sha kunga tushadi")
        }
        className="mb-5"
        action={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-emerald-600" />
              {t("o'tdi")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-slate-300 dark:bg-slate-600" />
              {t("rejada")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-amber-600" />
              {t("kelmadi")}
            </span>
          </div>
        }
      >
        <div className="p-4" data-testid="week-grid">
          {/* Filtrlar panjaraning ustida, chip ko'rinishida: ular jadvalga
              tegishli, alohida kartada turishi shart emas */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(branches.length > 0 || specialists.length > 0) && user.role !== "PARENT" ? (
              <form method="get" className="flex flex-wrap items-center gap-2">
                {offset !== 0 ? <input type="hidden" name="w" value={offset} /> : null}
                {dayMode ? <input type="hidden" name="kun" value={dayIndex} /> : null}
                {hideCancelled ? <input type="hidden" name="bekor" value="yoq" /> : null}
                {branches.length > 0 ? (
                  <select
                    name="b"
                    defaultValue={sp.b ?? ""}
                    aria-label={t("Filial")}
                    className={chipSelect}
                  >
                    <option value="">{t("Barcha filiallar")}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {user.role !== "SPECIALIST" && specialists.length > 0 ? (
                  <select
                    name="s"
                    defaultValue={sp.s ?? ""}
                    aria-label={t("Mutaxassis")}
                    className={chipSelect}
                  >
                    <option value="">{t("Barcha mutaxassislar")}</option>
                    {specialists.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.user.fullName} — {t(SPECIALIZATIONS[x.specialization as Specialization])}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="submit"
                  className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  {t("Filtrlash")}
                </button>
              </form>
            ) : null}
            <Link
              href={link({ bekor: hideCancelled ? null : "yoq" })}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${
                hideCancelled
                  ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "border-slate-200 bg-white font-medium text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {t("Bekor qilinganlarsiz")}
            </Link>
          </div>
          <WeekGrid
            from={from}
            mode={dayMode ? "kun" : "hafta"}
            dayIndex={dayIndex}
            dayHref={(i) => link({ kun: String(i) })}
            chipHref={(id, i) => `${link({ sid: id, kun: dayMode ? undefined : String(i) })}#kun-${i}`}
            sessions={visible.map((s) => ({
              id: s.id,
              startsAt: s.startsAt,
              status: s.status,
              clientName: s.client.fullName,
              specialistId: s.specialistId,
              specialistName: s.specialist.user.fullName,
            }))}
          />
        </div>
      </Card>

      {/* O'ngdagi panel: katakni bosganda seans shu yerda ochiladi */}
      <aside className="flex min-w-0 flex-col gap-4">
        {picked ? (
          <section className={`${card} p-5`} data-testid="session-panel">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                {t.weekday(picked.startsAt)}, {dateShort(picked.startsAt)} · {timeUz(picked.startsAt)}
              </span>
              <Badge className={SESSION_STATUS_STYLE[picked.status as SessionStatus]}>
                {t(SESSION_STATUSES[picked.status as SessionStatus])}
              </Badge>
            </div>
            <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
              {picked.client.fullName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {picked.branch.name}
            </p>

            <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
              <KeyRow k={t("Mutaxassis")} v={picked.specialist.user.fullName} />
              <KeyRow k={t("Xizmat")} v={picked.sessionType?.name ?? "—"} />
              <KeyRow k={t("Narx")} v={t.money(picked.price)} />
              <KeyRow k={t("Davomiyligi")} v={t("{n} daqiqa", { n: picked.durationMin })} />
            </div>

            {picked.status === "PLANNED" ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <StatusButton id={picked.id} status="DONE" title={t("O'tdi")} tone="good" />
                <StatusButton id={picked.id} status="NO_SHOW" title={t("Kelmadi")} tone="warn" />
              </div>
            ) : null}

            <Link
              href={`/clients/${picked.clientId}`}
              className="mt-4 block text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {t("Mijoz kartasi")} →
            </Link>
          </section>
        ) : (
          <section className={`${card} p-5`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("Panjaradagi katakni bossangiz, seans shu yerda ochiladi.")}
            </p>
          </section>
        )}

        {/* Belgilanmagan seans ish haqini ham, kassani ham to'liq ko'rsatmaydi */}
        <section className={`${card} p-5`}>
          <p className="text-xs font-semibold text-slate-900 dark:text-white">{t("Shu hafta")}</p>
          <div className="mt-3 flex flex-col gap-2">
            <KeyRow k={t("Rejadagi seans")} v={String(weekStats.planned)} />
            <KeyRow k={t("O'tgan seans")} v={String(weekStats.done)} />
            <KeyRow
              k={t("Belgilanmagan")}
              v={
                <span
                  className={
                    weekStats.unmarked > 0
                      ? "font-semibold text-amber-600 dark:text-amber-400"
                      : "font-semibold text-slate-700 dark:text-slate-300"
                  }
                >
                  {weekStats.unmarked}
                </span>
              }
            />
          </div>
          {weekStats.unmarked > 0 ? (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
              {t("Belgilanmagan seans ish haqi va kassani to'liq ko'rsatmaydi — kun oxirida belgilang.")}
            </p>
          ) : null}
        </section>
      </aside>
      </div>

      <div className="space-y-4">
        {days.map((day, dayIndex) => {
          const key = dateShort(day);
          const list = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={key} id={`kun-${dayIndex}`} className="scroll-mt-20">
            <Card
              title={`${t.weekday(day)}, ${key}`}
              subtitle={isToday ? t("bugun") : undefined}
              className={isToday ? "ring-2 ring-indigo-500/30" : ""}
            >
              {list.length === 0 ? (
                <Empty>{t("Seans yo'q.")}</Empty>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="w-14 shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {timeUz(s.startsAt)}
                      </div>
                      <div className="min-w-[160px] flex-1">
                        <Link
                          href={`/clients/${s.client.id}`}
                          className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {s.client.fullName}
                        </Link>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {s.specialist.user.fullName} ·{" "}
                          {t(SPECIALIZATIONS[s.specialist.specialization as Specialization])}
                          {!branchFilter ? ` · ${s.branch.name}` : ""} · {t("{n} daq.", { n: s.durationMin })}
                        </p>
                        {s.sessionType ? (
                          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                            {s.sessionType.name}
                          </p>
                        ) : null}
                        {s.note ? (
                          <p className="text-xs text-slate-400">{s.note}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={SESSION_STATUS_STYLE[s.status as SessionStatus]}>
                          {t(SESSION_STATUSES[s.status as SessionStatus])}
                        </Badge>
                        {s.price > 0 ? (
                          <span className="text-xs text-slate-400">{money(s.price)}</span>
                        ) : null}
                      </div>

                      {canEdit ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {s.status === "PLANNED" ? (
                            <>
                              <StatusButton id={s.id} status="DONE" title={t("O'tdi")} tone="good" />
                              <StatusButton id={s.id} status="NO_SHOW" title={t("Kelmadi")} tone="bad" />
                              <StatusButton
                                id={s.id}
                                status="CANCELLED_CLIENT"
                                title={t("Bekor")}
                                tone="warn"
                              />
                              <form action={deleteSession}>
                                <input type="hidden" name="sessionId" value={s.id} />
                                <button
                                  type="submit"
                                  className="rounded-md px-2 py-1 text-xs text-slate-400 hover:text-rose-600"
                                  title={t("O'chirish")}
                                >
                                  ✕
                                </button>
                              </form>
                            </>
                          ) : (
                            <StatusButton id={s.id} status="PLANNED" title={t("Qaytarish")} tone="plain" />
                          )}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StatusButton({
  id,
  status,
  title,
  tone,
}: {
  id: string;
  status: SessionStatus;
  title: string;
  tone: "good" | "bad" | "warn" | "plain";
}) {
  const tones = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    bad: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
    warn: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    plain:
      "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  };
  return (
    <form action={setSessionStatus}>
      <input type="hidden" name="sessionId" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={`rounded-md border px-2 py-1 text-xs font-medium transition ${tones[tone]}`}
      >
        {title}
      </button>
    </form>
  );
}
