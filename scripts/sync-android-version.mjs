import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "public", "app-version.json");
const gradleCandidates = [
  path.join(root, "android", "app", "build.gradle"),
  path.join(root, "android", "app", "build.gradle.kts"),
];

const config = JSON.parse(await readFile(configPath, "utf8"));
const versionName = String(config.versionName ?? "").trim();
const versionCode = Number(config.versionCode);

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName)) {
  throw new Error(`versionName inválido: ${versionName}`);
}
if (!Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error(`versionCode inválido: ${config.versionCode}`);
}

const gradlePath = gradleCandidates.find(existsSync);
if (!gradlePath) {
  throw new Error("Projeto Android não encontrado.");
}

let gradle = await readFile(gradlePath, "utf8");

if (gradlePath.endsWith(".kts")) {
  gradle = gradle
    .replace(/versionCode\s*=\s*\d+/, `versionCode = ${versionCode}`)
    .replace(/versionName\s*=\s*"[^"]*"/, `versionName = "${versionName}"`);
} else {
  gradle = gradle
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
}

await writeFile(gradlePath, gradle);
console.log(`Android: versionName=${versionName}, versionCode=${versionCode}`);
