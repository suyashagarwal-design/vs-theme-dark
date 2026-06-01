#!/usr/bin/env node
// One-time icon export from the HRDS Definition Figma file.
// Pulls every immediate-child SVG under the Icons frame (5124:6995) into
// icons/svg/<icon-name>.svg, using the Lucide naming from Figma verbatim.
//
// Requires FIGMA_TOKEN (personal access token with file_read scope) in env.

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FILE_KEY    = "yIltK4T4z2tlZWjaMqlZTW";
const ICONS_FRAME = "5124:6995";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "icons", "svg");

// Resolve the foreground color from tokens.json so the swap stays HRDS-sourced.
async function getForegroundHex () {
  const tokens = JSON.parse(await readFile(join(root, "tokens/tokens.json"), "utf8"));
  return tokens.core.foreground.hex;
}

// Figma exports icons stroked with the LIGHT-mode foreground (#141419).
// For dark mode we swap to the DARK-mode foreground from HRDS.
function tintSvg (svg, fromHex, toHex) {
  const lc = (s) => s.toLowerCase();
  return svg
    .replace(new RegExp(`(stroke|fill)="${fromHex}"`, "gi"), `$1="${toHex}"`)
    .split("\n").join("\n");
}

const TOKEN = process.env.FIGMA_TOKEN;
if (!TOKEN) {
  console.error("Set FIGMA_TOKEN env var (Figma → Settings → Personal access tokens).");
  process.exit(1);
}

const fig = (path) => fetch(`https://api.figma.com/v1${path}`, {
  headers: { "X-Figma-Token": TOKEN }
}).then(r => {
  if (!r.ok) throw new Error(`Figma API ${r.status}: ${path}`);
  return r.json();
});

async function main () {
  await mkdir(outDir, { recursive: true });
  const fg = await getForegroundHex();
  console.log(`→ tint target: stroke/fill ${"#141419"} → ${fg} (HRDS core/foreground, dark)`);

  console.log(`→ fetching Icons frame children…`);
  const frame = await fig(`/files/${FILE_KEY}/nodes?ids=${ICONS_FRAME}`);
  const node  = frame.nodes[ICONS_FRAME]?.document;
  if (!node) throw new Error(`Icons frame ${ICONS_FRAME} not found`);

  // Each child is a 96×28 frame with 3 size variants. We want the "Size=20" symbol.
  const iconNodes = [];
  for (const child of node.children ?? []) {
    if (!child.children) continue;
    const size20 = child.children.find(c => c.name === "Size=20");
    if (size20) iconNodes.push({ name: child.name, id: size20.id });
  }
  console.log(`  found ${iconNodes.length} icons`);

  // Figma's /images endpoint accepts up to ~50-100 ids per call.
  const CHUNK = 50;
  let done = 0;
  for (let i = 0; i < iconNodes.length; i += CHUNK) {
    const batch = iconNodes.slice(i, i + CHUNK);
    const ids   = batch.map(n => n.id).join(",");
    const res   = await fig(`/images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=svg`);
    if (res.err) throw new Error(`Figma images: ${res.err}`);

    await Promise.all(batch.map(async ({ name, id }) => {
      const url = res.images[id];
      if (!url) { console.warn(`  ⚠ no url for ${name} (${id})`); return; }
      const raw = await fetch(url).then(r => r.text());
      const svg = tintSvg(raw, "#141419", fg);
      await writeFile(join(outDir, `${name}.svg`), svg, "utf8");
      done++;
    }));
    console.log(`  ${done}/${iconNodes.length}…`);
  }
  console.log(`✓ exported ${done} icons → icons/svg/`);
}

main().catch(err => {
  console.error("✗ icon export failed:", err.message);
  process.exit(1);
});
