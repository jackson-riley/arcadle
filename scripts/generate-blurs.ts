import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.join(__dirname, "..");
const screenshotsRoot = path.join(root, "public", "screenshots");

const BLUR_SIGMAS = [40, 30, 20, 12, 6, 0];
const WIDTH = 889;
const HEIGHT = 500;

async function processGameDir(dir: string) {
  const originalPath = path.join(dir, "original.jpg");
  if (!fs.existsSync(originalPath)) return;

  const originalStat = fs.statSync(originalPath);

  const outputs = [
    ...BLUR_SIGMAS.map((_, i) => path.join(dir, `blur-${i}.jpg`)),
    path.join(dir, "solved.jpg"),
  ];

  // Skip if all outputs exist and are newer than original
  if (
    outputs.every(
      (p) => fs.existsSync(p) && fs.statSync(p).mtimeMs >= originalStat.mtimeMs
    )
  ) {
    console.log(`Skipping ${dir} (blurs up to date)`);
    return;
  }

  console.log(`Generating blurs for ${dir}`);

  const img = sharp(originalPath).resize(WIDTH, HEIGHT, { fit: "cover" });

  await Promise.all(
    BLUR_SIGMAS.map(async (sigma, idx) => {
      const out = path.join(dir, `blur-${idx}.jpg`);
      const pipeline = sigma > 0 ? img.clone().blur(sigma) : img.clone();
      await pipeline.jpeg({ quality: 80 }).toFile(out);
    })
  );

  // Solved image: clean, resized
  const solvedOut = path.join(dir, "solved.jpg");
  await img.clone().jpeg({ quality: 90 }).toFile(solvedOut);
}

async function main() {
  if (!fs.existsSync(screenshotsRoot)) {
    console.error(`No screenshots directory at ${screenshotsRoot}`);
    process.exit(1);
  }

  const gameDirs = fs
    .readdirSync(screenshotsRoot)
    .map((name) => path.join(screenshotsRoot, name))
    .filter((p) => fs.statSync(p).isDirectory());

  for (const dir of gameDirs) {
    await processGameDir(dir);
  }

  console.log("Done generating blur levels.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

