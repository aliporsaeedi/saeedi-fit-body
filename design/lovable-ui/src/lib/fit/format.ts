export function todayISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return todayISO(d);
}
export function isISODate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

const faDate = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", opts);
export function jalaliLong(d = new Date()) { return faDate({ weekday: "long", day: "numeric", month: "long" }).format(d); }
export function jalaliShort(iso: string) { return isISODate(iso) ? faDate({ day: "numeric", month: "short" }).format(new Date(iso + "T12:00:00")) : iso; }
export function latinStamp(d = new Date()) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short" }).format(d).replace(",", " ·");
}
export function fmt(n: number | null | undefined, digits = 0) {
  if (n == null || !isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "شب بخیر";
  if (h < 12) return "صبح بخیر";
  if (h < 17) return "ظهر بخیر";
  return "عصر بخیر";
}
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
/** Shrinks a photo before upload so phones on slow networks stay fast. */
export async function compressImage(file: File, max = 1400): Promise<{ base64: string; type: string }> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.85);
    return { base64: url.split(",")[1] || "", type: "image/jpeg" };
  } catch {
    return { base64: await fileToBase64(file), type: file.type || "image/jpeg" };
  }
}

