"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clientScope, requireUser, sessionScope, type CurrentUser } from "@/lib/auth";
import { assertExerciseFitsBranch, canSeeProgram } from "@/lib/program";
import { parseAnswers } from "@/lib/assessment";
import { EXERCISE_RESULT_KEYS, type ExerciseResult } from "@/lib/constants";
import { withFlash } from "@/lib/action";
import { setFlash } from "@/lib/flash";

/**
 * Baholash va dastur amallari. Doira har bir amalda qaytadan tekshiriladi:
 * interfeysda tugma ko'rinmasligi yetarli emas — manzilni qo'lda yozish
 * yoki formani boshqa mijoz id'si bilan yuborish mumkin.
 */
async function ownClient(formData: FormData): Promise<{ user: CurrentUser; clientId: string; branchId: string }> {
  const user = await requireUser();
  if (!canSeeProgram(user)) throw new Error("Bu bo'lim sizga ochiq emas.");
  const id = String(formData.get("clientId") ?? "");
  const client = await prisma.client.findFirst({
    where: { id, ...clientScope(user) },
    select: { id: true, branchId: true },
  });
  if (!client) throw new Error("Mijoz topilmadi.");
  return { user, clientId: client.id, branchId: client.branchId };
}

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/dastur`);
  revalidatePath(`/clients/${clientId}/baholash`);
  revalidatePath("/m");
}

/* ---------------- Maqsadlar ---------------- */

async function addGoalImpl(formData: FormData) {
  const { user, clientId } = await ownClient(formData);
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3) throw new Error("Maqsadni yozing.");
  await prisma.clientGoal.create({ data: { clientId, title, createdById: user.id } });
  refresh(clientId);
  await setFlash("Maqsad qo'shildi.", "ok");
}

/** Begona bolaning maqsadiga tegib bo'lmasin */
async function ownGoal(formData: FormData) {
  const { user, clientId } = await ownClient(formData);
  const id = String(formData.get("goalId") ?? "");
  const goal = await prisma.clientGoal.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!goal) throw new Error("Maqsad topilmadi.");
  return { user, clientId, goalId: goal.id };
}

async function setGoalDoneImpl(formData: FormData) {
  const { clientId, goalId } = await ownGoal(formData);
  const isDone = String(formData.get("isDone")) === "1";
  await prisma.clientGoal.update({ where: { id: goalId }, data: { isDone } });
  refresh(clientId);
  await setFlash(isDone ? "Maqsad bajarilgan deb belgilandi." : "Maqsad qaytarildi.", "ok");
}

/**
 * Maqsad o'chsa, unga biriktirilgan mashqlar bolada qoladi (`onDelete:
 * SetNull`) — maqsadsiz ro'yxatga tushadi. Aks holda dastur jimgina
 * bo'shab qolardi.
 */
async function removeGoalImpl(formData: FormData) {
  const { clientId, goalId } = await ownGoal(formData);
  await prisma.clientGoal.delete({ where: { id: goalId } });
  refresh(clientId);
  await setFlash("Maqsad o'chirildi.", "ok");
}

/* ---------------- Bolaning mashqlari ---------------- */

async function addClientExerciseImpl(formData: FormData) {
  const { clientId, branchId } = await ownClient(formData);
  const exerciseId = String(formData.get("exerciseId") ?? "");
  await assertExerciseFitsBranch(exerciseId, branchId);

  const goalIdRaw = String(formData.get("goalId") ?? "").trim();
  let goalId: string | null = null;
  if (goalIdRaw !== "") {
    const goal = await prisma.clientGoal.findFirst({
      where: { id: goalIdRaw, clientId },
      select: { id: true },
    });
    if (!goal) throw new Error("Maqsad topilmadi.");
    goalId = goal.id;
  }

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { homework: true },
  });
  // Mashq kutubxonada "uyga vazifa" deb belgilangan bo'lsa, bolaga ham
  // shunday qo'shiladi — mutaxassis har safar qayta belgilamasin
  const homework = formData.get("homework") !== null || Boolean(exercise?.homework);

  // Allaqachon dasturda bo'lsa — o'chirilganini qaytaradi, ikkinchi yozuv qo'shmaydi
  await prisma.clientExercise.upsert({
    where: { clientId_exerciseId: { clientId, exerciseId } },
    create: { clientId, exerciseId, goalId, homework },
    update: { isActive: true, goalId, homework },
  });
  refresh(clientId);
  await setFlash("Mashq dasturga qo'shildi.", "ok");
}

async function ownClientExercise(formData: FormData) {
  const { clientId } = await ownClient(formData);
  const id = String(formData.get("clientExerciseId") ?? "");
  const row = await prisma.clientExercise.findFirst({ where: { id, clientId }, select: { id: true, homework: true } });
  if (!row) throw new Error("Mashq topilmadi.");
  return { clientId, row };
}

async function toggleHomeworkImpl(formData: FormData) {
  const { clientId, row } = await ownClientExercise(formData);
  await prisma.clientExercise.update({ where: { id: row.id }, data: { homework: !row.homework } });
  refresh(clientId);
  await setFlash(row.homework ? "Uyga vazifadan olindi." : "Uyga vazifa qilib belgilandi.", "ok");
}

/**
 * Dasturdan olinadi, lekin yozuv qoladi (`isActive = false`): o'tgan
 * mashg'ulotlarda shu mashq bajarilgani ko'rinib tursin.
 */
async function removeClientExerciseImpl(formData: FormData) {
  const { clientId, row } = await ownClientExercise(formData);
  await prisma.clientExercise.update({ where: { id: row.id }, data: { isActive: false } });
  refresh(clientId);
  await setFlash("Mashq dasturdan olindi.", "ok");
}

/* ---------------- Baholash ---------------- */

async function addAssessmentImpl(formData: FormData) {
  const { user, clientId } = await ownClient(formData);
  const answers = parseAnswers(formData);
  if (Object.keys(answers).length === 0) throw new Error("Hech bo'lmaganda bitta savolni belgilang.");

  const note = String(formData.get("note") ?? "").trim() || null;
  const shareWithParent = formData.get("shareWithParent") !== null;
  // Mutaxassis o'zi baholaydi; rahbar baholasa "kim" bo'sh qoladi
  const specialistId = user.specialistId ?? null;

  const assessment = await prisma.assessment.create({
    data: {
      clientId,
      specialistId,
      answers,
      note,
      shareWithParent,
      createdById: user.id,
    },
  });

  // Keyingi 3 oy maqsadlari — baholashning asosiy natijasi: dastur shundan
  // boshlanadi, shuning uchun bitta formada so'raladi
  const goals = formData
    .getAll("goal")
    .map((g) => String(g).trim())
    .filter((g) => g.length >= 3);
  if (goals.length > 0) {
    await prisma.clientGoal.createMany({
      data: goals.map((title) => ({
        clientId,
        title,
        assessmentId: assessment.id,
        createdById: user.id,
      })),
    });
  }

  refresh(clientId);
  await setFlash("Baholash saqlandi.", "ok");
  // Saqlagandan keyin forma emas, natija ko'rinsin: mutaxassis dinamikani
  // darhol ko'radi va "saqlandimi?" deb ikkilanmaydi
  redirect(`/clients/${clientId}/baholash`);
}

async function removeAssessmentImpl(formData: FormData) {
  const { user, clientId } = await ownClient(formData);
  const id = String(formData.get("assessmentId") ?? "");
  const found = await prisma.assessment.findFirst({ where: { id, clientId }, select: { id: true, createdById: true } });
  if (!found) throw new Error("Baholash topilmadi.");
  // O'zi yozganini o'zi o'chira oladi; boshqasining baholashini faqat rahbar
  const manager = user.role === "OWNER" || user.role === "BRANCH_ADMIN" || user.isSolo;
  if (!manager && found.createdById !== user.id) throw new Error("Bu baholashni o'chira olmaysiz.");
  await prisma.assessment.delete({ where: { id: found.id } });
  refresh(clientId);
  await setFlash("Baholash o'chirildi.", "ok");
}

/* ---------------- Mashg'ulotdagi natija ---------------- */

/**
 * Mutaxassis telefondan "Bajardi / Qiynaldi / Qila olmadi" ni bosadi.
 * Bitta mashqqa bitta natija: qayta bossa, oldingisi almashadi.
 */
async function markSessionExerciseImpl(formData: FormData) {
  const user = await requireUser();
  if (!canSeeProgram(user)) throw new Error("Bu bo'lim sizga ochiq emas.");
  const sessionId = String(formData.get("sessionId") ?? "");
  const session = await prisma.session.findFirst({
    where: { id: sessionId, ...sessionScope(user) },
    select: { id: true, clientId: true, branchId: true },
  });
  if (!session) throw new Error("Seans topilmadi.");

  const exerciseId = String(formData.get("exerciseId") ?? "");
  await assertExerciseFitsBranch(exerciseId, session.branchId);
  const result = String(formData.get("result") ?? "");

  if (result === "") {
    // Xato bosilsa — belgini olib tashlash
    await prisma.sessionExercise.deleteMany({ where: { sessionId: session.id, exerciseId } });
  } else {
    if (!EXERCISE_RESULT_KEYS.includes(result as ExerciseResult)) throw new Error("Natijani tanlang.");
    await prisma.sessionExercise.upsert({
      where: { sessionId_exerciseId: { sessionId: session.id, exerciseId } },
      create: { sessionId: session.id, exerciseId, result },
      update: { result },
    });
  }

  revalidatePath(`/m/mashgulot/${session.id}`);
  revalidatePath("/m");
  revalidatePath(`/clients/${session.clientId}/dastur`);
}

/**
 * Rejada yo'q mashqni mashg'ulot vaqtida qo'shish: bola boshqa narsaga
 * qiziqib qolsa, mutaxassis uni dasturga ham, shu seansga ham yozib qo'yadi.
 */
async function addSessionExerciseImpl(formData: FormData) {
  const user = await requireUser();
  if (!canSeeProgram(user)) throw new Error("Bu bo'lim sizga ochiq emas.");
  const sessionId = String(formData.get("sessionId") ?? "");
  const session = await prisma.session.findFirst({
    where: { id: sessionId, ...sessionScope(user) },
    select: { id: true, clientId: true, branchId: true },
  });
  if (!session) throw new Error("Seans topilmadi.");
  const exerciseId = String(formData.get("exerciseId") ?? "");
  await assertExerciseFitsBranch(exerciseId, session.branchId);

  await prisma.clientExercise.upsert({
    where: { clientId_exerciseId: { clientId: session.clientId, exerciseId } },
    create: { clientId: session.clientId, exerciseId },
    update: { isActive: true },
  });

  revalidatePath(`/m/mashgulot/${session.id}`);
  revalidatePath(`/clients/${session.clientId}/dastur`);
  await setFlash("Mashq qo'shildi.", "ok");
}

export const addGoal = withFlash(addGoalImpl);
export const setGoalDone = withFlash(setGoalDoneImpl);
export const removeGoal = withFlash(removeGoalImpl);
export const addClientExercise = withFlash(addClientExerciseImpl);
export const toggleHomework = withFlash(toggleHomeworkImpl);
export const removeClientExercise = withFlash(removeClientExerciseImpl);
export const addAssessment = withFlash(addAssessmentImpl);
export const removeAssessment = withFlash(removeAssessmentImpl);
export const markSessionExercise = withFlash(markSessionExerciseImpl);
export const addSessionExercise = withFlash(addSessionExerciseImpl);
