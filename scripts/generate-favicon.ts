import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import toIco from "to-ico";

const root = path.join(__dirname, "..");
const SIZE = 32;
const BG = "#09090b";
/** Matches header / `app/opengraph-image.tsx` wordmark (Outfit extrabold, “lud” only). */
const LUD_COLOR = "#E8E4DF";

/** Same file as `opengraph-image.tsx` — keeps favicon typography aligned with the site. */
const OUTFIT_800_TTF =
  "https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4bCyC4E.ttf";

function faviconSvg(fontBase64: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'Outfit';
        font-style: normal;
        font-weight: 800;
        src: url('data:font/truetype;charset=utf-8;base64,${fontBase64}') format('truetype');
      }
    ]]></style>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="4" ry="4" fill="${BG}"/>
  <text
    x="16"
    y="20"
    text-anchor="middle"
    font-family="Outfit, sans-serif"
    font-weight="800"
    font-size="12"
    fill="${LUD_COLOR}"
    letter-spacing="-0.03em"
  >lud</text>
</svg>`;
}

async function main() {
  const res = await fetch(OUTFIT_800_TTF);
  if (!res.ok) {
    throw new Error(`Failed to fetch Outfit font: ${res.status} ${res.statusText}`);
  }
  const fontBuf = Buffer.from(await res.arrayBuffer());
  const fontBase64 = fontBuf.toString("base64");

  const png = await sharp(Buffer.from(faviconSvg(fontBase64)))
    .resize(SIZE, SIZE)
    .png()
    .toBuffer();

  const appIcon = path.join(root, "app", "icon.png");
  fs.writeFileSync(appIcon, png);

  const ico = await toIco([png]);
  const publicIco = path.join(root, "public", "favicon.ico");
  fs.mkdirSync(path.dirname(publicIco), { recursive: true });
  fs.writeFileSync(publicIco, ico);

  console.log(`Wrote ${path.relative(root, appIcon)}`);
  console.log(`Wrote ${path.relative(root, publicIco)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
