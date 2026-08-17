/**
 * StorageAdapter - the only place that knows about localStorage.
 *
 * Everything that persists (theme, progress, lab drafts) goes through this
 * interface, so unit tests pass an in-memory double and never touch a real
 * browser API. A quota error or a disabled-storage browser degrades to
 * in-memory rather than throwing into a caller.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.createStorage = api.createStorage;
    root.createMemoryStorage = api.createMemoryStorage;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const PREFIX = 'berugo:';

  function createMemoryStorage() {
    const map = new Map();
    return {
      getItem: function (key) { return map.has(key) ? map.get(key) : null; },
      setItem: function (key, value) { map.set(key, String(value)); },
      removeItem: function (key) { map.delete(key); },
      key: function (i) { return Array.from(map.keys())[i] || null; },
      get length() { return map.size; }
    };
  }

  function pickBackend(backend) {
    if (backend) return backend;
    try {
      const probe = '__berugo_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (error) {
      return createMemoryStorage();
    }
  }

  function createStorage(options) {
    const settings = options || {};
    const backend = pickBackend(settings.backend);
    const prefix = settings.prefix || PREFIX;

    function read(key, fallback) {
      try {
        const raw = backend.getItem(prefix + key);
        return raw === null || raw === undefined ? fallback : JSON.parse(raw);
      } catch (error) {
        return fallback;
      }
    }

    function write(key, value) {
      try {
        backend.setItem(prefix + key, JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    }

    function remove(key) {
      try {
        backend.removeItem(prefix + key);
        return true;
      } catch (error) {
        return false;
      }
    }

    function keys() {
      const found = [];
      for (let i = 0; i < backend.length; i += 1) {
        const key = backend.key(i);
        if (key && key.indexOf(prefix) === 0) found.push(key.slice(prefix.length));
      }
      return found;
    }

    return { read: read, write: write, remove: remove, keys: keys };
  }

  return { createStorage: createStorage, createMemoryStorage: createMemoryStorage };
}));
