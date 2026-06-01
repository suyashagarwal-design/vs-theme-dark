#!/usr/bin/env node
// Build the HRDS icon theme from icons/icon-mapping.json + tokens/tokens.json.
//
// For each definition:
//   {glyph}  → recolor icons/svg/<glyph>.svg (white → HRDS hex), write colored/<id>.svg
//   {badge}  → generate an outlined rounded-rect + Geist-Mono letters in the HRDS hex
//
// Emits icons/hrds-icon-theme.json with iconDefinitions + file/fileExtensions/
// fileNames/languageIds. NO folder icons are emitted — folders render chevron-only
// (Seti-style), which keeps the tree uncluttered.
//
// HRDS guarantee: every color is resolved from tokens.json by token name; the only
// hex literals this script emits are those resolved values.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import opentype from "opentype.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const mappingPath = join(root, "icons/icon-mapping.json");
const tokensPath  = join(root, "tokens/tokens.json");
const svgDir      = join(root, "icons/svg");
const outDir      = join(root, "icons/colored");
const themePath   = join(root, "icons/hrds-icon-theme.json");
const badgeFont   = join(root, "fonts/GeistMono-SemiBold.ttf");

function flattenTokens (tokens) {
  const out = new Map();
  for (const [group, entries] of Object.entries(tokens)) {
    if (group.startsWith("_")) continue;
    for (const [name, def] of Object.entries(entries)) out.set(`${group}/${name}`, def.hex);
  }
  return out;
}

// Recolor a white Lucide SVG to the target hex at full opacity.
function recolorGlyph (svg, hex) {
  return svg
    .replace(/(stroke|fill)="#ffffff"/gi, `$1="${hex}"`)
    .replace(/stroke-opacity="[^"]*"/gi, 'stroke-opacity="1"')
    .replace(/fill-opacity="[^"]*"/gi, 'fill-opacity="1"');
}

// Filled portrait rounded-rect (the language color) + dark letters rendered as
// VECTOR PATHS (Geist Mono SemiBold via opentype.js) — so badges need no font
// installed and look identical everywhere. Portrait 14×16 tag on the 20×20 grid.
function makeBadge (label, fillHex, textHex, font) {
  const cx = 10, cy = 10;          // chip centre
  const maxTextWidth = 12;         // keep ~1px padding inside the 14-wide chip
  let fontSize = label.length <= 1 ? 11 : label.length === 2 ? 9 : 7.5;

  // Shrink to fit if the advance is too wide (e.g. "C++", "PHP").
  let advance = font.getAdvanceWidth(label, fontSize);
  if (advance > maxTextWidth) { fontSize *= maxTextWidth / advance; advance = maxTextWidth; }

  // Vertically centre on cap height; opentype positions glyphs on the baseline.
  const unitsPerEm = font.unitsPerEm;
  const capHeight  = (font.tables.os2 && font.tables.os2.sCapHeight) || unitsPerEm * 0.7;
  const capPx      = (capHeight / unitsPerEm) * fontSize;
  const x = cx - advance / 2;
  const y = cy + capPx / 2;

  const d = font.getPath(label, x, y, fontSize).toPathData(2);
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="3" y="2" width="14" height="16" rx="3" fill="${fillHex}"/>
<path d="${d}" fill="${textHex}"/>
</svg>
`;
}

async function main () {
  const mapping = JSON.parse(await readFile(mappingPath, "utf8"));
  const tokens  = JSON.parse(await readFile(tokensPath, "utf8"));
  const palette = flattenTokens(tokens);

  const resolve = (token) => {
    const hex = palette.get(token);
    if (!hex) throw new Error(`Unknown HRDS token "${token}" in icon-mapping.json`);
    if (hex === "TBD:figma") throw new Error(`Token "${token}" is unresolved (TBD:figma)`);
    return hex;
  };

  // Fresh colored/ dir so removed defs don't leave stale files.
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const badgeTextHex = resolve("core/background");   // dark text on filled badges
  const fontBuf = readFileSync(badgeFont);           // Geist Mono SemiBold for badge glyphs
  const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));

  const iconDefinitions = {};
  let badges = 0, glyphs = 0;

  for (const [id, def] of Object.entries(mapping.definitions)) {
    const hex = resolve(def.color);
    let svg;
    if (def.badge) { svg = makeBadge(def.badge, hex, badgeTextHex, font); badges++; }
    else {
      const base = await readFile(join(svgDir, `${def.glyph}.svg`), "utf8");
      svg = recolorGlyph(base, hex);
      glyphs++;
    }
    await writeFile(join(outDir, `${id}.svg`), svg, "utf8");
    iconDefinitions[id] = { iconPath: `./colored/${id}.svg` };
  }

  const theme = {
    iconDefinitions,
    file: mapping.default,
    fileExtensions: mapping.fileExtensions,
    fileNames: mapping.fileNames,
    languageIds: mapping.languageIds,
    hidesExplorerArrows: false
  };
  // Deliberately NO folder / folderExpanded / rootFolder keys → folders show
  // the chevron only, no glyph.

  await writeFile(themePath, JSON.stringify(theme, null, 2) + "\n", "utf8");
  console.log(`✓ ${badges} badges + ${glyphs} glyphs → icons/colored/`);
  console.log(`✓ wrote icons/hrds-icon-theme.json (no folder icons)`);
}

main().catch(err => { console.error("✗ build-icons failed:", err.message); process.exit(1); });
