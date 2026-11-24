"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canSeeProgram, exerciseScope } from "@/lib/program";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { withFlash } from "@/lib/action";
import { setFlash } from "@/lib/flash";
import { EXERCISE_AREA_KEYS, type ExerciseArea } from "@/lib/constants";

/**
 * Kutubxonani mutaxassislarning o'zi to'ldiradi — mashq kimdir bir marta
 * yozib qo'ysa, markazda qoladi. Qabulxona xodimiga va ota-onaga yopiq.
 */
async function requireExerciseUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canSeeProgram(user)) throw new Error("Bu bo'lim sizga ochiq emas.");
  return user;
}

function exerciseFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Mashq nomini yozing.");
  const area = String(formData.get("area") ?? "");
  if (!EXERCISE_AREA_KEYS.includes(area as ExerciseArea)) throw new Error("Yo'nalishni tanlang.");

  const text = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v === "" ? null : v;
  };
  // Yosh ixtiyoriy: kutubxonani saralashga yordam beradi, majburiy emas
  const age = (key: string) => {
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 18) throw new Error("Yosh 0 dan 18 gacha bo'lishi kerak.");
    return n;
  };
  const ageFrom = age("ageFrom");
  const ageTo = age("ageTo");
  if (ageFrom !== null && ageTo !== null && ageFrom > ageTo) {
    throw new Error("Yosh oralig'i teskari yozilgan.");
  }

  return {
    name,
    area,
    description: text("description"),
    equipment: text("equipment"),
    ageFrom,
    ageTo,
    homework: formData.get("homework") !== null,
  };
}

/** Begona markazning (yoki yakka logopedning) mashqiga tegib bo'lmasin */
async function ownExercise(formData: FormData) {
  const user = await requireExerciseUser();
  const id = String(formData.get("exerciseId") ?? "");
  const found = await prisma.exercise.findFirst({
    where: { id, ...exerciseScope(user) },
    select: { id: true },
  });
  if (!found) throw new Error("Mashq topilmadi.");
  return { user, id: found.id };
}

async function addExerciseImpl(formData: FormData) {
  const user = await requireExerciseUser();
  const fields = exerciseFields(formData);
  const scope = exerciseScope(user);
  const clash = await prisma.exercise.findFirst({
    where: { ...scope, isActive: true, name: { equals: fields.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) throw new Error("Bunday nomli mashq allaqachon bor.");
  await prisma.exercise.create({ data: { ...scope, ...fields, createdById: user.id } });
  revalidatePath("/exercises");
  await setFlash("Mashq qo'shildi.", "ok");
}

async function updateExerciseImpl(formData: FormData) {
  const { id } = await ownExercise(formData);
  await prisma.exercise.update({ where: { id }, data: exerciseFields(formData) });
  revalidatePath("/exercises");
  await setFlash("Mashq saqlandi.", "ok");
}

/**
 * Butunlay o'chirilmaydi, ro'yxatdan olinadi: o'tgan mashg'ulotlarda mashq
 * nomi ko'rinib tursin. Bolalarning dasturidan esa chiqariladi — bo'lmasa
 * rejada ishlatilmaydigan mashq turib qoladi.
 */
async function removeExerciseImpl(formData: FormData) {
  const { id } = await ownExercise(formData);
  await prisma.$transaction([
    prisma.exercise.update({ where: { id }, data: { isActive: false } }),
    prisma.clientExercise.updateMany({ where: { exerciseId: id }, data: { isActive: false } }),
  ]);
  revalidatePath("/exercises");
  await setFlash("Mashq ro'yxatdan olindi.", "ok");
}

export const addExercise = withFlash(addExerciseImpl);
export const updateExercise = withFlash(updateExerciseImpl);
export const removeExercise = withFlash(removeExerciseImpl);
