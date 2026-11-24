import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, btn, btnPrimary, input, td, th } from "@/components/ui";
import { MaketEkranlari, MaketBelgisi } from "../parts";

/* MAKET — markazning umumiy mashqlar kutubxonasi. Ma'lumot qo'lda yozilgan. */

const mashqlar = [
  { nom: "Barmoq gimnastikasi", yon: "Mayda motorika", yosh: "2–6", jihoz: "—", kim: "G. Yusupova", soni: 14 },
  { nom: "Prujinali qisqichlar", yon: "Mayda motorika", yosh: "3–7", jihoz: "Qisqich, karton", kim: "G. Yusupova", soni: 9 },
  { nom: "Munchoq terish", yon: "Mayda motorika", yosh: "3–7", jihoz: "Munchoq, ip", kim: "K. Aliyeva", soni: 6 },
  { nom: "“K” tovushini qo'yish", yon: "Artikulyatsiya", yosh: "4–7", jihoz: "Oyna, shpatel", kim: "G. Yusupova", soni: 11 },
  { nom: "Predmetli lotolar", yon: "Nutq", yosh: "2–6", jihoz: "Kartochkalar", kim: "Sh. Umarova", soni: 17 },
  { nom: "Sensor quti: yorma", yon: "Sensorika", yosh: "2–6", jihoz: "Quti, yorma", kim: "D. Rahimova", soni: 8 },
  { nom: "To'siqdan sakrash", yon: "Yirik motorika", yosh: "3–8", jihoz: "Past to'siq", kim: "B. Ergashev", soni: 5 },
  { nom: "Tanaga bosim (sensor)", yon: "Sensorika", yosh: "2–8", jihoz: "Og'ir ko'rpacha", kim: "D. Rahimova", soni: 4 },
];

const yonalishlar = ["Hammasi", "Mayda motorika", "Yirik motorika", "Artikulyatsiya", "Nutq", "Sensorika", "Muloqot"];

export default function MaketMashqlar() {
  // Maket jonli saytda ko'rinmaydi: uni ko'rsatish uchun Vercel'da
  // SHOW_MAKET=1 qo'yiladi (mutaxassisga ko'rsatib, fikrini olish uchun).
  if (process.env.NODE_ENV === "production" && process.env.SHOW_MAKET !== "1") notFound();

  return (
    <>
      <MaketBelgisi>
        <b>Bu — maket.</b> Markazning <b>umumiy mashqlar kutubxonasi</b>. Har bir
        mutaxassis o&apos;z mashqini qo&apos;shadi — vaqt o&apos;tgani sayin bu markazning
        boyligiga aylanadi va yangi xodim birinchi kundan ishlay oladi.
      </MaketBelgisi>

      <PageHeader
        title="Mashqlar kutubxonasi"
        subtitle="74 ta mashq · 6 yo'nalish"
        action={<span className={btnPrimary}>+ Yangi mashq</span>}
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <input className={`${input} max-w-[240px]`} placeholder="Qidirish…" readOnly />
          {yonalishlar.map((y, i) => (
            <span
              key={y}
              className={
                i === 0
                  ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
                  : "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
              }
            >
              {y}
            </span>
          ))}
        </div>
      </Card>

      <Card title="Mashqlar">
        <div className="scroll-x">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className={th}>Mashq</th>
                <th className={th}>Yo&apos;nalish</th>
                <th className={th}>Yosh</th>
                <th className={th}>Jihoz</th>
                <th className={th}>Kim qo&apos;shgan</th>
                <th className={th}>Nechta bolada</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {mashqlar.map((m) => (
                <tr key={m.nom}>
                  <td className={`${td} font-medium`}>{m.nom}</td>
                  <td className={td}>
                    <Badge>{m.yon}</Badge>
                  </td>
                  <td className={td}>{m.yosh}</td>
                  <td className={td}>{m.jihoz}</td>
                  <td className={td}>{m.kim}</td>
                  <td className={td}>{m.soni} ta</td>
                  <td className={td}>
                    <span className={btn}>Bolaga qo&apos;shish</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Andoza dasturlar" subtitle="bir marta yasaladi, keyin bir bosishda qo'llanadi">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              { nom: "ASD, 3–5 yosh — boshlang'ich", soni: "9 ta mashq" },
              { nom: "Nutq kechikishi, 4–6 yosh", soni: "7 ta mashq" },
              { nom: "Sensor integratsiya — kirish", soni: "6 ta mashq" },
            ].map((a) => (
              <li key={a.nom} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{a.nom}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{a.soni}</p>
                </div>
                <span className={btn}>Qo&apos;llash</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Yangi mashq qo'shish" subtitle="forma shunday ko'rinadi">
          <div className="space-y-3 p-4">
            <input className={input} readOnly defaultValue="Munchoq terish" />
            <div className="flex flex-wrap gap-1.5">
              {["Mayda motorika", "Yirik motorika", "Artikulyatsiya", "Nutq", "Sensorika"].map((y, i) => (
                <span
                  key={y}
                  className={
                    i === 0
                      ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
                      : "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  }
                >
                  {y}
                </span>
              ))}
            </div>
            <textarea
              className={`${input} h-16`}
              readOnly
              defaultValue="Ipga munchoq terish. Avval katta munchoq, keyin kichigi. 5 daqiqa."
            />
            <div className="flex gap-2">
              <input className={input} readOnly defaultValue="Munchoq, ip" />
              <input className={`${input} max-w-[120px]`} readOnly defaultValue="3–7 yosh" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" className="h-4 w-4" readOnly />
              Uyga vazifa sifatida ham berilsin
            </label>
          </div>
        </Card>
      </div>
    
      <MaketEkranlari />
    </>
  );
}
