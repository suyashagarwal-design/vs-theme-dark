#!/usr/bin/env node
// Pull all variable hex values + text-style numeric properties from the HRDS
// Definition Figma file in one shot. Updates tokens/tokens.json and
// tokens/text-styles.json in place, replacing any TBD:figma values.
//
// Requires FIGMA_TOKEN (file_read scope) in env.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FILE_KEY = "yIltK4T4z2tlZWjaMqlZTW";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const TOKEN = process.env.FIGMA_TOKEN;
if (!TOKEN) {
  console.error("Set FIGMA_TOKEN env var.");
  process.exit(1);
}

const fig = (path) => fetch(`https://api.figma.com/v1${path}`, {
  headers: { "X-Figma-Token": TOKEN }
}).then(async r => {
  if (!r.ok) throw new Error(`Figma API ${r.status} ${r.statusText} on ${path}: ${await r.text()}`);
  return r.json();
});

function rgbaToHex ({ r, g, b, a }) {
  const ch = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  const hex = `#${ch(r)}${ch(g)}${ch(b)}`;
  return a < 1 ? `${hex}${ch(a)}` : hex;
}

function unitToCss (n, unit) {
  if (unit === "PERCENT") return `${n}%`;
  if (unit === "PIXELS")  return `${n}px`;
  if (unit === "AUTO")    return "normal";
  return String(n);
}

async function main () {
  // ─── Variables ───────────────────────────────────────────────────────
  try {
    console.log("→ fetching local variables…");
    const varsResp = await fig(`/files/${FILE_KEY}/variables/local`);
    const meta     = varsResp.meta || {};
    const variables = meta.variables || {};
    const sets      = meta.variableCollections || {};

    const darkModeId = {};
    for (const [id, set] of Object.entries(sets)) {
      const mode = (set.modes || []).find(m => /dark/i.test(m.name));
      if (mode) darkModeId[id] = mode.modeId;
    }

    const variableByName = {};
    for (const v of Object.values(variables)) variableByName[v.name] = v;

    const resolveVar = (v, seen = new Set()) => {
      if (seen.has(v.id)) return null;
      seen.add(v.id);
      const modeId = darkModeId[v.variableCollectionId] ?? Object.keys(v.valuesByMode)[0];
      const val = v.valuesByMode[modeId];
      if (val == null) return null;
      if (typeof val === "object" && val.type === "VARIABLE_ALIAS") {
        return resolveVar(variables[val.id], seen);
      }
      if (typeof val === "object" && "r" in val) return rgbaToHex(val);
      return val;
    };

    const tokens = JSON.parse(await readFile(join(root, "tokens/tokens.json"), "utf8"));
    let filled = 0, missing = [];

    for (const [group, entries] of Object.entries(tokens)) {
      if (group.startsWith("_")) continue;
      for (const [name, def] of Object.entries(entries)) {
        if (def.hex !== "TBD:figma") continue;
        const v = variableByName[`${group}/${name}`];
        if (!v) { missing.push(`${group}/${name}`); continue; }
        const hex = resolveVar(v);
        if (!hex) { missing.push(`${group}/${name}`); continue; }
        def.hex = hex;
        filled++;
      }
    }

    await writeFile(join(root, "tokens/tokens.json"), JSON.stringify(tokens, null, 2) + "\n");
    console.log(`✓ tokens.json: filled ${filled} hex values; ${missing.length} still missing`);
    if (missing.length) console.warn("  missing:", missing.join(", "));

    // ─── Font-size scale (font/font size/* FLOAT) → tokens/font-sizes.json ──
    const sizes = {};
    for (const v of Object.values(variables)) {
      const m = v.name.match(/^font\/font size\/(.+)$/);
      if (!m) continue;
      const px = resolveVar(v);
      if (typeof px === "number") sizes[m[1]] = `${px}px`;
    }
    if (Object.keys(sizes).length) {
      const out = { _meta: { source: "HRDS Definition · CSS Variables · font/font size/*", note: "Resolved px values of the DS font-size scale." }, sizes };
      await writeFile(join(root, "tokens/font-sizes.json"), JSON.stringify(out, null, 2) + "\n");
      console.log(`✓ font-sizes.json: ${Object.keys(sizes).length} sizes → ${Object.entries(sizes).map(([k,v])=>k+":"+v).join(", ")}`);
    } else {
      console.warn("⚠ no font/font size/* variables resolved");
    }
  } catch (err) {
    if (/file_variables:read/.test(err.message)) {
      console.warn("⚠ skipping variables: token lacks file_variables:read scope. Re-generate the PAT with that scope to fill color hexes.");
    } else throw err;
  }

  // ─── Text styles ─────────────────────────────────────────────────────
  console.log("\n→ fetching text styles…");
  const stylesResp = await fig(`/files/${FILE_KEY}/styles`);
  const styleMetas = (stylesResp.meta?.styles || []).filter(s => s.style_type === "TEXT");
  console.log(`  found ${styleMetas.length} text styles in the file`);

  const styleByName = {};
  for (const s of styleMetas) styleByName[s.name] = s;

  // For each style we need the node's style block. Get them in batches via /files/{key}/nodes.
  const ids = styleMetas.map(s => s.node_id);
  const nodesResp = await fig(`/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(ids.join(","))}`);
  const styleProps = {};
  for (const id of ids) {
    const n = nodesResp.nodes[id]?.document;
    if (!n?.style) continue;
    const name = styleMetas.find(s => s.node_id === id).name;
    styleProps[name] = n.style;
  }

  const textStyles = JSON.parse(await readFile(join(root, "tokens/text-styles.json"), "utf8"));
  let tFilled = 0, tMissing = [];

  for (const [name, def] of Object.entries(textStyles.styles)) {
    const props = styleProps[name];
    if (!props) { tMissing.push(name); continue; }
    if (def.fontSize === "TBD:figma" && props.fontSize != null)
      def.fontSize = `${props.fontSize}px`;
    if (def.fontWeight === "TBD:figma" && props.fontWeight != null)
      def.fontWeight = props.fontWeight;
    if (def.lineHeight === "TBD:figma" && props.lineHeightPx != null)
      def.lineHeight = `${props.lineHeightPx}px`;
    if (def.letterSpacing === "TBD:figma") {
      if (props.letterSpacing != null) {
        def.letterSpacing = props.letterSpacing === 0 ? "0" : `${props.letterSpacing}px`;
      } else {
        def.letterSpacing = "0";
      }
    }
    // Preserve original family for transparency.
    def._figmaFontFamily = props.fontFamily || null;
    tFilled++;
  }

  await writeFile(join(root, "tokens/text-styles.json"), JSON.stringify(textStyles, null, 2) + "\n");
  console.log(`✓ text-styles.json: filled ${tFilled} styles; ${tMissing.length} not found in Figma`);
  if (tMissing.length) console.warn("  missing:", tMissing.join(", "));
}

main().catch(err => {
  console.error("✗ resolve failed:", err.message);
  process.exit(1);
});
