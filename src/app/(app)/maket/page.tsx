import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, btn, btnPrimary, card, td, th } from "@/components/ui";
import { Bar, KartaTablari, MaketEkranlari, MaketBelgisi } from "./parts";

/* MAKET — mijoz kartasidagi "Baholash" bo'limi. Ma'lumot qo'lda yozilgan. */

const kuzatuv = [
  { nom: "Ko'z kontakti", qiymat: [0, 1, 2], izoh: "yo'q → qisqa → chaqirilganda" },
  { nom: "Nomiga javob beradi", qiymat: [0, 1, 2], izoh: "ba'zan → ko'pincha" },
  { nom: "Faol so'z boyligi", qiymat: [0, 1, 1], izoh: "3 ta so'z → 11 ta so'z" },
  { nom: "Barmoq bilan ko'rsatadi", qiymat: [0, 0, 1], izoh: "yangi paydo bo'ldi" },
  { nom: "Stimlar (kam bo'lgani yaxshi)", qiymat: [1, 2, 2], izoh: "kamaydi" },
  { nom: "Mustaqil ovqatlanish", qiymat: [1, 1, 2], izoh: "qoshiq bilan" },
];

export default function MaketBaholash() {
  // Maket jonli saytda ko'rinmaydi: uni ko'rsatish uchun Vercel'da
  // SHOW_MAKET=1 qo'yiladi (mutaxassisga ko'rsatib, fikrini olish uchun).
  if (process.env.NODE_ENV === "production" && process.env.SHOW_MAKET !== "1") notFound();

  return (
    <>
      <MaketBelgisi>
        <b>Bu — maket.</b> Hech narsa saqlanmaydi, raqamlar o'ylab topilgan. Mijoz
        kartasiga qo'shilishi mo'ljallangan yangi <b>&ldquo;Baholash&rdquo;</b> bo'limi shunday
        ko'rinishi mumkin.
      </MaketBelgisi>

      <PageHeader
        title="Amirbek Abdullayev"
        subtitle="4 yosh 6 oy · Chilonzor filiali · Logoped-defektolog, Sensor integratsiya"
        action={
          <Link href="/maket/yangi" className={btnPrimary}>
            + Yangi baholash
          </Link>
        }
      />

      <KartaTablari faol="Baholash" />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Tashxis va tibbiy ma'lumot" className="lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Asosiy tashxis</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-white">
                Autizm spektri buzilishi (F84.0)
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Qo'shimcha</dt>
              <dd className="text-sm text-slate-700 dark:text-slate-300">
                Nutq rivojlanishining kechikishi
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Kim qo'ygan, qachon</dt>
              <dd className="text-sm text-slate-700 dark:text-slate-300">
                Respublika bolalar markazi · 14.03.2026
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Dori / allergiya</dt>
              <dd className="text-sm text-slate-700 dark:text-slate-300">
                Dori qabul qilmaydi · yong'oqqa allergiya
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500 dark:text-slate-400">Diqqat qilinadigan narsa</dt>
              <dd className="text-sm text-slate-700 dark:text-slate-300">
                Baland tovushdan qo'rqadi — mashg'ulot tinch xonada o'tkaziladi.
                Ota-ona bilan ajralish qiyin kechadi, birinchi 5 daqiqa birga o'tiradi.
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Oxirgi baholash" subtitle="12.11.2026 · G. Yusupova">
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Umumiy holat</span>
              <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800">
                Yaxshilanish bor
              </Badge>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              3 oyda: ko'z kontakti paydo bo'ldi, faol so'z boyligi 3 tadan 11 taga chiqdi,
              qo'l silkitish stimlari sezilarli kamaydi.
            </p>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Keyingi 3 oy maqsadi
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-700 dark:text-slate-300">
                <li>20 ta faol so'z</li>
                <li>Ikki so'zli ibora: &ldquo;katta mashina&rdquo;</li>
                <li>Tuvaletga mustaqil borish</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Dinamika"
        subtitle="har bir baholashda bir xil savollar — shuning uchun solishtirsa bo'ladi"
        className="mt-5"
      >
        <div className="scroll-x">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className={th}>Ko'rsatkich</th>
                <th className={th}>12.08</th>
                <th className={th}>10.10</th>
                <th className={th}>12.11</th>
                <th className={th}>O'zgarish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {kuzatuv.map((k) => (
                <tr key={k.nom}>
                  <td className={`${td} font-medium`}>{k.nom}</td>
                  {k.qiymat.map((v, i) => (
                    <td key={i} className={td}>
                      <Bar value={v} />
                    </td>
                  ))}
                  <td className={`${td} text-slate-500`}>{k.izoh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Baholash tarixi" className="mt-5">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {[
            { sana: "12.11.2026", kim: "G. Yusupova", tur: "Oraliq baholash", holat: "Yaxshilanish" },
            { sana: "10.10.2026", kim: "G. Yusupova", tur: "Oraliq baholash", holat: "Yaxshilanish" },
            { sana: "12.08.2026", kim: "K. Aliyeva", tur: "Birinchi baholash", holat: "Boshlang'ich" },
          ].map((b) => (
            <li key={b.sana} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {b.tur} · {b.sana}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{b.kim}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{b.holat}</Badge>
                <span className={btn}>Ochish</span>
                <span className={btn}>PDF</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className={`${card} mt-5 p-4`}>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Shu baholashdan chiqqan maqsadlar{" "}
          <Link href="/maket/dastur" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            bolaning dasturiga
          </Link>{" "}
          ko'chiriladi — mutaxassis har kuni nima qilishini o'sha yerdan oladi.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Baholashni faqat shu mijozga biriktirilgan mutaxassis va markaz egasi ko'radi.
          Qabulxona xodimiga va Google jadvalga tushmaydi.
        </p>
      </div>

      <MaketEkranlari />
    </>
  );
}
