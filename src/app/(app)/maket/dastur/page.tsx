import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, btn, btnPrimary, card, td, th } from "@/components/ui";
import { KartaTablari, MaketEkranlari, MaketBelgisi } from "../parts";

/* MAKET — mijoz kartasidagi "Dastur" bo'limi. Ma'lumot qo'lda yozilgan. */

const dastur = [
  {
    maqsad: "Faol so'z boyligi 20 taga yetsin",
    mashqlar: [
      { nom: "Predmetli lotolar", yonalish: "Nutq", oxirgi: "kecha", natija: "bajardi", uyga: false },
      { nom: "“K” tovushini qo'yish", yonalish: "Artikulyatsiya", oxirgi: "kecha", natija: "qiynaldi", uyga: true },
    ],
  },
  {
    maqsad: "Mayda motorika: qalam ushlashga tayyorgarlik",
    mashqlar: [
      { nom: "Barmoq gimnastikasi", yonalish: "Mayda motorika", oxirgi: "3 kun oldin", natija: "bajardi", uyga: true },
      { nom: "Prujinali qisqichlar", yonalish: "Mayda motorika", oxirgi: "1 hafta oldin", natija: "qiynaldi", uyga: false },
      { nom: "Munchoq terish", yonalish: "Mayda motorika", oxirgi: "hali qilinmagan", natija: "—", uyga: false },
    ],
  },
  {
    maqsad: "Sensor sezgirlikni kamaytirish",
    mashqlar: [
      { nom: "Sensor quti: yorma", yonalish: "Sensorika", oxirgi: "5 kun oldin", natija: "bajardi", uyga: false },
      { nom: "To'siqdan sakrash", yonalish: "Yirik motorika", oxirgi: "hali qilinmagan", natija: "—", uyga: false },
    ],
  },
];

const rang = (n: string) =>
  n === "bajardi"
    ? "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800"
    : n === "qiynaldi"
      ? "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800"
      : "";

export default function MaketDastur() {
  // Maket jonli saytda ko'rinmaydi: uni ko'rsatish uchun Vercel'da
  // SHOW_MAKET=1 qo'yiladi (mutaxassisga ko'rsatib, fikrini olish uchun).
  if (process.env.NODE_ENV === "production" && process.env.SHOW_MAKET !== "1") notFound();

  return (
    <>
      <MaketBelgisi>
        <b>Bu — maket.</b> Mijoz kartasidagi yangi <b>&ldquo;Dastur&rdquo;</b> bo&apos;limi:
        bolaning 3 oylik maqsadlari va har bir maqsadga ishlaydigan mashqlar. Ertangi
        mashg&apos;ulot rejasi shu yerdan olinadi.
      </MaketBelgisi>

      <PageHeader
        title="Amirbek Abdullayev"
        subtitle="Dastur · 12.11.2026 – 12.02.2027 · G. Yusupova"
        action={
          <div className="flex gap-2">
            <span className={btn}>Andozadan olish</span>
            <span className={btnPrimary}>+ Mashq qo&apos;shish</span>
          </div>
        }
      />

      <KartaTablari faol="Dastur" />

      {dastur.map((d) => (
        <Card
          key={d.maqsad}
          title={d.maqsad}
          subtitle={`${d.mashqlar.length} ta mashq`}
          className="mb-5"
          action={<span className={btn}>Tahrirlash</span>}
        >
          <div className="scroll-x">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className={th}>Mashq</th>
                  <th className={th}>Yo&apos;nalish</th>
                  <th className={th}>Oxirgi marta</th>
                  <th className={th}>Natija</th>
                  <th className={th}>Uyga vazifa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.mashqlar.map((m) => (
                  <tr key={m.nom}>
                    <td className={`${td} font-medium`}>{m.nom}</td>
                    <td className={td}>{m.yonalish}</td>
                    <td className={td}>{m.oxirgi}</td>
                    <td className={td}>
                      {m.natija === "—" ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <Badge className={rang(m.natija)}>{m.natija}</Badge>
                      )}
                    </td>
                    <td className={td}>
                      {m.uyga ? (
                        <Badge className="bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800">
                          ota-onaga ketadi
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Ertangi mashg'ulotga taklif" subtitle="ilova o'zi tanlaydi">
          <div className="space-y-2 p-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Uzoq vaqt qilinmagan va oldingi safar qiynalgan mashqlar birinchi bo&apos;ladi:
            </p>
            <ol className="list-inside list-decimal space-y-1 text-sm text-slate-800 dark:text-slate-200">
              <li>Munchoq terish — hali qilinmagan</li>
              <li>To&apos;siqdan sakrash — hali qilinmagan</li>
              <li>Prujinali qisqichlar — 1 hafta oldin, qiynalgan</li>
              <li>&ldquo;K&rdquo; tovushi — kecha, qiynalgan</li>
            </ol>
            <p className="pt-1 text-xs text-slate-400">
              Mutaxassis bu ro&apos;yxatni o&apos;zgartira oladi — bu majburiyat emas, taklif.
            </p>
          </div>
        </Card>

        <Card title="Shu oyda bajarilgani">
          <div className="space-y-3 p-4">
            {[
              { nom: "Mayda motorika", son: "12 ta mashq", ok: "8 ta bajardi" },
              { nom: "Nutq / artikulyatsiya", son: "9 ta mashq", ok: "4 ta bajardi" },
              { nom: "Sensorika", son: "6 ta mashq", ok: "5 ta bajardi" },
              { nom: "Yirik motorika", son: "2 ta mashq", ok: "1 ta bajardi" },
            ].map((r) => (
              <div key={r.nom} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">{r.nom}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {r.son} · {r.ok}
                </span>
              </div>
            ))}
            <p className="pt-1 text-xs text-slate-400">
              Bu raqamlar baholashga ulanadi: qaysi yo&apos;nalishda ko&apos;p ishlandi, natija qanday.
            </p>
          </div>
        </Card>
      </div>

      <div className={`${card} mt-5 p-4`}>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Maqsadlar{" "}
          <Link href="/maket" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            12.11 dagi baholashdan
          </Link>{" "}
          olingan. Mashqlar markazning umumiy kutubxonasidan —{" "}
          <Link href="/maket/mashqlar" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            Mashqlar kutubxonasi →
          </Link>
        </p>
      </div>

      <MaketEkranlari />
    </>
  );
}
