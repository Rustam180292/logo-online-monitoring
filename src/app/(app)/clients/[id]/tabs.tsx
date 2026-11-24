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
    <div className="scroll-x mb-5 flex gap-1" data-testid="client-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            tab.key === active
              ? "bg-indigo-600 text-white"
              : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
