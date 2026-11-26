import Link from "next/link";
import { getT } from "@/lib/i18n/server";

/**
 * Mijoz kartasining bo'limlari. Karta uzun bo'lib ketmasligi uchun baholash
 * va dastur alohida sahifada — ular kundalik ish emas, vaqti-vaqti bilan
 * ochiladi.
 */
export async function ClientTabs({
  clientId,
  active,
}: {
  clientId: string;
  active: "card" | "assessment" | "program";
}) {
  const t = await getT();
  const tabs = [
    { key: "card" as const, href: `/clients/${clientId}`, label: t("Mijoz") },
    { key: "assessment" as const, href: `/clients/${clientId}/baholash`, label: t("Baholash") },
    { key: "program" as const, href: `/clients/${clientId}/dastur`, label: t("Dastur") },
  ];
  return (
    <div
      className="scroll-x mb-5 flex gap-1 border-b border-slate-200 dark:border-slate-800"
      data-testid="client-tabs"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`shrink-0 px-3.5 pb-2.5 pt-1 text-[13px] transition ${
            tab.key === active
              ? "font-semibold text-indigo-700 shadow-[inset_0_-2px_0] shadow-indigo-600 dark:text-indigo-300 dark:shadow-indigo-400"
              : "font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
