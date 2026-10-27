import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
let html = await readFile(resolve(dist, "index.html"), "utf8");
const contents = new Map();
for (const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^\"]+)"/g)) {
  contents.set(match[1], await readFile(resolve(dist, match[1]), "utf8"));
}
html = html.replace(
  /<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,
  (_, file) => {
    if (!contents.has(file))
      throw new Error(`Script externo inesperado: ${file}`);
    return `<script type="module">${contents.get(file).replace(/<\/script/gi, "<\\/script")}</script>`;
  },
);
html = html.replace(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g, (_, file) => {
  if (!contents.has(file))
    throw new Error(`Estilo externo inesperado: ${file}`);
  return `<style>${contents.get(file)}</style>`;
});
await Promise.all([
  writeFile(resolve(root, "revolution-manager.html"), html),
  writeFile(resolve(dist, "revolution-manager.html"), html),
]);
console.log(`HTML independente gerado: ${Buffer.byteLength(html)} bytes`);
