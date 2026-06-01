#!/usr/bin/env node
// Build hrds-dark-color-theme.json from tokens/*.json.
// Guarantee: every color value in the output is the verbatim hex of an HRDS
// variable. The build fails if any literal #RRGGBB hex is found in a source
// file other than tokens.json, or if any TBD:figma placeholder is referenced.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const here   = dirname(fileURLToPath(import.meta.url));
const root   = join(here, "..");
const tokensPath = join(root, "tokens/tokens.json");
const syntaxPath = join(root, "tokens/syntax-mapping.json");
const stylesPath = join(root, "tokens/text-styles.json");
const outPath    = join(root, "themes/hrds-dark-color-theme.json");

const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;

async function main () {
  const tokens = JSON.parse(await readFile(tokensPath, "utf8"));
  const syntax = JSON.parse(await readFile(syntaxPath, "utf8"));
  const styles = JSON.parse(await readFile(stylesPath, "utf8"));

  await assertNoRawHexOutsideTokens();

  const palette = flattenTokens(tokens);
  const resolve = (key) => {
    if (typeof key !== "string") return key;
    if (!palette.has(key)) {
      throw new Error(`Unknown HRDS token: "${key}". Check tokens.json.`);
    }
    const hex = palette.get(key);
    if (hex === "TBD:figma") {
      throw new Error(`Token "${key}" is still TBD:figma — resolve its hex in tokens.json before building.`);
    }
    return hex;
  };

  const colors        = buildWorkbenchColors(resolve);
  const tokenColors   = buildTokenColors(syntax, resolve);
  const semanticColors= buildSemanticTokenColors(syntax, resolve);

  const theme = {
    $schema: "vscode://schemas/color-theme",
    name:    "HRDS Dark",
    type:    "dark",
    semanticHighlighting: true,
    colors,
    tokenColors,
    semanticTokenColors: semanticColors
  };

  await writeFile(outPath, JSON.stringify(theme, null, 2) + "\n", "utf8");
  console.log(`✓ wrote ${relative(root, outPath)}`);
  console.log(`  ${Object.keys(colors).length} workbench keys · ${tokenColors.length} tokenColors · ${Object.keys(semanticColors).length} semanticTokenColors`);

  // Sanity: log what's still TBD so the user knows what to resolve next.
  const pending = [...palette.entries()].filter(([, v]) => v === "TBD:figma").map(([k]) => k);
  if (pending.length) {
    console.warn(`\n⚠ ${pending.length} HRDS tokens still TBD:figma (unused by the theme, but listed for visibility):`);
    pending.forEach(k => console.warn(`    ${k}`));
  }
}

function flattenTokens (tokens) {
  const out = new Map();
  for (const [group, entries] of Object.entries(tokens)) {
    if (group.startsWith("_")) continue;
    for (const [name, def] of Object.entries(entries)) {
      out.set(`${group}/${name}`, def.hex);
    }
  }
  return out;
}

