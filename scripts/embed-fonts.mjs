#!/usr/bin/env node
// Embed bundled fonts as base64 @font-face into the override CSS files so the
// editor/UI (via Custom CSS) and the markdown preview (webview) use the correct
// fonts with no OS install. Relative url() doesn't resolve in either context;
// data URIs do.
//
// Writes the generated @font-face block between the markers:
//   /* FONTS:START */ … /* FONTS:END */
// in overrides/hrds-dark.css and overrides/markdown-preview.css.
//
// Any font whose file is missing is skipped (e.g. Kalice until dropped in) — the
// CSS falls back to the next family in the font stack.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const fontsDir = join(root, "fonts");
const targets = [
  join(root, "overrides/hrds-dark.css"),
  join(root, "overrides/markdown-preview.css")
];

// filename (in fonts/) → { family, weight }. woff2 only (data-URI friendly).
const FONT_MAP = [
  { file: "Geist-Regular.woff2",      family: "Geist",      weight: 400 },
  { file: "Geist-Medium.woff2",       family: "Geist",      weight: 500 },
  { file: "Geist-SemiBold.woff2",     family: "Geist",      weight: 600 },
  { file: "GeistMono-Regular.woff2",  family: "Geist Mono", weight: 400 },
  { file: "GeistMono-Medium.woff2",   family: "Geist Mono", weight: 500 }
];

// mime + CSS format() keyword per file extension (woff2 preferred; otf/ttf work as data URIs too).
function fontType (file) {
  if (/\.woff2$/i.test(file)) return { mime: "font/woff2",    fmt: "woff2" };
  if (/\.otf$/i.test(file))   return { mime: "font/otf",      fmt: "opentype" };
  if (/\.ttf$/i.test(file))   return { mime: "font/ttf",      fmt: "truetype" };
  if (/\.woff$/i.test(file))  return { mime: "font/woff",     fmt: "woff" };
  return null;
}

async function main () {
  const present = new Set(await readdir(fontsDir));

  // Auto-discover any Kalice font dropped into fonts/ (.woff2/.otf/.ttf; weight from filename, else 400).
  const kaliceFiles = [...present].filter(f => /^kalice.*\.(woff2|otf|ttf|woff)$/i.test(f));
  for (const file of kaliceFiles) {
    const m = file.match(/(\d{3})/);
    FONT_MAP.push({ file, family: "Kalice", weight: m ? Number(m[1]) : 400 });
  }

  const blocks = [];
  let embedded = 0;
  for (const { file, family, weight } of FONT_MAP) {
    if (!present.has(file)) { continue; }
    const t = fontType(file);
    if (!t) continue;
    const b64 = (await readFile(join(fontsDir, file))).toString("base64");
    blocks.push(
      `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
      `font-display:swap;src:url(data:${t.mime};base64,${b64}) format('${t.fmt}');}`
    );
    embedded++;
  }

  const generated = `/* FONTS:START */\n${blocks.join("\n")}\n/* FONTS:END */`;
  const region = /\/\* FONTS:START \*\/[\s\S]*?\/\* FONTS:END \*\//;

  for (const target of targets) {
    let css = await readFile(target, "utf8");
    if (!region.test(css)) throw new Error(`No FONTS markers in ${target}`);
    css = css.replace(region, generated);
    await writeFile(target, css, "utf8");
  }

  const missingKalice = !kaliceFiles.length;
  console.log(`✓ embedded ${embedded} fonts into ${targets.length} CSS files`);
  if (missingKalice) console.warn("⚠ no Kalice*.woff2 in fonts/ — markdown headings fall back to system serif until added");
}

main().catch(err => { console.error("✗ embed-fonts failed:", err.message); process.exit(1); });
