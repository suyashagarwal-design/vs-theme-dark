# HRDS Dark

A VS Code **color theme + icon theme** generated from the **HackerRank Design System (HRDS)**. Every color is the verbatim dark-mode hex of an HRDS token, and the typography uses the HRDS text-style scale with the families swapped to **Geist** (UI), **Geist Mono** (code), and **Kalice** (markdown-preview headings).

**Source of truth:** Figma file [`yIltK4T4z2tlZWjaMqlZTW` — HRDS Definition](https://www.figma.com/design/yIltK4T4z2tlZWjaMqlZTW/HRDS-Definition) — the `HRDS Tokens` variable collection and the `styles/text/IDE/*` + `styles/text/AI Markdown text/*` text-style families.

---

## Install

```bash
# from the repo root
npm install
npm run build      # regenerates theme + icons + markdown CSS + embedded fonts
npm run package    # produces hrds-dark-<version>.vsix

code --install-extension hrds-dark-*.vsix
```

Then in VS Code:
1. `Cmd+Shift+P → Preferences: Color Theme → HRDS Dark`
2. `Cmd+Shift+P → Preferences: File Icon Theme → HRDS Icons`

## What's in the theme

### Color — a 4-tier accent system
Colors are never used arbitrarily; each accent has one job (so the brand green stays an accent, not a wash):

| Accent | HRDS token | Used for |
| --- | --- | --- |
| **Primary neon** `#aef96c` | `buttons/primary` | Primary buttons, links, "Install" buttons, active-tab stripe, active indicators, cursor, count badges |
| **Success** `#05c770` | `states/success` | git-added, gutter-added, terminal ansi-green, charts-green, diff "added" |
| **Cyan** `#00b4e1` | `decorative/cyan` | Progress bars, list/search-match highlights, walkthrough progress |
| **Focus** `#cdfeb5` | `core/ring` | Focus ring only |

Surfaces follow the HRDS depth scale: editor/title bar `core/background` `#141419`, sidebar/activity bar `surfaces/card` `#202025`, selections/hover `core/muted`. Syntax highlighting is intentionally near-monochrome (strings green, functions cyan, keywords purple; everything else close to the foreground).

### Icons
- **Language file-type badges** (`TS TSX JS JSX PY GO RS RB PHP C C++ C#`) — filled HRDS-colored chips with the abbreviation rendered as **vector paths** (Geist Mono outlines baked in), so they need no installed font and look identical everywhere.
- **Formats** use recolored Lucide glyphs (`{}` JSON, `<>` markup, terminal, table, database, etc.), colored by the nearest HRDS token to the Seti convention.
- **Folders have no icon** (chevron only), Seti-style, to keep the tree uncluttered.
- **Sizing** — every icon is drawn on a 20-unit grid padded into a 24-unit viewBox, so it renders ~17% smaller inside VS Code's fixed icon slot (calmer, less cluttered). This is baked into the SVGs, so it applies with no Custom CSS. Tune via `PAD` in `scripts/build-icons.mjs`.

### Tree spacing
The theme sets `workbench.tree.indent` to `14` (via `configurationDefaults`) so the indent guide isn't crowding the child file icons. No setup required — it applies on install.

### Typography
| Surface | Font | Sizing |
| --- | --- | --- |
| Editor, terminal, diff, debug console | **Geist Mono** | HRDS `IDE/Mono/*` scale |
| Workbench chrome (sidebar, tabs, status bar, tooltips) | **Geist** | HRDS `IDE/Sans/Text/*` scale (tooltips 13px) |
| Markdown preview body | **Geist** | 14px |
| Markdown preview headings `h1`–`h6` | **Kalice** (regular) | document scale: 30 / 24 / 20 / 18 / 16 / 14px |

## Fonts — bundled, mostly zero-install

All three fonts ship inside the extension and are **embedded as base64 `@font-face`** in the override CSS, so most surfaces render correctly with nothing installed:

| Surface | Needs OS install? | How |
| --- | --- | --- |
| **File-type badges** | ❌ No | Letters are vector paths — font-independent |
| **Markdown preview** | ❌ No | Fonts embedded via `@font-face` (preview is a webview) |
| **Editor + workbench chrome** | ❌ No — *if Custom CSS is enabled* | `@font-face` injected into the workbench by the Custom CSS loader |
| **Editor, without Custom CSS** | ✅ Yes | VS Code has no API to register an editor font from an extension — install Geist Mono on the OS |

Enable the Custom CSS overrides (below) and you get Geist / Geist Mono everywhere with no install. Skip it and only the editor/UI chrome falls back to system fonts — badges and markdown still render correctly.

| Font | Role | License | Bundled |
| --- | --- | --- | --- |
| Geist | UI sans | SIL OFL | `fonts/Geist-*.woff2` |
| Geist Mono | code | SIL OFL | `fonts/GeistMono-*.woff2` |
| Kalice | markdown headings | **Commercial** ([Claude Type](https://claudetype.com/typefaces/kalice)) | `fonts/Kalice-Regular.otf` |

> ⚠️ **Kalice is a commercial font.** It is embedded for local use. Do **not** redistribute this extension publicly with Kalice bundled — for a shareable build, remove `fonts/Kalice-*` and swap to an OFL serif (the heading stack falls back to `'New York', Georgia, serif`).

To add or replace a font, drop the file into `fonts/` and run `npm run build:fonts` — the embedder auto-detects `.woff2` / `.otf` / `.ttf`.

## Optional: workbench CSS tweaks

A few things the theme API can't express are delivered through the [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css):

- UI font (Geist) across the workbench chrome, and tooltip sizing
- Rounded tab corners and a tighter title bar
- A smaller tree expand/collapse chevron (it's a codicon font glyph — not resizable by the theme)
- **Keyboard-only tree focus ring** — the green focus outline is hidden on mouse click (the selection background already marks the row) and restored when you navigate by keyboard, so the accessibility affordance stays where it matters

Add **both** imports to `settings.json` — the CSS *and* the small JS helper that drives the keyboard-only focus ring:

```jsonc
{
  "vscode_custom_css.imports": [
    "file:///<absolute-path-to-this-extension>/overrides/hrds-dark.css",
    "file:///<absolute-path-to-this-extension>/overrides/hrds-input-modality.js"
  ]
}
```

Then `Cmd+Shift+P → Enable Custom CSS and JS` and reload. VS Code will warn "installation appears corrupt" — that's the expected checksum notice; dismiss it via the gear → "Don't Show Again". **Re-run "Enable Custom CSS and JS" after any change to these files** — the loader bakes their contents in at enable-time, so a plain reload won't pick up edits.

> **Why the JS file?** VS Code focuses its tree programmatically, and in its Electron build CSS `:focus-visible` reports keyboard-focus even on a mouse click — so it can't distinguish the two. `hrds-input-modality.js` tracks the real input modality and toggles `html.hrds-pointer` / `html.hrds-keyboard`, which the CSS keys off. It's tiny, fails safe (never throws into the workbench), and only affects the focus ring. Skip it and the ring simply shows on every focus, as VS Code does by default.

## Build pipeline

`npm run build` runs four generators in order — everything is regenerated from `tokens/` + `icons/icon-mapping.json`, never hand-edited:

| Script | Output |
| --- | --- |
| `build-from-figma.mjs` | `themes/hrds-dark-color-theme.json` (fails if any `#RRGGBB` literal appears outside `tokens/tokens.json` — the no-off-HRDS guard) |
| `build-icons.mjs` | `icons/colored/*.svg` + `icons/hrds-icon-theme.json` (badges via opentype.js) |
| `build-markdown-css.mjs` | markdown heading/body scale → `overrides/markdown-preview.css` |
| `embed-fonts.mjs` | base64 `@font-face` blocks → both override CSS files |

## Re-syncing with Figma

```bash
export FIGMA_TOKEN='your-pat'
node scripts/resolve-from-figma.mjs   # pulls color hexes + text-style metrics (+ font-size scale if the token has file_variables:read)
node scripts/export-icons.mjs         # re-exports + re-tints icons/svg/
npm run build && npm run package
```

> Color **variables** need a token with `file_variables:read` (Figma Enterprise). **Text styles** are file styles and resolve on any token. Without variable access, the build uses the committed token values + the standard font-size scale.

## License

UNLICENSED — internal use. Note the Kalice font caveat above before sharing.
