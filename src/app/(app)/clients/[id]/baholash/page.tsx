import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadProgramClient } from "@/lib/program";
import { ASSESSMENT, answerText, readAnswers, scaleFields } from "@/lib/assessment";
import { dateShort, dateTimeUz } from "@/lib/format";
import { Card, Empty, PageHeader, btnPrimary, td, th } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { ClientTabs } from "../tabs";
import { removeAssessment } from "../program-actions";

/**
 * Baholash: bolaning hozirgi holati va dinamikasi. Maqsadi — "3 oy oldin
 * nima bo'lgan, hozir nima" savoliga javob berish; ota-ona ham, mutaxassis
 * ham natijani raqamda ko'rsin.
 */
export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client } = await loadProgramClient(id);
  const t = await getT();

  const list = await prisma.assessment.findMany({
    where: { clientId: client.id },
    orderBy: { at: "desc" },
    take: 12,
    include: {
      specialist: { include: { user: { select: { fullName: true } } } },
      goals: { select: { id: true, title: true, isDone: true } },
    },
  });

  const last = list[0];
  const lastAnswers = last ? readAnswers(last.answers) : {};
  // Dinamika chapdan o'ngga o'sib boradi: eski baholash chapda
  const history = list.slice(0, 4).reverse();
  const scales = scaleFields();

  return (
    <>
      <PageHeader
        title={client.fullName}
        subtitle={`${t.age(client.birthDate)}${client.diagnosis ? ` · ${client.diagnosis}` : ""}`}
        action={
          <Link href={`/clients/${client.id}/baholash/yangi`} className={btnPrimary}>
            + {t("Yangi baholash")}
          </Link>
        }
      />

      <ClientTabs clientId={client.id} active="assessment" />

      {!last ? (
        <Card className="mb-5">
          <Empty>
            {t("Bola hali baholanmagan. Birinchi baholash — dastur uchun boshlang'ich nuqta.")}
          </Empty>
        </Card>
      ) : (
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <Card
            title={t("Oxirgi baholash")}
            subtitle={`${dateTimeUz(last.at)}${
              last.specialist ? ` · ${last.specialist.user.fullName}` : ""
            }`}
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {ASSESSMENT.map((group) => {
                const filled = group.fields
                  .map((f) => ({ f, text: answerText(f, lastAnswers) }))
                  .filter((x) => x.text !== null);
                if (filled.length === 0) return null;
                return (
                  <div key={group.title} className="px-4 py-3">
                    <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t(group.title)}
                    </p>
                    <dl className="space-y-0.5">
                      {filled.map(({ f, text }) => (
                        <div key={f.key} className="flex flex-wrap justify-between gap-2 text-sm">
                          <dt className="text-slate-600 dark:text-slate-400">{t(f.title)}</dt>
                          <dd className="font-medium text-slate-900 dark:text-white">
                            {f.kind === "chips"
                              ? (text as string)
                                  .split(", ")
                                  .map((x) => t(x))
                                  .join(", ")
                              : f.kind === "number"
                                ? text
                                : t(text as string)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
              {last.note ? (
                <div className="px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t("Mutaxassis izohi")}
                  </p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{last.note}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card
            title={t("Dinamika")}
            subtitle={t("chapda eski baholash, o'ngda oxirgisi")}
          >
            <div className="scroll-x">
              <table className="w-full min-w-[460px]">
                <thead className="border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className={th}>{t("Savol")}</th>
                    {history.map((a) => (
                      <th key={a.id} className={`${th} tabular-nums`}>
                        {dateShort(a.at)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {scales.map((f) => {
                    const cells = history.map((a) => readAnswers(a.answers)[f.key]);
                    // Hamma baholashda bo'sh qolgan savol jadvalni uzaytirmasin
                    if (cells.every((c) => typeof c !== "number")) return null;
                    return (
                      <tr key={f.key}>
                        <td className={td}>{t(f.title)}</td>
                        {cells.map((c, i) => (
                          <td key={history[i].id} className={td}>
                            {typeof c === "number" ? (
                              <>
                                <Bar value={c} max={f.options.length - 1} />
                                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                  {t(f.options[c] ?? "")}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-xs text-slate-400">
              {t("Yashil chiziq uzunligi — o'sish: chapdan o'ngga qaraganda ko'rinadi.")}
            </p>
          </Card>
        </div>
      )}

      {last && last.goals.length > 0 ? (
        <Card
          title={t("Shu baholashdan qo'yilgan maqsadlar")}
          className="mb-5"
          action={
            <Link
              href={`/clients/${client.id}/dastur`}
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {t("Dastur")} →
            </Link>
          }
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {last.goals.map((g) => (
              <li key={g.id} className="px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200">
                {g.isDone ? "✓ " : ""}
                {g.title}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {list.length > 1 ? (
        <Card title={t("Baholash tarixi")} subtitle={t("{n} ta", { n: list.length })}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {dateTimeUz(a.at)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {a.specialist ? a.specialist.user.fullName : t("Rahbar")}
                    {a.shareWithParent ? ` · ${t("ota-onaga ko'rinadi")}` : ""}
                  </p>
                </div>
                <form action={removeAssessment}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="assessmentId" value={a.id} />
                  <button
                    type="submit"
                    className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-rose-600"
                    title={t("O'chirish")}
                    aria-label={t("O'chirish")}
                  >
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
        {t("Baholashni faqat shu bolaga biriktirilgan mutaxassis va rahbar ko'radi.")}
      </p>
    </>
  );
}

/** Shkala javobini chiziq bilan ko'rsatadi — raqamdan tezroq o'qiladi */
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max + 1 }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-4 rounded-sm ${
            i <= value ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
          }`}
        />
      ))}
    </span>
  );
}