// VS Code workbench color map. Every right-hand value is an HRDS token key.
// The build script resolves them. No raw hex anywhere in this function.
function buildWorkbenchColors (r) {
  return {
    // ─── Base ─────────────────────────────────────────────────────────────
    "focusBorder":                                   r("core/ring"),
    "foreground":                                    r("core/foreground"),
    "descriptionForeground":                         r("core/muted-foreground"),
    "errorForeground":                               r("buttons/destructive"),
    "icon.foreground":                               r("core/foreground"),
    "selection.background":                          r("overlay/accent-alpha"),
    "widget.shadow":                                 r("overlay/border-heavy-alpha"),
    "sash.hoverBorder":                              r("core/ring"),

    // ─── Window ───────────────────────────────────────────────────────────
    "window.activeBorder":                           r("core/background"),
    "window.inactiveBorder":                         r("core/background"),

    // ─── Text ─────────────────────────────────────────────────────────────
    "textLink.foreground":                           r("buttons/primary"),
    "textLink.activeForeground":                     r("buttons/primary-hover"),
    "textBlockQuote.background":                     r("core/muted"),
    "textBlockQuote.border":                         r("decorative/cyan"),
    "textCodeBlock.background":                      r("core/muted"),
    "textPreformat.foreground":                      r("buttons/primary"),
    "textSeparator.foreground":                      r("core/border"),

    // ─── Buttons ──────────────────────────────────────────────────────────
    // Primary button = DS primary (neon green) with dark text.
    "button.background":                             r("buttons/primary"),
    "button.foreground":                             r("buttons/primary-foreground"),
    "button.hoverBackground":                        r("buttons/primary-hover"),
    "button.border":                                 r("buttons/primary"),
    "button.separator":                              r("buttons/primary-foreground"),
    // Secondary button = DS secondary (dark grey) with light text.
    "button.secondaryBackground":                    r("buttons/secondary"),
    "button.secondaryForeground":                    r("buttons/secondary-foreground"),
    "button.secondaryHoverBackground":               r("buttons/secondary-hover"),
    "checkbox.background":                           r("core/muted"),
    "checkbox.border":                               r("core/border"),
    "checkbox.foreground":                           r("core/foreground"),

    // ─── Extension "Install" / prominent buttons (DS primary) ─────────────
    "extensionButton.background":                    r("buttons/secondary"),
    "extensionButton.foreground":                    r("buttons/secondary-foreground"),
    "extensionButton.hoverBackground":               r("buttons/secondary-hover"),
    "extensionButton.separator":                     r("buttons/primary-foreground"),
    "extensionButton.prominentBackground":           r("buttons/primary"),
    "extensionButton.prominentForeground":           r("buttons/primary-foreground"),
    "extensionButton.prominentHoverBackground":      r("buttons/primary-hover"),

    // ─── Welcome / Walkthrough page ───────────────────────────────────────
    "welcomePage.background":                        r("core/background"),
    "welcomePage.tileBackground":                    r("surfaces/card"),
    "welcomePage.tileHoverBackground":               r("core/muted"),
    "welcomePage.tileBorder":                        r("core/border"),
    "welcomePage.progressBackground":                r("core/muted"),
    "welcomePage.progressForeground":                r("decorative/cyan"),
    "walkThrough.embeddedEditorBackground":          r("surfaces/card"),

    // ─── Dropdown / Inputs ────────────────────────────────────────────────
    "dropdown.background":                           r("surfaces/popover"),
    "dropdown.foreground":                           r("surfaces/popover-foreground"),
    "dropdown.border":                               r("core/border"),
    "dropdown.listBackground":                       r("surfaces/popover"),
    "input.background":                              r("core/muted"),
    "input.foreground":                              r("core/foreground"),
    "input.border":                                  r("core/border"),
    "input.placeholderForeground":                   r("core/muted-foreground"),
    "inputOption.activeBackground":                  r("overlay/accent-alpha"),
    "inputOption.activeBorder":                      r("core/ring"),
    "inputOption.activeForeground":                  r("core/foreground"),
    "inputValidation.errorBackground":               r("core/muted"),
    "inputValidation.errorBorder":                   r("buttons/destructive"),
    "inputValidation.errorForeground":               r("core/foreground"),
    "inputValidation.warningBackground":             r("core/muted"),
    "inputValidation.warningBorder":                 r("states/caution"),
    "inputValidation.infoBackground":                r("core/muted"),
    "inputValidation.infoBorder":                    r("states/info"),

    // ─── Scrollbar ────────────────────────────────────────────────────────
    "scrollbar.shadow":                              r("overlay/border-alpha"),
    "scrollbarSlider.background":                    r("overlay/border-alpha"),
    "scrollbarSlider.hoverBackground":               r("overlay/border-heavy-alpha"),
    "scrollbarSlider.activeBackground":              r("overlay/accent-alpha"),

    // ─── Badge / Progress ────────────────────────────────────────────────
    "badge.background":                              r("buttons/primary"),
    "badge.foreground":                              r("buttons/primary-foreground"),
    "progressBar.background":                        r("decorative/cyan"),

    // ─── Lists & Trees ───────────────────────────────────────────────────
    "list.activeSelectionBackground":                r("core/muted"),
    "list.activeSelectionForeground":                r("core/foreground"),
    "list.inactiveSelectionBackground":              r("core/muted"),
    "list.inactiveSelectionForeground":              r("core/foreground"),
    "list.focusBackground":                          r("core/muted"),
    "list.focusForeground":                          r("core/foreground"),
    "list.hoverBackground":                          r("overlay/border-alpha"),
    "list.hoverForeground":                          r("core/foreground"),
    "list.dropBackground":                           r("overlay/accent-alpha"),
    "list.highlightForeground":                      r("decorative/cyan"),
    "list.errorForeground":                          r("buttons/destructive"),
    "list.warningForeground":                        r("states/caution"),
    "tree.indentGuidesStroke":                       r("core/border"),

    // ─── Activity Bar ────────────────────────────────────────────────────
    "activityBar.background":                        r("surfaces/card"),
    "activityBar.foreground":                        r("core/foreground"),
    "activityBar.inactiveForeground":                r("core/muted-foreground"),
    "activityBar.border":                            r("core/border"),
    "activityBarBadge.background":                   r("buttons/primary"),
    "activityBarBadge.foreground":                   r("buttons/primary-foreground"),
    "activityBar.activeBorder":                      r("buttons/primary"),
    "activityBar.activeBackground":                  r("core/muted"),

    // ─── Side Bar ────────────────────────────────────────────────────────
    "sideBar.background":                            r("surfaces/card"),
    "sideBar.foreground":                            r("core/foreground"),
    "sideBar.border":                                r("core/border"),
    "sideBarTitle.foreground":                       r("core/muted-foreground"),
    "sideBarSectionHeader.background":               r("surfaces/card"),
    "sideBarSectionHeader.foreground":               r("core/muted-foreground"),
    "sideBarSectionHeader.border":                   r("core/border"),

    // ─── Editor Groups & Tabs ────────────────────────────────────────────
    "editorGroup.border":                            r("core/border"),
    "editorGroupHeader.tabsBackground":              r("core/background"),
    "editorGroupHeader.tabsBorder":                  r("core/border"),
    "editorGroupHeader.border":                      r("core/border"),
    "editorGroupHeader.noTabsBackground":            r("core/background"),
    "tab.activeBackground":                          r("core/background"),
    "tab.activeForeground":                          r("core/foreground"),
    "tab.activeBorder":                              r("core/background"),
    "tab.activeBorderTop":                           r("buttons/primary"),
    "tab.inactiveBackground":                        r("core/background"),
    "tab.inactiveForeground":                        r("core/muted-foreground"),
    "tab.border":                                    r("core/background"),
    "tab.hoverBackground":                           r("surfaces/card"),
    "tab.hoverForeground":                           r("core/foreground"),
    "tab.unfocusedActiveForeground":                 r("core/muted-foreground"),
    "tab.unfocusedInactiveForeground":               r("core/muted-foreground"),

    // ─── Editor ──────────────────────────────────────────────────────────
    "editor.background":                             r("core/background"),
    "editor.foreground":                             r("core/foreground"),
    "editorLineNumber.foreground":                   r("core/muted-foreground"),
    "editorLineNumber.activeForeground":             r("core/foreground"),
    "editor.selectionBackground":                    r("overlay/accent-alpha"),
    "editor.inactiveSelectionBackground":            r("overlay/border-heavy-alpha"),
    "editor.selectionHighlightBackground":           r("overlay/border-alpha"),
    "editor.wordHighlightBackground":                r("overlay/border-alpha"),
    "editor.wordHighlightStrongBackground":          r("overlay/border-heavy-alpha"),
    "editor.findMatchBackground":                    r("overlay/accent-alpha"),
    "editor.findMatchHighlightBackground":           r("overlay/border-heavy-alpha"),
    "editor.lineHighlightBackground":                r("overlay/border-alpha"),
    "editor.lineHighlightBorder":                    r("core/background"),
    "editorCursor.foreground":                       r("buttons/primary"),
    "editorWhitespace.foreground":                   r("core/border"),
    "editorIndentGuide.background":                  r("core/border"),
    "editorIndentGuide.activeBackground":            r("overlay/border-heavy-alpha"),
    "editorBracketMatch.background":                 r("overlay/border-alpha"),
    "editorBracketMatch.border":                     r("core/border"),
    "editorRuler.foreground":                        r("core/border"),
    "editorGutter.background":                       r("core/background"),
    "editorGutter.modifiedBackground":               r("states/info"),
    "editorGutter.addedBackground":                  r("states/success"),
    "editorGutter.deletedBackground":                r("buttons/destructive"),
    "editorError.foreground":                        r("buttons/destructive"),
    "editorWarning.foreground":                      r("states/caution"),
    "editorInfo.foreground":                         r("states/info"),
    "editorHint.foreground":                         r("decorative/cyan"),
    "editorLink.activeForeground":                   r("decorative/cyan"),

    // ─── Editor Widgets (suggest, hover, peek, etc.) ─────────────────────
    "editorWidget.background":                       r("surfaces/popover"),
    "editorWidget.foreground":                       r("surfaces/popover-foreground"),
    "editorWidget.border":                           r("core/border"),
    "editorSuggestWidget.background":                r("surfaces/popover"),
    "editorSuggestWidget.foreground":                r("surfaces/popover-foreground"),
    "editorSuggestWidget.border":                    r("core/border"),
    "editorSuggestWidget.highlightForeground":       r("decorative/cyan"),
    "editorSuggestWidget.selectedBackground":        r("core/muted"),
    "editorHoverWidget.background":                  r("surfaces/popover"),
    "editorHoverWidget.foreground":                  r("surfaces/popover-foreground"),
    "editorHoverWidget.border":                      r("core/border"),
    "peekView.border":                               r("decorative/cyan"),
    "peekViewEditor.background":                     r("core/background"),
    "peekViewResult.background":                     r("surfaces/card"),
    "peekViewTitle.background":                      r("surfaces/card"),
    "peekViewTitleLabel.foreground":                 r("core/foreground"),
    "peekViewTitleDescription.foreground":           r("core/muted-foreground"),

    // ─── Diff ────────────────────────────────────────────────────────────
    "diffEditor.insertedTextBackground":             r("overlay/border-alpha"),
    "diffEditor.removedTextBackground":              r("overlay/border-alpha"),
    "diffEditor.border":                             r("core/border"),

    // ─── Status Bar ──────────────────────────────────────────────────────
    "statusBar.background":                          r("core/background"),
    "statusBar.foreground":                          r("core/muted-foreground"),
    "statusBar.border":                              r("core/border"),
    "statusBar.debuggingBackground":                 r("decorative/purple"),
    "statusBar.debuggingForeground":                 r("core/foreground"),
    "statusBar.noFolderBackground":                  r("core/background"),
    "statusBarItem.activeBackground":                r("core/muted"),
    "statusBarItem.hoverBackground":                 r("overlay/border-alpha"),
    "statusBarItem.prominentBackground":             r("core/muted"),
    "statusBarItem.prominentForeground":             r("core/foreground"),
    "statusBarItem.errorBackground":                 r("buttons/destructive"),
    "statusBarItem.errorForeground":                 r("buttons/destructive-foreground"),
    "statusBarItem.warningBackground":               r("states/caution"),
    "statusBarItem.warningForeground":               r("core/background"),
    "statusBarItem.remoteBackground":                r("decorative/cyan"),
    "statusBarItem.remoteForeground":                r("core/background"),

    // ─── Title Bar ───────────────────────────────────────────────────────
    "titleBar.activeBackground":                     r("core/background"),
    "titleBar.activeForeground":                     r("core/foreground"),
    "titleBar.inactiveBackground":                   r("core/background"),
    "titleBar.inactiveForeground":                   r("core/muted-foreground"),
    "titleBar.border":                               r("core/border"),

    // ─── Panel ───────────────────────────────────────────────────────────
    "panel.background":                              r("core/background"),
    "panel.border":                                  r("core/border"),
    "panelTitle.activeBorder":                       r("buttons/primary"),
    "panelTitle.activeForeground":                   r("core/foreground"),
    "panelTitle.inactiveForeground":                 r("core/muted-foreground"),
    "panelInput.border":                             r("core/border"),

    // ─── Terminal ────────────────────────────────────────────────────────
    "terminal.background":                           r("core/background"),
    "terminal.foreground":                           r("core/foreground"),
    "terminal.border":                               r("core/border"),
    "terminal.selectionBackground":                  r("overlay/accent-alpha"),
    "terminalCursor.background":                     r("core/background"),
    "terminalCursor.foreground":                     r("buttons/primary"),
    "terminal.ansiBlack":                            r("core/background"),
    "terminal.ansiRed":                              r("buttons/destructive"),
    "terminal.ansiGreen":                            r("states/success"),
    "terminal.ansiYellow":                           r("decorative/orange"),
    "terminal.ansiBlue":                             r("states/info"),
    "terminal.ansiMagenta":                          r("decorative/purple"),
    "terminal.ansiCyan":                             r("decorative/cyan"),
    "terminal.ansiWhite":                            r("core/foreground"),
    "terminal.ansiBrightBlack":                      r("core/muted-foreground"),
    "terminal.ansiBrightRed":                        r("buttons/destructive-hover"),
    "terminal.ansiBrightGreen":                      r("states/success"),
    "terminal.ansiBrightYellow":                     r("decorative/orange"),
    "terminal.ansiBrightBlue":                       r("decorative/cyan"),
    "terminal.ansiBrightMagenta":                    r("decorative/fuscia"),
    "terminal.ansiBrightCyan":                       r("decorative/cyan-accent"),
    "terminal.ansiBrightWhite":                      r("core/foreground"),

    // ─── Notifications ───────────────────────────────────────────────────
    "notifications.background":                      r("surfaces/popover"),
    "notifications.foreground":                      r("surfaces/popover-foreground"),
    "notifications.border":                          r("core/border"),
    "notificationCenterHeader.background":           r("surfaces/popover"),
    "notificationCenterHeader.foreground":           r("core/muted-foreground"),
    "notificationsErrorIcon.foreground":             r("buttons/destructive"),
    "notificationsWarningIcon.foreground":           r("states/caution"),
    "notificationsInfoIcon.foreground":              r("states/info"),

    // ─── Command Palette / Quick Pick ────────────────────────────────────
    "quickInput.background":                         r("surfaces/popover"),
    "quickInput.foreground":                         r("surfaces/popover-foreground"),
    "quickInputTitle.background":                    r("surfaces/popover"),
    "quickInputList.focusBackground":                r("core/muted"),
    "quickInputList.focusForeground":                r("core/foreground"),
    "pickerGroup.border":                            r("core/border"),
    "pickerGroup.foreground":                        r("core/muted-foreground"),

    // ─── Menu ────────────────────────────────────────────────────────────
    "menu.background":                               r("surfaces/popover"),
    "menu.foreground":                               r("surfaces/popover-foreground"),
    "menu.border":                                   r("core/border"),
    "menu.separatorBackground":                      r("core/border"),
    "menu.selectionBackground":                      r("core/muted"),
    "menu.selectionForeground":                      r("core/foreground"),
    "menu.selectionBorder":                          r("core/border"),
    "menubar.selectionBackground":                   r("core/muted"),
    "menubar.selectionForeground":                   r("core/foreground"),

    // ─── Git Decorations ─────────────────────────────────────────────────
    "gitDecoration.addedResourceForeground":         r("states/success"),
    "gitDecoration.modifiedResourceForeground":      r("states/info"),
    "gitDecoration.deletedResourceForeground":       r("buttons/destructive"),
    "gitDecoration.untrackedResourceForeground":     r("decorative/cyan"),
    "gitDecoration.ignoredResourceForeground":       r("core/muted-foreground"),
    "gitDecoration.conflictingResourceForeground":   r("decorative/orange"),
    "gitDecoration.submoduleResourceForeground":     r("decorative/purple"),

    // ─── Breadcrumbs ─────────────────────────────────────────────────────
    "breadcrumb.background":                         r("core/background"),
    "breadcrumb.foreground":                         r("core/muted-foreground"),
    "breadcrumb.focusForeground":                    r("core/foreground"),
    "breadcrumb.activeSelectionForeground":          r("core/foreground"),
    "breadcrumbPicker.background":                   r("surfaces/popover"),

    // ─── Settings ────────────────────────────────────────────────────────
    "settings.headerForeground":                     r("core/foreground"),
    "settings.modifiedItemIndicator":                r("decorative/cyan"),
    "settings.dropdownBackground":                   r("core/muted"),
    "settings.dropdownBorder":                       r("core/border"),
    "settings.checkboxBackground":                   r("core/muted"),
    "settings.checkboxBorder":                       r("core/border"),
    "settings.textInputBackground":                  r("core/muted"),
    "settings.textInputBorder":                      r("core/border"),
    "settings.numberInputBackground":                r("core/muted"),
    "settings.numberInputBorder":                    r("core/border"),

    // ─── Charts (for notebook outputs, etc.) ─────────────────────────────
    "charts.foreground":                             r("core/foreground"),
    "charts.lines":                                  r("core/border"),
    "charts.red":                                    r("buttons/destructive"),
    "charts.blue":                                   r("decorative/cyan"),
    "charts.yellow":                                 r("decorative/orange"),
    "charts.orange":                                 r("decorative/orange"),
    "charts.green":                                  r("states/success"),
    "charts.purple":                                 r("decorative/purple")
  };
}

