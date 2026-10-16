import sharp from "sharp";
import { getLogo } from "@/lib/settings";

/**
 * Telefon ilovasining belgisi — markaz Sozlamalarga yuklagan logotipdan.
 *
 * Manifest va root layout statik qoladi (bazani o'qisa butun ilova, /tg ham,
 * dinamik bo'lib qolardi), shuning uchun ular doim shu o'zgarmas manzilga
 * qaraydi, rasmni esa bu yer tanlaydi. Logotip yuklanmagan bo'lsa — eski
 * statik belgiga yo'naltiriladi.
 *
 * Manzil `.png` bilan tugamaydi: sw.js `.png` larni abadiy keshlaydi va
 * logotip almashsa ham telefonda eskisi qolib ketardi.
 *
 *   ?s=180  — iPhone (apple-touch-icon)
 *   ?s=192, ?s=512 — Android va brauzer
 *   ?s=512&m=1 — "maskable": Android belgini doira yoki boshqa shaklda
 *                kesadi, shuning uchun logotip chetdan uzoqroq turadi
 */
const FALLBACK: Record<string, string> = {
  "180": "/apple-touch-icon.png",
  "192": "/icon-192.png",
  "512": "/icon-512.png",
  "512m": "/icon-maskable-512.png",
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = params.get("s") ?? "192";
  const maskable = params.get("m") === "1" && size === "512";
  const key = maskable ? "512m" : size;
  if (!FALLBACK[key]) return new Response(null, { status: 404 });

  const logo = await getLogo();
  if (!logo) {
    return new Response(null, {
      status: 307,
      headers: { Location: FALLBACK[key], "Cache-Control": "no-cache" },
    });
  }

  // Belgi kam o'zgaradi, lekin o'zgarganda tez yangilanishi kerak: brauzer har
  // safar so'raydi, rasm o'sha bo'lsa 304 bilan qaytadi (qayta chizilmaydi)
  const etag = `"${logo.updatedAt?.getTime() ?? 0}-${key}"`;
  const headers = { "Cache-Control": "no-cache", ETag: etag };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const px = Number(size);
  // Maskable'da Android markazdagi 80% li doiradan tashqarisini kesib
  // tashlashi mumkin — kvadrat logotip butunligicha o'sha doiraga sig'ishi uchun
  // har tomondan ~20% joy qoldiriladi
  const pad = maskable ? 0.2 : 0.08;
  const inner = Math.round(px * (1 - 2 * pad));
  const white = { r: 255, g: 255, b: 255, alpha: 1 };

  let png: Buffer;
  try {
    const mark = await sharp(logo.data)
      .resize(inner, inner, { fit: "contain", background: white })
      .flatten({ background: white })
      .png()
      .toBuffer();
    png = await sharp({ create: { width: px, height: px, channels: 3, background: white } })
      .composite([{ input: mark, gravity: "center" }])
      .png()
      .toBuffer();
  } catch {
    // Rasm buzilgan bo'lsa ham ilova belgisiz qolmasin
    return new Response(null, {
      status: 307,
      headers: { Location: FALLBACK[key], "Cache-Control": "no-cache" },
    });
  }

  return new Response(new Uint8Array(png), {
    headers: { ...headers, "Content-Type": "image/png", "X-Content-Type-Options": "nosniff" },
  });
}
