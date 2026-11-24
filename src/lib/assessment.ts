/**
 * Bolani baholash: savollar, javob variantlari va javoblarni tekshirish.
 *
 * Savollar bazada emas, kodda turadi — shkala qo'shilsa yoki variant
 * o'zgarsa baza o'zgarmaydi, eski baholashlar esa o'z javoblari bilan
 * qolaveradi (`Assessment.answers` — Json). Shuning uchun kalitni
 * (`eyeContact` kabi) hech qachon o'zgartirmang: eski yozuvlar o'sha kalit
 * bilan saqlangan. Variant qo'shsangiz ro'yxatning oxiriga qo'shing —
 * tartib raqami javob sifatida saqlanadi.
 *
 * Shkala javoblari ataylab "yomondan yaxshiga" tartibda: 0 — eng past,
 * oxirgisi — eng yaxshi. Dinamika (o'sish) shunga tayanadi.
 */

export type AssessmentField =
  /** Bitta variant tanlanadi, javob — tartib raqami (0, 1, 2...) */
  | { kind: "scale"; key: string; title: string; hint?: string; options: string[] }
  /** Bir nechtasi tanlanadi, javob — tanlangan variantlar ro'yxati */
  | { kind: "chips"; key: string; title: string; hint?: string; options: string[] }
  /** Son (masalan so'z soni) */
  | { kind: "number"; key: string; title: string; hint?: string; max: number };

export type AssessmentGroup = { title: string; subtitle?: string; fields: AssessmentField[] };

export const ASSESSMENT: AssessmentGroup[] = [
  {
    title: "Muloqot",
    subtitle: "eng muhim bo'lim — dinamika shu yerda ko'rinadi",
    fields: [
      {
        kind: "scale",
        key: "eyeContact",
        title: "Ko'z kontakti",
        options: ["Yo'q", "Qisqa", "Chaqirilganda", "Erkin"],
      },
      {
        kind: "scale",
        key: "nameResponse",
        title: "Nomiga javob beradi",
        options: ["Yo'q", "Ba'zan", "Ko'pincha", "Doim"],
      },
      {
        kind: "scale",
        key: "pointing",
        title: "Barmoq bilan ko'rsatadi",
        hint: "xohlaganini so'rash uchun",
        options: ["Yo'q", "Qo'l bilan tortadi", "Ko'rsatadi", "Ko'rsatib qaraydi"],
      },
      {
        kind: "scale",
        key: "jointAttention",
        title: "Birgalikda e'tibor",
        hint: "kattalar qaragan narsaga qaraydimi",
        options: ["Yo'q", "Ba'zan", "Ko'pincha"],
      },
    ],
  },
  {
    title: "Nutq",
    fields: [
      {
        kind: "scale",
        key: "speechLevel",
        title: "Nutq darajasi",
        options: ["Nutqsiz", "Tovushlar", "10 tagacha so'z", "10–50 so'z", "Ibora"],
      },
      {
        kind: "number",
        key: "activeWords",
        title: "Faol so'z boyligi",
        hint: "taxminan, nechta so'z",
        max: 5000,
      },
      {
        kind: "scale",
        key: "understanding",
        title: "Tushunishi",
        options: ["Tushunmaydi", "Oddiy so'rov", "Ikki bosqichli"],
      },
      { kind: "scale", key: "echolalia", title: "Exolaliya", options: ["Ko'p", "Ba'zan", "Yo'q"] },
    ],
  },
  {
    title: "Xulq-atvor",
    fields: [
      {
        kind: "chips",
        key: "stims",
        title: "Stimlar",
        options: [
          "Qo'l silkitish",
          "Aylanish",
          "Oyoq uchida yurish",
          "Tovush chiqarish",
          "Buyum aylantirish",
          "Chayqalish",
        ],
      },
      {
        kind: "scale",
        key: "tantrums",
        title: "Istericalar",
        options: ["Kuniga bir necha", "Har kuni", "Haftada 1–2", "Yo'q"],
      },
      {
        kind: "scale",
        key: "selfHarm",
        title: "O'ziga zarar yetkazish",
        options: ["Tez-tez", "Kamdan-kam", "Yo'q"],
      },
      {
        kind: "scale",
        key: "routines",
        title: "Qat'iy tartib va rituallar",
        hint: "o'zgarishga qanday munosabat",
        options: ["Qattiq qarshilik", "Qiynaladi", "Muammo yo'q"],
      },
    ],
  },
  {
    title: "Sensorika va kundalik ko'nikmalar",
    fields: [
      {
        kind: "chips",
        key: "sensitivity",
        title: "Sezgirlik",
        options: ["Tovush", "Yorug'lik", "Teginish", "Kiyim", "Ovqat tanlash"],
      },
      { kind: "scale", key: "toilet", title: "Tuvalet", options: ["Tagligi bor", "O'rganyapti", "Mustaqil"] },
      {
        kind: "scale",
        key: "eating",
        title: "Ovqatlanish",
        options: ["Boqib beriladi", "Qoshiq bilan", "Mustaqil"],
      },
      { kind: "scale", key: "sleep", title: "Uyqu", options: ["Buzilgan", "Beqaror", "Yaxshi"] },
    ],
  },
  {
    title: "O'yin va ijtimoiylik",
    fields: [
      {
        kind: "scale",
        key: "peers",
        title: "Tengdoshlarga qiziqish",
        options: ["Yo'q", "Qaraydi", "Yonida o'ynaydi", "Birga o'ynaydi"],
      },
      {
        kind: "scale",
        key: "imitation",
        title: "Taqlid qiladi",
        options: ["Yo'q", "Harakatga", "Harakat va tovushga"],
      },
      {
        kind: "scale",
        key: "playType",
        title: "O'yin turi",
        options: ["Buyumni aylantiradi", "Bir xil o'yin", "Syujetli o'yin"],
      },
    ],
  },
];

