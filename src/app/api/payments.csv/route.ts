import { prisma } from "@/lib/prisma";
import { requireRole, branchWhere } from "@/lib/auth";
import { monthRange } from "@/lib/stats";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";

/**
 * To'lovlar ro'yxatini Excel ochadigan faylga yuklash.
 *
 * Doira sahifadagidek: ega hamma filialni, qolganlar o'zinikini. Ro'yxatga
 * konsultatsiya puli ham qo'shiladi — To'lovlar sahifasidagi jami shu ikkisi.
 *
 * Excel UTF-8 ni BOM'siz o'qimaydi (kirill va o'zbekcha harflar buziladi),
 * shuning uchun fayl boshida "﻿" turadi.
 */
export async function GET(req: Request) {
  const user = await requireRole("OWNER", "BRANCH_ADMIN", "RECEPTION");
  const url = new URL(req.url);

  const offset = Number.parseInt(url.searchParams.get("m") ?? "0", 10) || 0;
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const { from, to } = monthRange(base);

  const branchId = user.role === "OWNER" ? url.searchParams.get("b") || null : user.branchId;

  const [payments, intakes] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: from, lt: to }, ...branchWhere(branchId) },
      orderBy: { paidAt: "desc" },
      include: {
        client: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.intake.findMany({
      where: { paidAt: { gte: from, lt: to }, ...branchWhere(branchId) },
      orderBy: { paidAt: "desc" },
      include: { branch: { select: { name: true } } },
    }),
  ]);

  const day = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // "=" yoki "+" bilan boshlangan matn Excel'da formula bo'lib ketmasin
  const cell = (v: string | number) => {
    const x = String(v ?? "");
    const safe = /^[=+\-@]/.test(x) ? `'${x}` : x;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const rows = [
    ["Sana", "Tur", "Kim", "Filial", "Usul", "Summa", "Izoh"],
    ...payments.map((p) => [
      day(p.paidAt),
      "To'lov",
      p.client.fullName,
      p.branch.name,
      PAYMENT_METHODS[p.method as PaymentMethod] ?? p.method,
      p.amount,
      p.note ?? "",
    ]),
    ...intakes.map((i) => [
      day(i.paidAt as Date),
      "Konsultatsiya",
      i.childName,
      i.branch.name,
      PAYMENT_METHODS[i.method as PaymentMethod] ?? i.method,
      i.price,
      i.note ?? "",
    ]),
  ];

  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const name = `tolovlar-${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      // Shaxsiy ma'lumot — oraliq keshlarda qolmasin
      "Cache-Control": "no-store",
    },
  });
}
