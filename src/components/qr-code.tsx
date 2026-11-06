import QRCode from "qrcode";

/** Server-rendered QR code (SVG) — no external service involved. */
export async function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 1, width: size, color: { dark: "#123221", light: "#ffffff" } });
  return <div className="inline-block rounded-lg border bg-white p-2" style={{ width: size + 18 }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