export const ASSESSMENT_FIELDS: AssessmentField[] = ASSESSMENT.flatMap((g) => g.fields);

/** Baholash javoblari: kalit -> tanlangan variant raqami, ro'yxat yoki son */
export type Answers = Record<string, number | string[]>;

/**
 * Formadan kelgan javoblarni tekshirib oladi. Begona kalit, variant
 * raqamidan tashqari qiymat va ro'yxatdagi bo'lmagan stim tashlab yuboriladi
 * — baza Json saqlagani uchun bu yerda tekshirilmasa, keyin hech qayerda
 * tekshirilmaydi.
 */
export function parseAnswers(form: FormData): Answers {
  const answers: Answers = {};
  for (const field of ASSESSMENT_FIELDS) {
    if (field.kind === "chips") {
      const picked = form
        .getAll(`a_${field.key}`)
        .map(String)
        .filter((v) => field.options.includes(v));
      if (picked.length > 0) answers[field.key] = picked;
      continue;
    }
    const raw = form.get(`a_${field.key}`);
    if (raw === null || String(raw).trim() === "") continue;
    const n = Number(String(raw).replace(/\s/g, ""));
    if (!Number.isInteger(n) || n < 0) continue;
    const max = field.kind === "scale" ? field.options.length - 1 : field.max;
    if (n > max) continue;
    answers[field.key] = n;
  }
  return answers;
}

/** Bazadan kelgan Json ni o'qiladigan ko'rinishga keltiradi */
export function readAnswers(value: unknown): Answers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Answers = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

/** Javobning o'qiladigan matni (tarjimasiz — chizishda `t()` ga beriladi) */
export function answerText(field: AssessmentField, answers: Answers): string | null {
  const v = answers[field.key];
  if (v === undefined) return null;
  if (field.kind === "chips") return Array.isArray(v) && v.length > 0 ? v.join(", ") : null;
  if (typeof v !== "number") return null;
  if (field.kind === "number") return String(v);
  return field.options[v] ?? null;
}

/** Faqat shkalalar — dinamika jadvali shulardan tuziladi */
export function scaleFields() {
  return ASSESSMENT_FIELDS.filter(
    (f): f is Extract<AssessmentField, { kind: "scale" }> => f.kind === "scale",
  );
}
