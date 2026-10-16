/**
 * Markaz belgisi: logotip yuklangan bo'lsa rasm, bo'lmasa "L" harfi.
 *
 * Oddiy <img> ishlatilgan, next/image emas: rasm o'zimizning /api/logo
 * manzilidan keladi va allaqachon kichik, qayta ishlash shart emas.
 */
export function BrandMark({
  logoUrl,
  size = "md",
}: {
  logoUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  // Logotiplar odatda mayda detalli rasm — kichik katakda ko'rinmay qolardi,
  // shuning uchun belgi matndan ancha katta qilingan
  const box = {
    sm: "h-13 w-13 text-base",
    md: "h-18 w-18 text-xl",
    lg: "h-28 w-28 text-3xl rounded-2xl",
  }[size];
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        data-testid="brand-logo"
        className={`${box} shrink-0 rounded-lg bg-white object-contain`}
      />
    );
  }
  return (
    <div
      className={`${box} flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white`}
    >
      L
    </div>
  );
}
