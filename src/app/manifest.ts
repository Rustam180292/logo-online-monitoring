import type { MetadataRoute } from "next";

/** Telefonning bosh ekraniga o'rnatish uchun ilova ta'rifi */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Logopedik markaz CRM",
    short_name: "Logoped CRM",
    description:
      "Logopedik markaz boshqaruvi: jadval, davomat, mijozlar va to'lovlar.",
    lang: "uz",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Ilova ochilayotganda ko'rinadigan ekran — kunduzgi rejim ranglarida
    // (manifest cookie'ni o'qiy olmaydi, shuning uchun asosiy ko'rinish olingan)
    background_color: "#effbf6",
    theme_color: "#0a7ba5",
    // Belgi markaz logotipidan yasaladi (Sozlamalar), yuklanmagan bo'lsa
    // /api/app-icon eski statik belgiga yo'naltiradi
    icons: [
      { src: "/api/app-icon?s=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/app-icon?s=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/app-icon?s=512&m=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
