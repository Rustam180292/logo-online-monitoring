import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { homePath, requireUser } from "@/lib/auth";
import { canSeeProgram, exerciseScope } from "@/lib/program";
import {
  EXERCISE_AREAS,
  EXERCISE_AREA_KEYS,
  EXERCISE_RESULTS,
  type ExerciseArea,
  type ExerciseResult,
} from "@/lib/constants";
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
} from "@/components/ui";
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
  searchParams: Promise<{ yonalish?: string; q?: string; x?: string }>;
}) {
  const user = await requireUser();
  if (!canSeeProgram(user)) redirect(homePath(user));
  const t = await getT();

  const sp = await searchParams;
  const area = EXERCISE_AREA_KEYS.includes(sp.yonalish as ExerciseArea)
    ? (sp.yonalish as ExerciseArea)
    : null;
  const query = (sp.q ?? "").trim();

  // Hammasi bir so'rovda olinadi: yo'nalish tugmalaridagi sonlar ham,
  // ro'yxat ham shu ro'yxatdan chiqadi (ikki marta bazaga bormaymiz)
  const all = await prisma.exercise.findMany({
    where: { ...exerciseScope(user), isActive: true },
    orderBy: [{ area: "asc" }, { name: "asc" }],
    include: { _count: { select: { clients: { where: { isActive: true } } } } },
  });

  const exercises = all.filter(
    (e) =>
      (area === null || e.area === area) &&
      (query === "" ||
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        (e.description ?? "").toLowerCase().includes(query.toLowerCase())),
  );

  const selected = exercises.find((e) => e.id === sp.x) ?? exercises[0] ?? null;

  // O'ngdagi panel: mashq kimda turibdi va qanday ketyapti
  const [users, usedBy, history] = selected
    ? await Promise.all([
        selected.createdById
          ? prisma.user.findUnique({
              where: { id: selected.createdById },
              select: { fullName: true },
            })
          : Promise.resolve(null),
        prisma.clientExercise.findMany({
          where: { exerciseId: selected.id, isActive: true },
          take: 8,
          include: { client: { select: { id: true, fullName: true } } },
        }),
        prisma.sessionExercise.findMany({
          where: { exerciseId: selected.id },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: { result: true },
        }),
      ])
    : [null, [], []];

  const doneCount = history.filter((h) => h.result === "DONE").length;

  const link = (o: { yonalish?: string | null; x?: string }) => {
    const q = new URLSearchParams();
    const a = o.yonalish === undefined ? area : o.yonalish;
    if (a) q.set("yonalish", a);
    if (query) q.set("q", query);
    if (o.x) q.set("x", o.x);
    const x = q.toString();
    return x ? `/exercises?${x}` : "/exercises";
  };

  return (
    <>
      <PageHeader
        title={t("Mashqlar kutubxonasi")}
        subtitle={t("Markazning umumiy boyligi · {n} ta mashq", { n: all.length })}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Qidiruv: kutubxona kattalashganda nomdan topish tezroq */}
            <form action="/exercises" className="flex items-center gap-2">
              {area ? <input type="hidden" name="yonalish" value={area} /> : null}
              <input
                name="q"
                defaultValue={query}
                placeholder={t("Mashq qidirish")}
                aria-label={t("Mashq qidirish")}
                className={`${input} w-48`}
              />
              <button type="submit" className={btn}>
                {t("Qidirish")}
              </button>
            </form>
            <Link href="#yangi" className={btnPrimary}>
              + {t("Yangi mashq")}
            </Link>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href={link({ yonalish: null })} className={chip(area === null)}>
          {t("Barchasi")}
          <span className="ml-1.5 text-[11px] tabular-nums opacity-60">{all.length}</span>
        </Link>
        {EXERCISE_AREA_KEYS.map((a) => {
          const n = all.filter((e) => e.area === a).length;
          if (n === 0) return null;
          return (
            <Link key={a} href={link({ yonalish: a })} className={chip(area === a)}>
              {t(EXERCISE_AREAS[a])}
              <span className="ml-1.5 text-[11px] tabular-nums opacity-60">{n}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          {exercises.length === 0 ? (
            <Card>
              <Empty>
                {query ? t("«{q}» bo'yicha mashq topilmadi.", { q: query }) : t("Hali mashq qo'shilmagan.")}
              </Empty>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2" data-testid="exercise-list">
              {exercises.map((e) => {
                const on = selected?.id === e.id;
                return (
                  <li key={e.id} className="min-w-0">
                    <Link
                      href={link({ x: e.id })}
                      className={`${card} flex h-full flex-col p-4 transition ${
                        on
                          ? "border-indigo-600 ring-[3px] ring-indigo-600/10 dark:border-indigo-700"
                          : "hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-semibold text-slate-900 dark:text-white">
                          {e.name}
                        </span>
                        {e.homework ? (
                          <Badge className="shrink-0 bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800">
                            {t("uyga vazifa")}
                          </Badge>
                        ) : null}
                      </span>
                      {e.description ? (
                        <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {e.description}
                        </span>
                      ) : null}
                      <span className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-200 pt-3 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-px text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {t(EXERCISE_AREAS[e.area as ExerciseArea])}
                        </span>
                        {e.ageFrom || e.ageTo ? (
                          <span>
                            {t("{from}–{to} yosh", { from: e.ageFrom ?? "?", to: e.ageTo ?? "?" })}
                          </span>
                        ) : null}
                        <span className="ml-auto">{t("{n} bolada", { n: e._count.clients })}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          {selected ? (
            <section className={`${card} p-5`} data-testid="exercise-panel">
              <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                {t(EXERCISE_AREAS[selected.area as ExerciseArea])}
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                {selected.name}
              </h2>
              {selected.description ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {selected.description}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <KeyRow k={t("Jihoz")} v={selected.equipment?.trim() || t("Jihozsiz")} />
                <KeyRow
                  k={t("Yoshi")}
                  v={
                    selected.ageFrom || selected.ageTo
                      ? t("{from}–{to} yosh", { from: selected.ageFrom ?? "?", to: selected.ageTo ?? "?" })
                      : "—"
                  }
                />
                <KeyRow k={t("Hozir")} v={t("{n} bolada", { n: selected._count.clients })} />
                <KeyRow k={t("Uyga vazifa")} v={selected.homework ? t("ha") : t("yo'q")} />
              </div>

              {/* Qanday ketyapti: oxirgi belgilar — mashq ishlayaptimi yoki yo'q */}
              {history.length > 0 ? (
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {t("Qanday ketyapti")}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {t("oxirgi {n} tadan {done} tasida bajardi", {
                        n: history.length,
                        done: doneCount,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {[...history].reverse().map((h, i) => (
                      <span
                        key={i}
                        title={t(EXERCISE_RESULTS[h.result as ExerciseResult])}
                        className={`h-6 flex-1 rounded ${
                          h.result === "DONE"
                            ? "bg-emerald-500"
                            : h.result === "STRUGGLED"
                              ? "bg-amber-400"
                              : "bg-rose-400"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {usedBy.length > 0 ? (
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {t("Hozir kimda")}
                  </span>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {usedBy.map((u) => (
                      <Link
                        key={u.id}
                        href={`/clients/${u.client.id}/dastur`}
                        className="flex items-center gap-2 text-xs text-slate-700 hover:text-indigo-600 dark:text-slate-300"
                      >
                        <Avatar name={u.client.fullName} />
                        <span className="truncate">{u.client.fullName}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <details data-autoclose className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ✎ {t("Tahrirlash")}
                </summary>
                <div className="mt-3">
                  <ExerciseFields action={updateExercise} exercise={selected} t={t} />
                  <form action={removeExercise} className="mt-3">
                    <input type="hidden" name="exerciseId" value={selected.id} />
                    <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                      {t("Ro'yxatdan olish")}
                    </button>
                  </form>
                </div>
              </details>

              {users ? (
                <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-500">
                  {t("Qo'shgan: {name}", { name: users.fullName })}
                </p>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

      <Card
        id="yangi"
        title={t("Yangi mashq")}
        subtitle={t("bir marta yoziladi, hamma bolaga ishlatiladi")}
        className="mt-5"
      >
        <div className="p-4" data-testid="exercise-new">
          <ExerciseFields action={addExercise} exercise={null} t={t} />
        </div>
      </Card>
    </>
  );
}

// Yo'nalish tugmalari — ilovadagi boshqa filtr tugmalari bilan bir xil
const chip = (on: boolean) =>
  on
    ? "inline-flex items-center rounded-full border border-indigo-600 bg-indigo-50 px-3.5 py-1.5 text-[13px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
    : "inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

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
