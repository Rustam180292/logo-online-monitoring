import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clientScope, isAdmin, isSolo, requireUser, type CurrentUser } from "@/lib/auth";

/**
 * Mashqlar kutubxonasining doirasi — xizmatlar (`SessionType`) bilan bir xil
 * qoida: markazning mashqlari bitta (branchId bo'sh, hamma filialga), yakka
 * mutaxassisning mashqlari faqat o'ziniki.
 */
export function exerciseScope(user: CurrentUser) {
  return isSolo(user) ? { branchId: user.branchId } : { branchId: null };
}

/** Mijozning filialiga mos mashqlar doirasi */
export function branchExerciseScope(branch: { id: string; isSolo: boolean }) {
  return branch.isSolo ? { branchId: branch.id } : { branchId: null };
}

/** Mashq shu filialning mijoziga ishlatilishi mumkinmi */
export async function assertExerciseFitsBranch(exerciseId: string, branchId: string) {
  const [exercise, branch] = await Promise.all([
    prisma.exercise.findUnique({ where: { id: exerciseId }, select: { branchId: true, isActive: true } }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { isSolo: true } }),
  ]);
  if (!exercise || !exercise.isActive) throw new Error("Mashq topilmadi.");
  const fits = branch?.isSolo ? exercise.branchId === branchId : exercise.branchId === null;
  if (!fits) throw new Error("Mashq topilmadi.");
}

/**
 * Baholash va dasturni kim ko'radi: rahbar (markaz egasi, filial admini,
 * yakka mutaxassis) va shu bolaga biriktirilgan mutaxassis.
 *
 * Qabulxona xodimi ko'rmaydi: bu bolaning tashxisi va xulqi haqidagi
 * ma'lumot, qabulxonaning ishi — jadval va to'lov. Google jadvalga ham
 * tushmaydi (`buildSheets`).
 */
export function canSeeProgram(user: CurrentUser) {
  return isAdmin(user) || isSolo(user) || user.role === "SPECIALIST";
}

/**
 * Dastur/baholash sahifalari uchun mijozni oladi. Doira ikki qatlam:
 * `clientScope` (mutaxassisga faqat o'z mijozi) va `canSeeProgram`
 * (qabulxonaga umuman yopiq). Topilmasa 404 — begona odam mijoz bor-yo'qligini
 * ham bilmasin.
 */
export async function loadProgramClient(id: string) {
  const user = await requireUser();
  if (!canSeeProgram(user)) notFound();
  const client = await prisma.client.findFirst({
    where: { id, ...clientScope(user) },
    include: { branch: { select: { id: true, name: true, isSolo: true } } },
  });
  if (!client) notFound();
  return { user, client };
}

/** Mashg'ulotga qaysi mashqlarni olish kerakligi haqida taklif uchun ma'lumot */
export type PlanRow = {
  clientExerciseId: string;
  exerciseId: string;
  goalId: string | null;
  name: string;
  area: string;
  description: string | null;
  homework: boolean;
  goalTitle: string | null;
  lastAt: Date | null;
  lastResult: string | null;
};

/**
 * Bolaning dasturidagi mashqlar, har biriga "oxirgi marta qachon va qanday
 * ketgan" qo'shilgan. Tartib — taklif tartibi: avval hali qilinmaganlar,
 * keyin eng uzoq vaqt qilinmaganlar. Shu bilan mutaxassis "ertaga nima
 * qilsam" degan savolga ro'yxatning boshidan javob topadi.
 *
 * `exceptSessionId` — mashg'ulot davom etayotgan seans. Uning o'z belgilari
 * hisobga olinmaydi: aks holda mutaxassis mashqni belgilagan zahoti u
 * "bugun qilingan" bo'lib ro'yxat oxiriga sakrab ketardi va "oxirgi marta"
 * deb o'zining hozirgi belgisi ko'rinardi.
 */
export async function getPlanRows(clientId: string, exceptSessionId?: string): Promise<PlanRow[]> {
  const except = exceptSessionId ?? "";
  const rows = await prisma.$queryRaw<PlanRow[]>`
    SELECT ce."id" AS "clientExerciseId", e."id" AS "exerciseId", e."name", e."area",
           e."description", ce."homework", ce."goalId", g."title" AS "goalTitle",
           last."at" AS "lastAt", last."result" AS "lastResult"
      FROM "ClientExercise" ce
      JOIN "Exercise" e ON e."id" = ce."exerciseId"
      LEFT JOIN "ClientGoal" g ON g."id" = ce."goalId"
      LEFT JOIN LATERAL (
        SELECT s."startsAt" AS "at", se."result"
          FROM "SessionExercise" se
          JOIN "Session" s ON s."id" = se."sessionId"
         WHERE se."exerciseId" = ce."exerciseId" AND s."clientId" = ce."clientId"
           AND s."id" <> ${except}
         ORDER BY s."startsAt" DESC
         LIMIT 1
      ) last ON true
     WHERE ce."clientId" = ${clientId} AND ce."isActive" = true
     ORDER BY last."at" ASC NULLS FIRST, e."name" ASC`;
  return rows;
}
