import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, sessionScope } from "@/lib/auth";
import { branchExerciseScope, canSeeProgram, getPlanRows } from "@/lib/program";
import {
  EXERCISE_AREAS,
  EXERCISE_RESULTS,
  EXERCISE_RESULT_KEYS,
  SESSION_STATUSES,
  type ExerciseArea,
  type ExerciseResult,
  type SessionStatus,
} from "@/lib/constants";
import { dateShort, timeUz } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { setSessionStatus } from "@/app/(app)/schedule/actions";
import { addSessionExercise, markSessionExercise } from "@/app/(app)/clients/[id]/program-actions";

/** Baholash shuncha kundan keyin eskiradi — 3 oy, dastur ham shu muddatga */
const ASSESSMENT_FRESH_DAYS = 90;

/**
 * Mashg'ulotning rejasi — mutaxassisning telefonidagi asosiy ekran.
 *
 * Maqsad: mutaxassis ertalab telefonini ochib, "bugun bu bola bilan nima
 * qilaman" degan savolga javob olishi va mashg'ulot vaqtida har bir mashqni
 * bir bosishda belgilashi. Shuning uchun reja dasturdan o'zi yig'iladi.
 */
export default async function SessionPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canSeeProgram(user)) notFound();
  const t = await getT();

  const session = await prisma.session.findFirst({
    where: { id, ...sessionScope(user) },
    include: {
      client: {
        select: {
          id: true,
          fullName: true,
          birthDate: true,
          diagnosis: true,
          branch: { select: { id: true, isSolo: true } },
        },
      },
      exercises: { select: { exerciseId: true, result: true } },
    },
  });
  if (!session) notFound();

  const [rows, goals, lastAssessment, library] = await Promise.all([
    getPlanRows(session.clientId, session.id),
    prisma.clientGoal.findMany({
      where: { clientId: session.clientId, isDone: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true },
    }),
    prisma.assessment.findFirst({
      where: { clientId: session.clientId },
      orderBy: { at: "desc" },
      select: { at: true },
    }),
    prisma.exercise.findMany({
      where: { ...branchExerciseScope(session.client.branch), isActive: true },
      orderBy: [{ area: "asc" }, { name: "asc" }],
      select: { id: true, name: true, area: true },
    }),
  ]);

  const marked = new Map(session.exercises.map((x) => [x.exerciseId, x.result]));
  const inProgram = new Set(rows.map((r) => r.exerciseId));
  // Rejadagi nechta mashq belgilangani (chiziqcha uchun)
  const markedCount = rows.filter((r) => marked.get(r.exerciseId)).length;
  const free = library.filter((e) => !inProgram.has(e.id));
  const assessmentAgeDays = lastAssessment
    ? Math.floor((Date.now() - lastAssessment.at.getTime()) / 86_400_000)
    : null;
  const needsAssessment = assessmentAgeDays === null || assessmentAgeDays > ASSESSMENT_FRESH_DAYS;

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{session.client.fullName}</p>
          <p className="text-xs app-muted">
            {dateShort(session.startsAt)} · {timeUz(session.startsAt)} ·{" "}
            {t(SESSION_STATUSES[session.status as SessionStatus])}
          </p>
        </div>
        <Link href="/m" className="app-card shrink-0 rounded-lg px-3 py-1.5 text-sm">
          ← {t("Kabinet")}
        </Link>
      </header>

      {goals.length > 0 ? (
        <div className="app-card mb-3 p-3">
          <p className="text-xs font-semibold">{t("Dastur maqsadi")}</p>
          <ul className="mt-1 space-y-0.5">
            {goals.map((g) => (
              <li key={g.id} className="text-sm">
                {g.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {needsAssessment ? (
        <Link
          href={`/clients/${session.clientId}/baholash/yangi`}
          className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-amber-100 p-3 text-sm text-amber-900"
        >
          <span>
            {assessmentAgeDays === null
              ? t("Bola hali baholanmagan")
              : t("Oxirgi baholash {n} kun oldin — yangilash vaqti keldi", { n: assessmentAgeDays })}
          </span>
          <span className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white">
            {t("Baholash")}
          </span>
        </Link>
      ) : null}

      <p className="mb-2 text-sm font-semibold">
        {t("Bugungi reja")}{" "}
        <span className="app-muted font-normal">· {t("dasturdan tanlandi")}</span>
      </p>

      {/* Qancha mashq belgilangani — mutaxassis mashg'ulot o'rtasida
          "yana nechtasi qoldi" deb ro'yxatni sanab chiqmasin */}
      {rows.length > 0 ? (
        <div className="mb-3 flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
            <span
              className="block h-full rounded-full bg-emerald-600"
              style={{ width: `${Math.round((markedCount / rows.length) * 100)}%` }}
            />
          </span>
          <span className="shrink-0 text-xs app-muted tabular-nums">
            {t("{done} / {all}", { done: markedCount, all: rows.length })}
          </span>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="app-card p-4 text-sm app-muted">
          {t("Dasturda mashq yo'q.")}{" "}
          <Link href={`/clients/${session.clientId}/dastur`} className="app-link font-medium">
            {t("Dastur")} →
          </Link>
        </div>
      ) : (
        <div className="space-y-3" data-testid="session-plan">
          {rows.map((r) => (
            <div key={r.clientExerciseId} className="app-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs app-muted">
                    {t(EXERCISE_AREAS[r.area as ExerciseArea])}
                    {r.goalTitle ? ` · ${r.goalTitle}` : ""}
                  </p>
                </div>
                {r.homework ? (
                  <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                    {t("uyga vazifa")}
                  </span>
                ) : null}
              </div>

              {r.description ? <p className="mt-2 text-sm">{r.description}</p> : null}
              <p className="mt-1 text-xs app-muted">
                {t("Oxirgi marta")}:{" "}
                {r.lastAt
                  ? `${dateShort(r.lastAt)}${
                      r.lastResult
                        ? ` · ${t(EXERCISE_RESULTS[r.lastResult as ExerciseResult]).toLowerCase()}`
                        : ""
                    }`
                  : t("hali qilinmagan")}
              </p>

              <div className="mt-3 flex gap-1.5">
                {EXERCISE_RESULT_KEYS.map((key) => {
                  const on = marked.get(r.exerciseId) === key;
                  return (
                    <form key={key} action={markSessionExercise} className="flex-1">
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="exerciseId" value={r.exerciseId} />
                      {/* Qayta bosilsa belgi olinadi — xato bosgan odam
                          boshqa yo'l qidirib o'tirmasin */}
                      <input type="hidden" name="result" value={on ? "" : key} />
                      <button
                        type="submit"
                        className={`w-full rounded-lg px-2 py-1.5 text-sm font-medium ${
                          on
                            ? key === "DONE"
                              ? "bg-emerald-600 text-white"
                              : key === "STRUGGLED"
                                ? "bg-amber-500 text-white"
                                : "bg-rose-600 text-white"
                            : "app-card border border-black/10"
                        }`}
                      >
                        {t(EXERCISE_RESULTS[key])}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {free.length > 0 ? (
        <details className="app-card mt-3 rounded-xl p-3">
          <summary className="cursor-pointer text-sm app-muted">
            + {t("Rejadan tashqari mashq")}
          </summary>
          <form action={addSessionExercise} className="mt-3 space-y-2">
            <input type="hidden" name="sessionId" value={session.id} />
            <select
              name="exerciseId"
              aria-label={t("Mashq")}
              className="app-card w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              required
            >
              {free.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {t(EXERCISE_AREAS[e.area as ExerciseArea])}
                </option>
              ))}
            </select>
            <button type="submit" className="app-accent w-full rounded-lg px-3 py-2 text-sm font-semibold">
              {t("Qo'shish")}
            </button>
          </form>
        </details>
      ) : null}

      {session.status === "PLANNED" ? (
        <form action={setSessionStatus} className="mt-4">
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="status" value="DONE" />
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white"
          >
            {t("Mashg'ulotni yakunlash")}
          </button>
          <p className="mt-2 px-1 text-center text-xs app-muted">
            {t("Yakunlanganda seans \"O'tdi\" bo'ladi va ish haqi hisoblanadi.")}
          </p>
        </form>
      ) : null}
    </main>
  );
}
