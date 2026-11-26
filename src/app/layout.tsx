import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PwaRegister } from "@/components/pwa";
import "./globals.css";

/*
 * Inter — raqamlar bir xil kenglikda turadigan shrift (tabular-nums): pul
 * ustunlari va jadval soatlari qalqib ketmaydi. Kirill ham kerak: ruscha
 * interfeys shu shriftda chiqadi.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Logopedik markaz CRM",
  description:
    "Logopedik markaz uchun boshqaruv tizimi: filiallar, mutaxassislar, mijozlar, jadval, davomat va to'lovlar.",
  applicationName: "Logoped CRM",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Logoped CRM",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/api/app-icon?s=192", sizes: "192x192", type: "image/png" },
      { url: "/api/app-icon?s=512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/api/app-icon?s=180", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Rangni qurilma mavzusiga bog'lamaymiz: rejimni foydalanuvchi o'zi tanlaydi
  // (cookie), shuning uchun meta'ning qiymatini pastdagi skript qo'yadi.
  themeColor: "#f3f2ef",
};

/**
 * Mavzu va til sahifa chizilishidan OLDIN qo'yiladi.
 *
 * Cookie'ni bu yerda serverda o'qisak, butun ilova statik bo'lmay qoladi
 * (/tg ham). Shuning uchun uni brauzerdagi kichik skript o'qiydi:
 * u HTML tahlil qilinayotgan paytda ishlaydi, ya'ni rang chaqnab ketmaydi.
 * Mavzu tanlanmagan bo'lsa qurilmaning o'z mavzusiga ergashadi.
 */
const PREFS_SCRIPT = `(function(){try{var d=document.documentElement,c=document.cookie,m=c.match(/(?:^|; )theme=(light|dark)/),t=m?m[1]:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");d.classList.toggle("dark",t==="dark");d.style.colorScheme=t;var k=document.querySelector('meta[name="theme-color"]');if(k)k.setAttribute("content",t==="dark"?"#020617":"#f3f2ef");var l=c.match(/(?:^|; )lang=(uz|en|ru)/);if(l)d.lang=l[1]}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
