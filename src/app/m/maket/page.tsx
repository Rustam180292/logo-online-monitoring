import { notFound } from "next/navigation";

/* MAKET — mutaxassisning telefonidagi "ertangi mashg'ulot" ko'rinishi.
   Hech narsa saqlanmaydi, hamma qiymat qo'lda yozilgan. */

export default function MaketAgenda() {
  // Maket jonli saytda ko'rinmaydi: uni ko'rsatish uchun Vercel'da
  // SHOW_MAKET=1 qo'yiladi (mutaxassisga ko'rsatib, fikrini olish uchun).
  if (process.env.NODE_ENV === "production" && process.env.SHOW_MAKET !== "1") notFound();

  const mashqlar = [
    {
      nom: "Barmoq gimnastikasi",
      yonalish: "Mayda motorika",
      tavsif: "“Barmoqlar oilasi” — har bir barmoqni nomlab bukish, 2 daqiqa",
      oxirgi: "3 kun oldin · bajardi",
      uyga: true,
      holat: "bajardi",
    },
    {
      nom: "Prujinali qisqichlar",
      yonalish: "Mayda motorika",
      tavsif: "Qisqichlarni kartonga qadash, 10 ta",
      oxirgi: "1 hafta oldin · qiynaldi",
      uyga: false,
      holat: null,
    },
    {
      nom: "“K” tovushini qo'yish",
      yonalish: "Artikulyatsiya",
      tavsif: "Oyna oldida, bo'g'inlarda: ka-ko-ku",
      oxirgi: "kecha · qiynaldi",
      uyga: true,
      holat: null,
    },
    {
      nom: "Sensor quti: yorma",
      yonalish: "Sensorika",
      tavsif: "Yorma ichidan buyum topish, ko'z yumib",
      oxirgi: "5 kun oldin · bajardi",
      uyga: false,
      holat: null,
    },
    {
      nom: "To'siqdan sakrash",
      yonalish: "Yirik motorika",
      tavsif: "Past to'siqdan ikki oyoqlab, 6 marta",
      oxirgi: "hali qilinmagan",
      uyga: false,
      holat: null,
    },
  ];

  const tugma = "rounded-lg px-3 py-1.5 text-sm font-medium";

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-4">
      <div className="mb-4 rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
        <b>Bu — maket.</b> Tugmalar ishlamaydi. Mutaxassis ertalab telefonini ochganda
        shunday ko'rishi mo'ljallangan.
      </div>

      <header className="mb-4">
        <p className="text-base font-bold">Bugun, 25-noyabr</p>
        <p className="text-sm app-muted">4 ta mashg'ulot · Gulnora Yusupova</p>
      </header>

      <div className="mb-3 flex gap-1 overflow-x-auto">
        {["09:00 Amirbek", "10:00 Sitora", "11:30 Umar", "14:00 Omina"].map((s, i) => (
          <span
            key={s}
            className={`shrink-0 ${tugma} ${i === 0 ? "app-accent" : "app-card app-muted"}`}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="app-card mb-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold">Amirbek Abdullayev</p>
            <p className="text-xs app-muted">4 yosh 6 oy · Sensor integratsiya</p>
          </div>
          <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
            09:00
          </span>
        </div>
        <div className="mt-3 rounded-lg bg-black/5 p-3">
          <p className="text-xs font-semibold">Dastur maqsadi (3 oy)</p>
          <p className="mt-0.5 text-sm">20 ta faol so&apos;z · ikki so&apos;zli ibora · mayda motorika</p>
        </div>
        {/* Birinchi g'oya — baholash — shu yerda kundalik ishga ulanadi */}
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-amber-100 p-3">
          <p className="text-sm text-amber-900">
            Oxirgi baholash <b>3 oy oldin</b> — yangilash vaqti keldi
          </p>
          <span className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white">
            Baholash
          </span>
        </div>
      </div>

      <p className="mb-2 text-sm font-semibold">
        Bugungi reja <span className="app-muted font-normal">· dasturdan tanlandi</span>
      </p>

      <div className="space-y-3">
        {mashqlar.map((m) => (
          <div key={m.nom} className="app-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{m.nom}</p>
                <p className="text-xs app-muted">{m.yonalish}</p>
              </div>
              {m.uyga ? (
                <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                  uyga vazifa
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-sm">{m.tavsif}</p>
            <p className="mt-1 text-xs app-muted">Oxirgi marta: {m.oxirgi}</p>

            <div className="mt-3 flex gap-1.5">
              {["Bajardi", "Qiynaldi", "Qila olmadi"].map((t) => (
                <span
                  key={t}
                  className={`${tugma} flex-1 text-center ${
                    m.holat === "bajardi" && t === "Bajardi"
                      ? "bg-emerald-600 text-white"
                      : "app-card border border-black/10"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <span className="app-card block rounded-xl border border-dashed border-black/20 p-3 text-center text-sm app-muted">
          + Rejadan tashqari mashq qo&apos;shish
        </span>
        <span className="app-accent block rounded-xl p-3 text-center text-sm font-semibold">
          Mashg&apos;ulotni yakunlash
        </span>
        <p className="px-1 text-center text-xs app-muted">
          Yakunlanganda: seans &ldquo;O&apos;tdi&rdquo; bo&apos;ladi, ish haqi hisoblanadi,
          uyga vazifa ota-onaning kabinetiga tushadi.
        </p>
      </div>
    </main>
  );
}
