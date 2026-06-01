// HRDS Dark — input-modality tracker for the keyboard-only focus ring.
//
// Why this exists: VS Code focuses its lists/trees programmatically, and in the
// Electron/Chromium build VS Code ships, a script .focus() makes the element match
// CSS :focus-visible even when focus was triggered by a mouse click. That makes the
// pure-CSS :focus-visible approach unreliable, so we track modality ourselves.
//
// The Custom CSS loader injects this <script> into <head>, i.e. BEFORE <body>
// exists — so we toggle the class on document.documentElement (the <html> element,
// which always exists) and listen on `document`, never touching document.body.
//   html.hrds-pointer  → last interaction was a pointer (mousedown)  → hide the ring
//   html.hrds-keyboard → last interaction was a nav key (Tab/arrows) → native ring
// The CSS in hrds-dark.css hides the tree-row focus outline while .hrds-pointer is
// set; on .hrds-keyboard that rule stops matching and VS Code's own ring shows.
//
// Loaded via the Custom CSS and JS loader (be5invis.vscode-custom-css) — listed in
// "vscode_custom_css.imports" alongside hrds-dark.css.
(function () {
  try {
    var el = document.documentElement;
    if (!el) return;

    // Keys that signal intentional keyboard navigation/activation.
    var NAV_KEYS = {
      Tab: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
      Home: 1, End: 1, PageUp: 1, PageDown: 1, Enter: 1, " ": 1
    };

    function usePointer() {
      el.classList.add("hrds-pointer");
      el.classList.remove("hrds-keyboard");
    }
    function useKeyboard(e) {
      if (NAV_KEYS[e.key]) {
        el.classList.add("hrds-keyboard");
        el.classList.remove("hrds-pointer");
      }
    }

    // Capture phase so we observe the event before VS Code moves focus.
    document.addEventListener("mousedown", usePointer, true);
    document.addEventListener("keydown", useKeyboard, true);

    // Start in pointer mode: ring stays hidden until the user navigates by keyboard.
    usePointer();
  } catch (e) {
    /* never break the workbench over a cosmetic tweak */
  }
})();
