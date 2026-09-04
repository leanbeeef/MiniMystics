import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { parseMoves } from "../lib/game/move-parser";
import type { CardCatalog, HandlerDefinition, MysticDefinition, Rarity } from "../lib/game/types";

const root = process.cwd();
const outputDir = path.join(root, "lib", "data");
const publicCards = path.join(root, "public", "cards");
const rarities = new Set(["Wild", "Hunter", "Predator", "Prime", "Alpha", "Apex"]);
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const assetAliases: Record<string, string> = {
  Kairo: "kario.png",
  Wildfire: "wildfire_fiery_creature_stat_card.png",
  "Mr. Alden": "mralden.png",
  "Captain Edmund": "edmund.png",
  "Arch, The Fallen": "arch.png",
  "Captain Vesper": "vesper.png",
  "Lieutenant Morrow": "morrow.png",
};

function readCsv<T>(filename: string) {
  const parsed = Papa.parse<T>(fs.readFileSync(path.join(root, filename), "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`${filename}: ${parsed.errors.map((e) => `row ${e.row}: ${e.message}`).join("; ")}`);
  return parsed.data;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}

const imageFiles = [
  ...walk(path.join(root, "Mystics")),
  ...walk(path.join(root, "Handlers")),
  ...walk(path.join(root, "public", "cards", "Mystics")),
  ...walk(path.join(root, "public", "cards", "Handlers")),
].filter((file) => /\.(png|jpe?g|webp)$/i.test(file));
const imageMap = new Map(imageFiles.map((file) => [normalize(path.basename(file, path.extname(file)).replace(/the.*$/i, "")), file]));
const findImage = (name: string, filename?: string) => {
  const requested = assetAliases[name] || filename;
  const exact = requested ? imageFiles.find((file) => path.basename(file).toLowerCase() === requested.toLowerCase()) : undefined;
  const source = exact ?? imageMap.get(normalize(name));
  if (!source) return null;
  const publicRoot = path.join(root, "public");
  if (source.startsWith(publicRoot)) {
    return `/${path.relative(publicRoot, source).replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/")}`;
  }
  const relative = path.relative(root, source).replace(/\\/g, "/");
  return `/cards/${relative.split("/").map(encodeURIComponent).join("/")}`;
};

type MysticRow = { "MM #": string; Name: string; Order: string; Allegiance: string; Rarity: string; Power: string; Def: string; "Base Attack": string; Moves: string };
type HandlerRow = { "Handler #": string; Name: string; Allegiance: string; Order: string; Rarity: string; "Activation Roll": string; "Activation Dice": string; Effect: string; "Effect Type": string; "Effect Value": string; Duration: string; "Max Uses": string; Target: string; "Image Filename": string; Notes: string };

const warnings: string[] = [];
const mystics: MysticDefinition[] = readCsv<MysticRow>("mini_mystics.csv").map((row, rowIndex) => {
  const required = [row["MM #"], row.Name, row.Order, row.Rarity, row.Power, row.Def, row["Base Attack"], row.Moves];
  if (required.some((value) => !value)) throw new Error(`mini_mystics.csv row ${rowIndex + 2}: missing required value`);
  if (!rarities.has(row.Rarity)) throw new Error(`mini_mystics.csv row ${rowIndex + 2}: unknown rarity '${row.Rarity}'`);
  const moves = parseMoves(row.Moves);
  moves.filter((move) => move.needsReview).forEach((move) => warnings.push(`${row["MM #"]} ${row.Name} — ${move.rawText}: ${move.reviewReason}`));
  const image = findImage(row.Name);
  if (!image) warnings.push(`${row["MM #"]} ${row.Name} — image not found`);
  return { id: row["MM #"], name: row.Name, order: row.Order, allegiance: row.Allegiance, rarity: row.Rarity as Rarity, power: Number(row.Power), defense: Number(row.Def), baseAttack: Number(row["Base Attack"]), moves, image };
});

const handlers: HandlerDefinition[] = readCsv<HandlerRow>("handlers.csv").map((row, rowIndex) => {
  if (!row["Handler #"] || !row.Name || !row.Effect) throw new Error(`handlers.csv row ${rowIndex + 2}: missing required value`);
  const sourceRarity = row.Rarity;
  const rarity = rarities.has(sourceRarity) ? sourceRarity as Rarity : "Unassigned";
  if (rarity === "Unassigned") warnings.push(`${row["Handler #"]} ${row.Name} — rarity '${sourceRarity}' imported as Unassigned`);
  const image = findImage(row.Name, row["Image Filename"]);
  if (!image) warnings.push(`${row["Handler #"]} ${row.Name} — image '${row["Image Filename"]}' not found`);
  const rollValue = Number(row["Activation Roll"].match(/\d/)?.[0] ?? 6);
  return { id: row["Handler #"], name: row.Name, allegiance: row.Allegiance, order: row.Order, rarity, originalRarity: sourceRarity, activationRoll: rollValue, exactRoll: !row["Activation Roll"].includes("+"), activationDice: Number(row["Activation Dice"]), effect: row.Effect, effectType: row["Effect Type"], effectValue: row["Effect Value"], duration: row.Duration, maxUses: Number(row["Max Uses"]), target: row.Target.includes("enemy") ? "enemy" : "ally", image, notes: row.Notes };
});

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(publicCards, { recursive: true });
if (fs.existsSync(path.join(root, "Mystics"))) fs.cpSync(path.join(root, "Mystics"), path.join(publicCards, "Mystics"), { recursive: true });
if (fs.existsSync(path.join(root, "Handlers"))) fs.cpSync(path.join(root, "Handlers"), path.join(publicCards, "Handlers"), { recursive: true });
const catalog: CardCatalog = { mystics, handlers, importWarnings: warnings };
fs.writeFileSync(path.join(outputDir, "cards.generated.json"), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Imported ${mystics.length} Mystics and ${handlers.length} Handlers.`);
console.log(`${warnings.length} warnings written into cards.generated.json.`);
