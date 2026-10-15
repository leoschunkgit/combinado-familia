import { mkdir, writeFile } from "node:fs/promises";

const outputDir = "dist/client";
await mkdir(outputDir, { recursive: true });
await writeFile(`${outputDir}/_redirects`, "/* /index.html 200\n", "utf8");

console.log("Netlify SPA redirect written to dist/client/_redirects");
