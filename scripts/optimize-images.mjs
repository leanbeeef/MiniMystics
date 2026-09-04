import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const publicDirectory = path.resolve("public");
const outputDirectory = path.join(publicDirectory, "optimized");
const supportedExtensions = new Set([".png", ".jpg", ".jpeg"]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "optimized") continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(absolutePath));
    else if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) files.push(absolutePath);
  }
  return files;
}

function settings(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  if (normalized.startsWith("cards/")) return { width: 640, quality: 82 };
  if (normalized.startsWith("comic/")) return { width: 1015, quality: 86 };
  if (normalized.includes("/backgrounds/") || normalized.includes("/coming soon/")) return { width: 1920, quality: 80 };
  if (normalized.includes("/orders/") || normalized.includes("/allegiances/")) return { width: 256, quality: 82 };
  if (normalized.includes("/rank/") || normalized.includes("/opponents/")) return { width: 512, quality: 82 };
  return { width: 640, quality: 82 };
}

async function isCurrent(source, destination) {
  try {
    const [sourceInfo, destinationInfo] = await Promise.all([stat(source), stat(destination)]);
    return destinationInfo.mtimeMs >= sourceInfo.mtimeMs;
  } catch {
    return false;
  }
}

async function optimize(source) {
  const relativePath = path.relative(publicDirectory, source);
  const destination = path.join(outputDirectory, relativePath.replace(/\.(png|jpe?g)$/i, ".webp"));
  if (await isCurrent(source, destination)) return false;
  await mkdir(path.dirname(destination), { recursive: true });
  const { width, quality } = settings(relativePath);
  await sharp(source)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 4, smartSubsample: true })
    .toFile(destination);
  return true;
}

const files = await sourceFiles(publicDirectory);
let generated = 0;
const concurrency = 4;
for (let index = 0; index < files.length; index += concurrency) {
  const results = await Promise.all(files.slice(index, index + concurrency).map(optimize));
  generated += results.filter(Boolean).length;
}

console.log(`Optimized image assets ready (${generated} generated, ${files.length - generated} current).`);