function buildTokenColors (syntax, r) {
  return syntax.tokenColors.map(t => ({
    name: t.name,
    scope: t.scope,
    settings: Object.fromEntries(Object.entries(t.settings).map(([k, v]) => [
      k,
      k === "fontStyle" ? v : r(v)
    ]))
  }));
}

function buildSemanticTokenColors (syntax, r) {
  const out = {};
  for (const [scope, value] of Object.entries(syntax.semanticTokenColors)) {
    if (typeof value === "string") {
      out[scope] = r(value);
    } else {
      out[scope] = { ...value };
      if (value.foreground) out[scope].foreground = r(value.foreground);
    }
  }
  return out;
}

async function assertNoRawHexOutsideTokens () {
  const filesToCheck = [
    "scripts/build-from-figma.mjs",
    "tokens/syntax-mapping.json",
    "tokens/text-styles.json",
    "package.json",
    "overrides/hrds-dark.css",
    "overrides/markdown-preview.css"
  ];
  const violations = [];
  for (const rel of filesToCheck) {
    let content;
    try { content = await readFile(join(root, rel), "utf8"); } catch { continue; }
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      // Ignore comments that document HRDS — they may quote hexes.
      if (/^\s*(\/\/|#|\*)/.test(line)) return;
      const m = line.match(RAW_HEX);
      if (m) violations.push(`  ${rel}:${i + 1}: ${m[0]} → ${line.trim()}`);
    });
  }
  if (violations.length) {
    throw new Error(
      `Off-HRDS hex literal(s) found outside tokens.json:\n${violations.join("\n")}\n` +
      `Every color must reference a token name from tokens.json.`
    );
  }
}

main().catch(err => {
  console.error("✗ build failed:", err.message);
  process.exit(1);
});
