/**
 * ThemeManager - light/dark with persistence.
 *
 * The theme is applied to <html> before first paint (app.js calls init() as
 * its first statement), so the page never flashes the wrong theme. Charts do
 * not re-read colours on their own: the `theme` event is what tells them to
 * redraw, and mermaid-renderer.js listens for the same event.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.createThemeManager = api.createThemeManager;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KEY = 'theme';
  const THEMES = ['light', 'dark'];

  function createThemeManager(options) {
    const settings = options || {};
    const storage = settings.storage;
    const emit = settings.emit || function () {};
    const documentRef = settings.document || (typeof document !== 'undefined' ? document : null);
    const prefersDark = settings.prefersDark || function () {
      return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
    };

    let current = 'light';

    function resolveInitial() {
      const stored = storage ? storage.read(KEY, null) : null;
      if (THEMES.indexOf(stored) !== -1) return stored;
      return prefersDark() ? 'dark' : 'light';
    }

    function apply(theme) {
      current = THEMES.indexOf(theme) === -1 ? 'light' : theme;
      if (documentRef && documentRef.documentElement) {
        documentRef.documentElement.setAttribute('data-theme', current);
      }
      if (storage) storage.write(KEY, current);
      emit('theme', { theme: current });
      return current;
    }

    return {
      init: function () { return apply(resolveInitial()); },
      set: apply,
      toggle: function () { return apply(current === 'dark' ? 'light' : 'dark'); },
      current: function () { return current; }
    };
  }

  return { createThemeManager: createThemeManager };
}));
