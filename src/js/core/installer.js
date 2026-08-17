/**
 * Installer - service worker registration and the install prompt.
 *
 * A browser only offers "install" when the page has a manifest with icons, is
 * served over a secure origin (localhost counts) and has a service worker with
 * a fetch handler. All three exist here, so the Install button is shown when
 * the browser says it is available and hidden otherwise - never as a button
 * that does nothing.
 *
 * Nothing here is required for the app to work. Registration failures are
 * reported once and ignored: the platform runs the same either way.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.createInstaller = api.createInstaller;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function createInstaller(options) {
    const settings = options || {};
    const win = settings.window || scope;
    const onAvailable = settings.onAvailable || function () {};
    const onInstalled = settings.onInstalled || function () {};
    let deferred = null;

    function supported() {
      return Boolean(win && win.navigator && win.navigator.serviceWorker);
    }

    function register() {
      if (!supported()) return Promise.resolve(null);
      if (win.location && win.location.protocol === 'file:') return Promise.resolve(null);

      return win.navigator.serviceWorker.register(settings.script || 'sw.js')
        .catch(function (error) {
          if (win.console) win.console.warn('service worker registration failed:', error.message);
          return null;
        });
    }

    function listen() {
      if (!win || !win.addEventListener) return;

      win.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        deferred = event;
        onAvailable(true);
      });

      win.addEventListener('appinstalled', function () {
        deferred = null;
        onAvailable(false);
        onInstalled();
      });
    }

    function promptInstall() {
      if (!deferred) return Promise.resolve({ outcome: 'unavailable' });
      const event = deferred;
      deferred = null;
      onAvailable(false);
      event.prompt();
      return event.userChoice || Promise.resolve({ outcome: 'unknown' });
    }

    /** True once the page is running as an installed app rather than a tab. */
    function installed() {
      if (!win || !win.matchMedia) return false;
      return win.matchMedia('(display-mode: standalone)').matches ||
        Boolean(win.navigator && win.navigator.standalone);
    }

    return {
      init: function () { listen(); return register(); },
      canInstall: function () { return Boolean(deferred); },
      prompt: promptInstall,
      installed: installed,
      supported: supported
    };
  }

  return { createInstaller: createInstaller };
}));
