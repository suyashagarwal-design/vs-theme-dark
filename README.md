# HRDS Dark

A VS Code color theme + icon theme generated from the **HackerRank Design System (HRDS)** — every color is the verbatim dark-mode hex of an HRDS token; every text size/weight/line-height is the verbatim Figma value with the font family swapped to Geist (UI), Geist Mono (code), and Kalice (markdown headings).

**Source of truth:** Figma file [`yIltK4T4z2tlZWjaMqlZTW` — HRDS Definition](https://www.figma.com/design/yIltK4T4z2tlZWjaMqlZTW/HRDS-Definition), the `HRDS Tokens` variable collection and `styles/text/IDE/*` + `styles/text/AI Markdown text/*` text style families.

---

## Install

```bash
# from the repo root
npm install
npm run build           # generates themes/hrds-dark-color-theme.json
npm run package         # produces hrds-dark-0.1.0.vsix

code --install-extension hrds-dark-0.1.0.vsix
```

Then in VS Code:
1. `Cmd+Shift+P → Preferences: Color Theme → HRDS Dark`
2. `Cmd+Shift+P → Preferences: File Icon Theme → HRDS Icons`

## Fonts — bundled, mostly zero-install

Geist + Geist Mono ship inside the extension (SIL OFL) and are **embedded as base64** in the override CSS, so most surfaces use them with no install:

| Surface | Needs OS install? | How it works |
| --- | --- | --- |
| **File-type badges** (TS/JS/…) | ❌ No | Letters are baked in as vector paths — identical on every machine |
| **Markdown preview** | ❌ No | Fonts embedded via `@font-face` in the preview stylesheet (webview) |
| **Editor + workbench chrome** | ❌ No, *if Custom CSS is enabled* | `@font-face` injected by the Custom CSS loader (see below) |
| **Editor, without Custom CSS** | ✅ Yes | VS Code has no API to register an editor font from an extension — install Geist Mono on the OS |

So: enable the Custom CSS overrides (next section) and you get Geist / Geist Mono everywhere with nothing to install. If you skip Custom CSS, only the editor/UI chrome falls back to system fonts; badges and markdown still render correctly.

To install on the OS anyway (the no-Custom-CSS path), the `.woff2` files are bundled in `fonts/` — or grab them from <https://vercel.com/font>.

**Kalice** (markdown preview headings) is not bundled yet — drop a `Kalice*.woff2` into `fonts/` and run `npm run build:fonts` to embed it. Until then, headings use the system serif fallback.

## Optional: workbench CSS tweaks

For a few UI tweaks the theme API can't express (rounded tab corners, tighter titlebar, finer typography across the workbench), install the [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css) extension and add this to your `settings.json`:

```jsonc
{
  "vscode_custom_css.imports": [
    "file:///<absolute-path-to-this-extension>/overrides/hrds-dark.css"
  ]
}
```

Then `Cmd+Shift+P → Enable Custom CSS and JS` and restart VS Code (it warns about checksum mismatch — that's expected).

## Design provenance

Every color in `themes/hrds-dark-color-theme.json` is the verbatim dark-mode hex of a variable in `HRDS Definition → HRDS Tokens`. The source mapping lives in `tokens/tokens.json`; the build script (`scripts/build-from-figma.mjs`) refuses to compile if any literal `#RRGGBB` hex appears outside that file.

The 16 text styles in `tokens/text-styles.json` were pulled directly from `styles/text/IDE/*` + `styles/text/AI Markdown text/*` via the Figma REST API. The font-family is the only deliberate substitution; size, weight, line-height, and letter-spacing are preserved verbatim.

Icons are exported from the Icons page in the same Figma file (1,509 Lucide-style SVGs) and tinted from the design's light-mode foreground to dark-mode foreground at export time.

## Re-syncing with Figma

```bash
export FIGMA_TOKEN='your-pat-with-file_content-and-file_variables-read'
node scripts/resolve-from-figma.mjs    # pulls latest variable hexes + text-style metrics into tokens/
node scripts/export-icons.mjs          # re-exports + re-tints icons/svg/ (overwrites)
npm run build                          # regenerates themes/hrds-dark-color-theme.json
npm run package
```

## License

UNLICENSED — internal use.
