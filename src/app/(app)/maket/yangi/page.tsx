import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader, btn, btnPrimary, input, label } from "@/components/ui";
import { Chips, MaketBelgisi, Scale } from "../parts";

/* MAKET — yangi baholash formasi. Tugmalar ishlamaydi. */

export default function MaketYangiBaholash() {
  // Maket jonli saytda ko'rinmaydi: uni ko'rsatish uchun Vercel'da
  // SHOW_MAKET=1 qo'yiladi (mutaxassisga ko'rsatib, fikrini olish uchun).
  if (process.env.NODE_ENV === "production" && process.env.SHOW_MAKET !== "1") notFound();

  return (
    <>
      <MaketBelgisi>
        <b>Bu — maket.</b> Tugmalar ishlamaydi. Maqsad: mutaxassis bolani{" "}
        <b>2–3 daqiqada</b> baholab qo&apos;ya olishi — yozish emas, bosish.
      </MaketBelgisi>

      <PageHeader
        title="Yangi baholash"
        subtitle="Amirbek Abdullayev · 24.11.2026 · G. Yusupova"
        action={
          <div className="flex gap-2">
            <Link href="/maket" className={btn}>
              Bekor qilish
            </Link>
            <span className={btnPrimary}>Saqlash</span>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Muloqot" subtitle="eng muhim bo'lim — dinamika shu yerda ko'rinadi">
          <Scale
            title="Ko'z kontakti"
            options={["Yo'q", "Qisqa", "Chaqirilganda", "Erkin"]}
            value={2}
          />
          <Scale title="Nomiga javob beradi" options={["Yo'q", "Ba'zan", "Ko'pincha", "Doim"]} value={2} />
          <Scale
            title="Barmoq bilan ko'rsatadi"
            hint="xohlaganini so'rash uchun"
            options={["Yo'q", "Qo'l bilan tortadi", "Ko'rsatadi", "Ko'rsatib qaraydi"]}
            value={1}
          />
          <Scale
            title="Birgalikda e'tibor"
            hint="kattalar qaragan narsaga qaraydimi"
            options={["Yo'q", "Ba'zan", "Ko'pincha"]}
            value={1}
          />
        </Card>

        <Card title="Nutq">
          <Scale
            title="Nutq darajasi"
            options={["Nutqsiz", "Tovushlar", "10 tagacha so'z", "10–50 so'z", "Ibora"]}
            value={2}
          />
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <label className={label}>Faol so&apos;z boyligi (taxminan)</label>
            <input className={`${input} max-w-[160px]`} defaultValue="11" readOnly />
          </div>
          <Scale title="Tushunishi" options={["Tushunmaydi", "Oddiy so'rov", "Ikki bosqichli"]} value={1} />
          <Scale title="Exolaliya" options={["Yo'q", "Ba'zan", "Ko'p"]} value={1} />
        </Card>

        <Card title="Xulq-atvor">
          <Chips
            title="Stimlar"
            options={[
              "Qo'l silkitish",
              "Aylanish",
              "Oyoq uchida yurish",
              "Tovush chiqarish",
              "Buyum aylantirish",
              "Chayqalish",
            ]}
            picked={["Qo'l silkitish", "Oyoq uchida yurish"]}
          />
          <Scale title="Istericalar" options={["Yo'q", "Haftada 1–2", "Har kuni", "Kuniga bir necha"]} value={1} />
          <Scale title="O'ziga zarar yetkazish" options={["Yo'q", "Kamdan-kam", "Tez-tez"]} value={0} />
          <Scale
            title="Qat'iy tartib / rituallar"
            hint="o'zgarishga qanday munosabat"
            options={["Muammo yo'q", "Qiynaladi", "Qattiq qarshilik"]}
            value={1}
          />
        </Card>

        <Card title="Sensorika va kundalik ko'nikmalar">
          <Chips
            title="Sezgirlik"
            options={["Tovush", "Yorug'lik", "Teginish", "Kiyim", "Ovqat tanlash"]}
            picked={["Tovush", "Ovqat tanlash"]}
          />
          <Scale title="Tuvalet" options={["Tagligi bor", "O'rganyapti", "Mustaqil"]} value={1} />
          <Scale title="Ovqatlanish" options={["Boqib beriladi", "Qoshiq bilan", "Mustaqil"]} value={1} />
          <Scale title="Uyqu" options={["Buzilgan", "Beqaror", "Yaxshi"]} value={2} />
        </Card>

        <Card title="O'yin va ijtimoiylik">
          <Scale
            title="Tengdoshlarga qiziqish"
            options={["Yo'q", "Qaraydi", "Yonida o'ynaydi", "Birga o'ynaydi"]}
            value={1}
          />
          <Scale title="Taqlid qiladi" options={["Yo'q", "Harakatga", "Harakat va tovushga"]} value={1} />
          <Scale title="O'yin turi" options={["Buyumni aylantiradi", "Bir xil o'yin", "Syujetli o'yin"]} value={1} />
        </Card>

        <Card title="Xulosa va maqsadlar">
          <div className="space-y-3 p-4">
            <div>
              <label className={label}>Mutaxassis izohi</label>
              <textarea
                className={`${input} h-20`}
                readOnly
                defaultValue="Ko'z kontakti barqarorlashdi. Qo'l silkitish kamaydi, lekin charchaganda qaytadi."
              />
            </div>
            <div>
              <label className={label}>Keyingi 3 oy maqsadlari</label>
              <div className="space-y-2">
                <input className={input} readOnly defaultValue="20 ta faol so'z" />
                <input className={input} readOnly defaultValue="Ikki so'zli ibora" />
                <input className={input} readOnly defaultValue="Tuvaletga mustaqil borish" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" defaultChecked readOnly className="h-4 w-4" />
              Qisqacha xulosani ota-onaning kabinetiga ko&apos;rsatish
            </label>
          </div>
        </Card>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Link href="/maket" className={btn}>
          Bekor qilish
        </Link>
        <span className={btnPrimary}>Saqlash</span>
      </div>
    </>
  );
}
