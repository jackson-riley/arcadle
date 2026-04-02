/**
 * One-time: parse canonical genre list from agent transcript JSONL (user message with mapping).
 * Run: node scripts/extract-genres-from-transcript.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const transcriptPath = path.join(
  process.env.HOME || "",
  ".cursor/projects/Users-jacksontidland-ludle-ludle/agent-transcripts/07491b0a-49ae-491d-8ffe-8dc7f756e31c/07491b0a-49ae-491d-8ffe-8dc7f756e31c.jsonl"
);

const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
const row = JSON.parse(lines[86]);
const text = row.message.content[0].text;
const m = text.match(/<user_query>\n([\s\S]*?)\n<\/user_query>/);
if (!m) {
  console.error("Could not find user_query block");
  process.exit(1);
}
const body = m[1];
const map = {};
for (const line of body.split("\n")) {
  const g = line.match(/^\s*"([^"]+)":\s*"([^"]+)"\s*,?\s*$/);
  if (g) map[g[1]] = g[2];
}
const outPath = path.join(__dirname, "canonical-genres.json");
fs.writeFileSync(outPath, JSON.stringify(map, null, 2), "utf8");
console.log("Wrote", Object.keys(map).length, "titles to", outPath);
