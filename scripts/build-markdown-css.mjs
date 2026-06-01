#!/usr/bin/env node
// Generate the markdown-preview type scale from the HRDS font-size scale
// (tokens/font-sizes.json) and write it into the MD-TYPE region of
// overrides/markdown-preview.css.
//
// README is a document, so headings map to the foundational font/font size/*
// scale (3xl…sm) for a clear hierarchy — NOT the compact "AI Markdown" chat
// scale. Families: headings Kalice, body Geist, code Geist Mono.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const sizesPath = join(root, "tokens/font-sizes.json");
const cssPath   = join(root, "overrides/markdown-preview.css");

const SERIF = "'Kalice', 'New York', Georgia, serif";
const SANS  = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO  = "'Geist Mono', 'SF Mono', Menlo, Consolas, monospace";

// element → { sizeToken (key in font-sizes.json), fallback px, line-height ratio, family, weight }
const MAP = [
  { sel: ".markdown-body h1, .vscode-body h1", token: "3xl",  fallback: 30, lh: 1.25, family: SERIF, weight: 400 },
  { sel: ".markdown-body h2, .vscode-body h2", token: "2xl",  fallback: 24, lh: 1.3,  family: SERIF, weight: 400 },
  { sel: ".markdown-body h3, .vscode-body h3", token: "xl",   fallback: 20, lh: 1.35, family: SERIF, weight: 400 },
  { sel: ".markdown-body h4, .vscode-body h4", token: "lg",   fallback: 18, lh: 1.4,  family: SERIF, weight: 400 },
  { sel: ".markdown-body h5, .vscode-body h5", token: "base", fallback: 16, lh: 1.4,  family: SERIF, weight: 400 },
  { sel: ".markdown-body h6, .vscode-body h6", token: "sm",   fallback: 14, lh: 1.4,  family: SERIF, weight: 400 },
  { sel: ".markdown-body, .vscode-body, body.vscode-dark .markdown-body, body.vscode-light .markdown-body",
                                               token: "sm",   fallback: 14, lh: 1.6,  family: SANS,  weight: 400 }
];

function px (sizes, token, fallback) {
  const v = sizes[token];
  if (typeof v === "string") return parseFloat(v);
  return fallback; // font-sizes.json not resolved yet → use plan's standard value
}

async function main () {
  let sizes = {};
  let resolved = false;
  try {
    sizes = JSON.parse(await readFile(sizesPath, "utf8")).sizes || {};
    resolved = Object.keys(sizes).length > 0;
  } catch { /* not resolved yet — fall back to plan values */ }

  const rules = MAP.map(({ sel, token, fallback, lh, family, weight }) => {
    const size = px(sizes, token, fallback);
    return `${sel} {\n` +
      `  font-family: ${family};\n` +
      `  font-size: ${size}px;\n` +
      `  font-weight: ${weight};\n` +
      `  line-height: ${Math.round(size * lh)}px;\n` +
      `}`;
  });

  // inline code + fenced blocks → mono at the body size
  const codeSize = px(sizes, "sm", 14);
  rules.push(
    `.markdown-body code, .markdown-body pre, .markdown-body tt {\n` +
    `  font-family: ${MONO};\n` +
    `  font-size: ${codeSize}px;\n` +
    `}`
  );

  const generated = `/* MD-TYPE:START */\n${rules.join("\n\n")}\n/* MD-TYPE:END */`;
  const region = /\/\* MD-TYPE:START \*\/[\s\S]*?\/\* MD-TYPE:END \*\//;

  let css = await readFile(cssPath, "utf8");
  if (!region.test(css)) throw new Error("No MD-TYPE markers in markdown-preview.css");
  css = css.replace(region, generated);
  await writeFile(cssPath, css, "utf8");

  console.log(`✓ markdown type scale written (h1=${px(sizes,"3xl",30)}px … body=${codeSize}px)` +
    (resolved ? " from tokens/font-sizes.json" : " using PLAN fallback values (run resolve-from-figma first for exact DS sizes)"));
}

main().catch(err => { console.error("✗ build-markdown-css failed:", err.message); process.exit(1); });
