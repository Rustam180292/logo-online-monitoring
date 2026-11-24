import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadProgramClient } from "@/lib/program";
import { ASSESSMENT, readAnswers, type AssessmentField, type Answers } from "@/lib/assessment";
import { dateShort } from "@/lib/format";
import { Card, PageHeader, btn, btnPrimary, input, label } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { addAssessment } from "../../program-actions";

/**
 * Yangi baholash. Asosiy talab — mutaxassis bolani 2–3 daqiqada baholab
 * qo'ya olishi: yozish emas, bosish. Shuning uchun hamma savol tanlov
 * (radio) bo'lib, bitta sahifada turadi.
 *
 * Oldingi baholash javoblari standart holda tanlangan bo'lib keladi:
 * ko'pchilik ko'rsatkich o'zgarmaydi, mutaxassis faqat o'zgarganini bosadi.
 */
export default async function NewAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client } = await loadProgramClient(id);
  const t = await getT();

  const previous = await prisma.assessment.findFirst({
    where: { clientId: client.id },
    orderBy: { at: "desc" },
    select: { at: true, answers: true },
  });
  const before = previous ? readAnswers(previous.answers) : {};

  return (
    <>
      <PageHeader
        title={t("Yangi baholash")}
        subtitle={`${client.fullName} · ${t.age(client.birthDate)}${
          previous ? ` · ${t("oxirgi marta {d}", { d: dateShort(previous.at) })}` : ""
        }`}
        action={
          <Link href={`/clients/${client.id}/baholash`} className={btn}>
            {t("Bekor qilish")}
          </Link>
        }
      />

      <form action={addAssessment}>
        <input type="hidden" name="clientId" value={client.id} />

        {previous ? (
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
            {t("Oldingi baholash javoblari tanlab qo'yilgan — faqat o'zgarganini bosing.")}
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          {ASSESSMENT.map((group) => (
            <Card key={group.title} title={t(group.title)} subtitle={group.subtitle ? t(group.subtitle) : undefined}>
              {group.fields.map((field) => (
                <Field key={field.key} field={field} before={before} t={t} />
              ))}
            </Card>
          ))}

          <Card title={t("Xulosa va maqsadlar")}>
            <div className="space-y-3 p-4">
              <div>
                <label className={label} htmlFor="note">
                  {t("Mutaxassis izohi")}
                </label>
                <textarea
                  id="note"
                  name="note"
                  className={`${input} h-20`}
                  placeholder={t("nima o'zgardi, nimaga e'tibor berish kerak")}
                />
              </div>
              <div>
                <label className={label}>{t("Keyingi 3 oy maqsadlari")}</label>
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      name="goal"
                      className={input}
                      placeholder={t("masalan: 20 ta faol so'z")}
                      aria-label={t("Maqsad")}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {t("Maqsadlar dasturga tushadi — mashqlar shularga biriktiriladi.")}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" name="shareWithParent" className="h-4 w-4" />
                {t("Qisqacha xulosani ota-onaning kabinetiga ko'rsatish")}
              </label>
            </div>
          </Card>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Link href={`/clients/${client.id}/baholash`} className={btn}>
            {t("Bekor qilish")}
          </Link>
          <button type="submit" className={btnPrimary}>
            {t("Saqlash")}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({
  field,
  before,
  t,
}: {
  field: AssessmentField;
  before: Answers;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  const old = before[field.key];
  const name = `a_${field.key}`;

  return (
    <div className="border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800">
      <div className="mb-2">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{t(field.title)}</p>
        {field.hint ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">{t(field.hint)}</p>
        ) : null}
      </div>

      {field.kind === "number" ? (
        <input
          name={name}
          inputMode="numeric"
          defaultValue={typeof old === "number" ? old : ""}
          aria-label={t(field.title)}
          className={`${input} max-w-[160px] tabular-nums`}
        />
      ) : (
        /* Tanlov tugmalari: ko'rinishda tugma, ichida radio/checkbox —
           telefonda barmoq bilan bosishga qulay bo'lsin */
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((option, i) => {
            const checked =
              field.kind === "chips"
                ? Array.isArray(old) && old.includes(option)
                : old === i;
            return (
              <label
                key={option}
                className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition has-[:checked]:border-transparent has-[:checked]:bg-indigo-600 has-[:checked]:font-semibold has-[:checked]:text-white dark:border-slate-700 dark:text-slate-300"
              >
                {/* pointer-events-none: bosish doim yorliqqa tushsin. Aks
                    holda ko'rinmas katakchaning ustiga bosilganda brauzer uni
                    ikki marta almashtiradi (yorliq ham uzatadi) va belgi
                    qo'yilmay qoladi. */}
                <input
                  type={field.kind === "chips" ? "checkbox" : "radio"}
                  name={name}
                  value={field.kind === "chips" ? option : i}
                  defaultChecked={checked}
                  className="sr-only pointer-events-none"
                />
                {t(option)}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
