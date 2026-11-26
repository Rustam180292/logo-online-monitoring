import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { homePath, requireUser } from "@/lib/auth";
import { canSeeProgram, exerciseScope } from "@/lib/program";
import { EXERCISE_AREAS, EXERCISE_AREA_KEYS, type ExerciseArea } from "@/lib/constants";
import { Badge, Card, Empty, PageHeader, btn, btnPrimary, input, label } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { addExercise, removeExercise, updateExercise } from "./actions";

/**
 * Mashqlar kutubxonasi — markazning umumiy boyligi. Mutaxassis o'z mashqini
 * bir marta yozib qo'yadi, keyin uni istagan bolaning dasturiga qo'shadi.
 *
 * Qabulxona xodimi va ota-ona bu bo'limni ko'rmaydi (`canSeeProgram`).
 */
export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ yonalish?: string }>;
}) {
  const user = await requireUser();
  if (!canSeeProgram(user)) redirect(homePath(user));
  const t = await getT();

  const { yonalish } = await searchParams;
  const area = EXERCISE_AREA_KEYS.includes(yonalish as ExerciseArea)
    ? (yonalish as ExerciseArea)
    : null;

  const exercises = await prisma.exercise.findMany({
    where: { ...exerciseScope(user), isActive: true, ...(area ? { area } : {}) },
    orderBy: [{ area: "asc" }, { name: "asc" }],
    include: { _count: { select: { clients: { where: { isActive: true } } } } },
  });

  // Yo'nalish tugmalari — ilovadagi boshqa filtr tugmalari bilan bir xil
  const chip = (on: boolean) =>
    on
      ? "rounded-full border border-indigo-600 bg-indigo-50 px-3.5 py-1.5 text-[13px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
      : "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

  return (
    <>
      <PageHeader
        title={t("Mashqlar kutubxonasi")}
        subtitle={t("{n} ta mashq", { n: exercises.length })}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/exercises" className={chip(area === null)}>
          {t("Barchasi")}
        </Link>
        {EXERCISE_AREA_KEYS.map((a) => (
          <Link key={a} href={`/exercises?yonalish=${a}`} className={chip(area === a)}>
            {t(EXERCISE_AREAS[a])}
          </Link>
        ))}
      </div>

      <Card
        title={t("Mashqlar")}
        subtitle={t("bolaning dasturiga shu ro'yxatdan qo'shiladi")}
        className="mb-5"
      >
        {exercises.length === 0 ? (
          <Empty>{t("Hali mashq qo'shilmagan.")}</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800" data-testid="exercise-list">
            {exercises.map((e) => (
              <li key={e.id}>
                <details data-autoclose className="group">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
                    <span className="flex-1 text-sm font-medium text-slate-900 dark:text-white">
                      {e.name}
                    </span>
                    <Badge>{t(EXERCISE_AREAS[e.area as ExerciseArea])}</Badge>
                    {e.homework ? (
                      <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800">
                        {t("uyga vazifa")}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-slate-400">
                      {t("{n} bolada", { n: e._count.clients })}
                    </span>
                  </summary>

                  <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                    <ExerciseFields action={updateExercise} exercise={e} t={t} />
                    <form action={removeExercise} className="mt-3">
                      <input type="hidden" name="exerciseId" value={e.id} />
                      <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                        {t("Ro'yxatdan olish")}
                      </button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("Yangi mashq")} subtitle={t("bir marta yoziladi, hamma bolaga ishlatiladi")}>
        <div className="p-4" data-testid="exercise-new">
          <ExerciseFields action={addExercise} exercise={null} t={t} />
        </div>
      </Card>
    </>
  );
}

type ExerciseRow = {
  id: string;
  name: string;
  area: string;
  description: string | null;
  equipment: string | null;
  ageFrom: number | null;
  ageTo: number | null;
  homework: boolean;
};

/** Qo'shish va tahrirlash formasi bir xil — maydonlar bitta joyda tursin */
function ExerciseFields({
  action,
  exercise,
  t,
}: {
  action: (formData: FormData) => Promise<void>;
  exercise: ExerciseRow | null;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  const id = exercise ? `e${exercise.id}` : "new";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {exercise ? <input type="hidden" name="exerciseId" value={exercise.id} /> : null}
      <div>
        <label className={label} htmlFor={`${id}-name`}>
          {t("Mashq nomi")}
        </label>
        <input
          id={`${id}-name`}
          name="name"
          defaultValue={exercise?.name ?? ""}
          placeholder={t("masalan: Barmoq gimnastikasi")}
          className={input}
          required
        />
      </div>
      <div>
        <label className={label} htmlFor={`${id}-area`}>
          {t("Yo'nalish")}
        </label>
        <select
          id={`${id}-area`}
          name="area"
          defaultValue={exercise?.area ?? "FINE_MOTOR"}
          className={input}
        >
          {EXERCISE_AREA_KEYS.map((a) => (
            <option key={a} value={a}>
              {t(EXERCISE_AREAS[a])}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor={`${id}-description`}>
          {t("Qanday bajariladi")}
        </label>
        <textarea
          id={`${id}-description`}
          name="description"
          defaultValue={exercise?.description ?? ""}
          placeholder={t("qisqa: nima qilinadi, qancha marta")}
          className={`${input} h-20`}
        />
      </div>
      <div>
        <label className={label} htmlFor={`${id}-equipment`}>
          {t("Jihoz")}
        </label>
        <input
          id={`${id}-equipment`}
          name="equipment"
          defaultValue={exercise?.equipment ?? ""}
          placeholder={t("ixtiyoriy")}
          className={input}
        />
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className={label} htmlFor={`${id}-ageFrom`}>
            {t("Yoshi (dan)")}
          </label>
          <input
            id={`${id}-ageFrom`}
            name="ageFrom"
            inputMode="numeric"
            defaultValue={exercise?.ageFrom ?? ""}
            className={`${input} tabular-nums`}
          />
        </div>
        <div className="flex-1">
          <label className={label} htmlFor={`${id}-ageTo`}>
            {t("Yoshi (gacha)")}
          </label>
          <input
            id={`${id}-ageTo`}
            name="ageTo"
            inputMode="numeric"
            defaultValue={exercise?.ageTo ?? ""}
            className={`${input} tabular-nums`}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2 dark:text-slate-300">
        <input
          type="checkbox"
          name="homework"
          defaultChecked={exercise?.homework ?? false}
          className="h-4 w-4"
        />
        {t("Uyga vazifa sifatida ham berilsin")}
      </label>
      <div className="sm:col-span-2">
        <button type="submit" className={exercise ? btn : btnPrimary}>
          {exercise ? t("Saqlash") : `+ ${t("Qo'shish")}`}
        </button>
      </div>
    </form>
  );
}
