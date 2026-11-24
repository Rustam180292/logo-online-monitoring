import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { branchExerciseScope, getPlanRows, type PlanRow } from "@/lib/program";
import { loadProgramClient } from "@/lib/program";
import {
  EXERCISE_AREAS,
  EXERCISE_RESULTS,
  EXERCISE_RESULT_STYLE,
  type ExerciseArea,
  type ExerciseResult,
} from "@/lib/constants";
import { dateShort } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, btn, btnPrimary, input, label } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { ClientTabs } from "../tabs";
import {
  addClientExercise,
  addGoal,
  removeClientExercise,
  removeGoal,
  setGoalDone,
  toggleHomework,
} from "../program-actions";

/**
 * Bolaning dasturi: 3 oylik maqsadlar va har bir maqsadga ishlaydigan
 * mashqlar. Mutaxassis "ertaga nima qilsam" degan savolga shu sahifadan
 * javob topadi — mashg'ulot rejasi shundan yig'iladi.
 */
export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client } = await loadProgramClient(id);
  const t = await getT();

  const [goals, rows, library] = await Promise.all([
    prisma.clientGoal.findMany({
      where: { clientId: client.id },
      orderBy: [{ isDone: "asc" }, { createdAt: "asc" }],
    }),
    getPlanRows(client.id),
    prisma.exercise.findMany({
      where: { ...branchExerciseScope(client.branch), isActive: true },
      orderBy: [{ area: "asc" }, { name: "asc" }],
      select: { id: true, name: true, area: true },
    }),
  ]);

  const inProgram = new Set(rows.map((r) => r.exerciseId));
  const free = library.filter((e) => !inProgram.has(e.id));
  const noGoal = rows.filter((r) => r.goalId === null);
  // Taklif: hali qilinmagan va eng uzoq vaqt qilinmagan mashqlar oldinda
  // (`getPlanRows` shu tartibda qaytaradi)
  const suggestion = rows.slice(0, 4);

  return (
    <>
      <PageHeader
        title={client.fullName}
        subtitle={t("Dastur · {n} ta maqsad · {m} ta mashq", { n: goals.length, m: rows.length })}
        action={
          <Link href={`/clients/${client.id}`} className={btn}>
            ← {t("Mijoz")}
          </Link>
        }
      />

      <ClientTabs clientId={client.id} active="program" />

      {goals.length === 0 && rows.length === 0 ? (
        <Card className="mb-5">
          <Empty>
            {t("Dastur hali tuzilmagan. Avval maqsad qo'ying, keyin unga mashq qo'shing.")}
          </Empty>
        </Card>
      ) : null}

      {goals.map((goal) => (
        <Card
          key={goal.id}
          title={goal.title}
          subtitle={
            goal.isDone
              ? t("bajarildi")
              : t("{n} ta mashq", { n: rows.filter((r) => r.goalId === goal.id).length })
          }
          className="mb-5"
          action={
            <div className="flex items-center gap-2">
              <form action={setGoalDone}>
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="goalId" value={goal.id} />
                <input type="hidden" name="isDone" value={goal.isDone ? "0" : "1"} />
                <button type="submit" className={btn}>
                  {goal.isDone ? t("Qaytarish") : t("Bajarildi")}
                </button>
              </form>
              <form action={removeGoal}>
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="goalId" value={goal.id} />
                <button
                  type="submit"
                  className="rounded-lg px-2 py-2 text-sm text-slate-400 hover:text-rose-600"
                  title={t("O'chirish")}
                  aria-label={t("O'chirish")}
                >
                  ✕
                </button>
              </form>
            </div>
          }
        >
          <ExerciseRows
            rows={rows.filter((r) => r.goalId === goal.id)}
            clientId={client.id}
            t={t}
          />
          <AddExerciseForm
            clientId={client.id}
            goalId={goal.id}
            free={free}
            t={t}
          />
        </Card>
      ))}

      {/* Maqsadga biriktirilmagan mashqlar ham dasturda bo'ladi: maqsad
          o'chirilsa mashqlar shu ro'yxatga tushadi */}
      <Card
        title={t("Maqsadsiz mashqlar")}
        subtitle={t("maqsadga biriktirilmagan — shunchaki dasturda")}
        className="mb-5"
      >
        <ExerciseRows rows={noGoal} clientId={client.id} t={t} />
        <AddExerciseForm clientId={client.id} goalId={null} free={free} t={t} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t("Yangi maqsad")} subtitle={t("3 oyga — baholashdan keyin qo'yiladi")}>
          <form action={addGoal} className="space-y-3 p-4">
            <input type="hidden" name="clientId" value={client.id} />
            <div>
              <label className={label} htmlFor="goal-title">
                {t("Maqsad")}
              </label>
              <input
                id="goal-title"
                name="title"
                placeholder={t("masalan: Faol so'z boyligi 20 taga yetsin")}
                className={input}
                required
              />
            </div>
            <button type="submit" className={btnPrimary}>
              + {t("Qo'shish")}
            </button>
          </form>
        </Card>

        <Card
          title={t("Keyingi mashg'ulotga taklif")}
          subtitle={t("uzoq vaqt qilinmagan mashqlar oldinda")}
        >
          {suggestion.length === 0 ? (
            <Empty>{t("Dasturda mashq yo'q.")}</Empty>
          ) : (
            <ol className="list-inside list-decimal space-y-1 p-4 text-sm text-slate-800 dark:text-slate-200">
              {suggestion.map((r) => (
                <li key={r.clientExerciseId}>
                  {r.name}
                  <span className="text-slate-400">
                    {" — "}
                    {r.lastAt
                      ? `${dateShort(r.lastAt)}${
                          r.lastResult
                            ? `, ${t(EXERCISE_RESULTS[r.lastResult as ExerciseResult]).toLowerCase()}`
                            : ""
                        }`
                      : t("hali qilinmagan")}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="px-4 pb-4 text-xs text-slate-400">
            {t("Bu majburiyat emas — taklif. Mutaxassis mashg'ulotda o'zgartira oladi.")}
          </p>
        </Card>
      </div>


      <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
        {t("Mashqlar markazning umumiy kutubxonasidan olinadi.")}{" "}
        <Link
          href="/exercises"
          className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {t("Mashqlar kutubxonasi")} →
        </Link>
      </p>
    </>
  );
}

function ExerciseRows({
  rows,
  clientId,
  t,
}: {
  rows: PlanRow[];
  clientId: string;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  if (rows.length === 0) return <Empty>{t("Mashq qo'shilmagan.")}</Empty>;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800" data-testid="program-rows">
      {rows.map((r) => (
        <li key={r.clientExerciseId} className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">{r.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(EXERCISE_AREAS[r.area as ExerciseArea])}
              {" · "}
              {r.lastAt ? t("oxirgi marta {d}", { d: dateShort(r.lastAt) }) : t("hali qilinmagan")}
            </p>
          </div>
          {r.lastResult ? (
            <Badge className={EXERCISE_RESULT_STYLE[r.lastResult as ExerciseResult]}>
              {t(EXERCISE_RESULTS[r.lastResult as ExerciseResult])}
            </Badge>
          ) : null}
          <form action={toggleHomework}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="clientExerciseId" value={r.clientExerciseId} />
            <button
              type="submit"
              className={
                r.homework
                  ? "rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800"
                  : "rounded-md px-2 py-0.5 text-xs text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700"
              }
              title={t("Uyga vazifa — ota-onaning kabinetida ko'rinadi")}
            >
              {t("uyga vazifa")}
            </button>
          </form>
          <form action={removeClientExercise}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="clientExerciseId" value={r.clientExerciseId} />
            <button
              type="submit"
              className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-rose-600"
              title={t("Dasturdan olish")}
              aria-label={t("Dasturdan olish")}
            >
              ✕
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

function AddExerciseForm({
  clientId,
  goalId,
  free,
  t,
}: {
  clientId: string;
  goalId: string | null;
  free: { id: string; name: string; area: string }[];
  t: Awaited<ReturnType<typeof getT>>;
}) {
  if (free.length === 0) {
    return (
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400 dark:border-slate-800">
        {t("Kutubxonadagi hamma mashq dasturda.")}
      </p>
    );
  }
  return (
    <details
      data-autoclose
      className="border-t border-slate-100 px-4 py-3 dark:border-slate-800"
    >
      <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">
        + {t("Mashq qo'shish")}
      </summary>
      <form action={addClientExercise} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="clientId" value={clientId} />
        {goalId ? <input type="hidden" name="goalId" value={goalId} /> : null}
        <select name="exerciseId" className={`${input} max-w-[320px]`} required>
          {free.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {t(EXERCISE_AREAS[e.area as ExerciseArea])}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" name="homework" className="h-4 w-4" />
          {t("uyga vazifa")}
        </label>
        <button type="submit" className={btnPrimary}>
          {t("Qo'shish")}
        </button>
      </form>
    </details>
  );
}
