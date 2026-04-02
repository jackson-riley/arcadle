/**
 * Apply canonical-genres.json to lib/games.ts (title → genre only).
 * Run: node scripts/apply-canonical-genres.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const map = JSON.parse(
  fs.readFileSync(path.join(__dirname, "canonical-genres.json"), "utf8")
);
/** DB title → key in the same map when the transcript used a shorter name */
const ALIASES_TO_MASTER_KEY = {
  "Middle-earth: Shadow of Mordor": "Shadow of Mordor",
  "Mario Kart Wii": "Mario Kart 8 Deluxe",
};
for (const [title, master] of Object.entries(ALIASES_TO_MASTER_KEY)) {
  if (map[title] === undefined && map[master] !== undefined) {
    map[title] = map[master];
  }
}
const gamesPath = path.join(root, "lib/games.ts");
const lines = fs.readFileSync(gamesPath, "utf8").split("\n");
let pendingTitle = null;
const out = [];
for (let line of lines) {
  const titleMatch = line.match(/^(\s*)title:\s*"((?:\\.|[^"\\])*)"\s*,?\s*$/);
  if (titleMatch) {
    pendingTitle = titleMatch[2].replace(/\\"/g, '"');
  }
  const genreMatch = line.match(/^(\s*)genre:\s*"[^"]*"\s*,?\s*$/);
  if (genreMatch && pendingTitle != null && map[pendingTitle] !== undefined) {
    const g = map[pendingTitle].replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    line = `${genreMatch[1]}genre: "${g}",`;
    pendingTitle = null;
  } else if (genreMatch && pendingTitle != null) {
    pendingTitle = null;
  }
  out.push(line);
}
fs.writeFileSync(gamesPath, out.join("\n"), "utf8");
console.log("Updated lib/games.ts");
