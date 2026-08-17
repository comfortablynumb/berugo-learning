/**
 * LazyLib - loads mermaid and D3 on first use, exactly once.
 *
 * Neither library is in the shell: the home map needs no chart and no diagram,
 * and mermaid alone is larger than everything else on the page combined. Two
 * sections asking for the same library concurrently share one in-flight
 * promise, so the script tag is added once.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.createLazyLib = api.createLazyLib;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const SOURCES = {
    d3: { url: 'lib/d3.v7.min.js', global: 'd3' },
    mermaid: { url: 'lib/mermaid.min.js', global: 'mermaid' }
  };

  function createLazyLib(options) {
    const settings = options || {};
    const documentRef = settings.document || (typeof document !== 'undefined' ? document : null);
    const host = settings.global || (typeof window !== 'undefined' ? window : {});
    const sources = Object.assign({}, SOURCES, settings.sources || {});
    const pending = {};
    const loadCounts = {};

    function loadScript(url) {
      return new Promise(function (resolve, reject) {
        const tag = documentRef.createElement('script');
        tag.src = url;
        tag.async = true;
        tag.onload = function () { resolve(); };
        tag.onerror = function () { reject(new Error('failed to load ' + url)); };
        documentRef.head.appendChild(tag);
      });
    }

    function load(name) {
      const source = sources[name];
      if (!source) return Promise.reject(new Error('unknown library: ' + name));
      if (host[source.global]) return Promise.resolve(host[source.global]);
      if (pending[name]) return pending[name];

      loadCounts[name] = (loadCounts[name] || 0) + 1;
      pending[name] = loadScript(source.url).then(function () {
        if (!host[source.global]) throw new Error(name + ' loaded but did not define ' + source.global);
        return host[source.global];
      });

      return pending[name];
    }

    return {
      load: load,
      d3: function () { return load('d3'); },
      mermaid: function () { return load('mermaid'); },
      isLoaded: function (name) { return Boolean(host[(sources[name] || {}).global]); },
      loadCount: function (name) { return loadCounts[name] || 0; }
    };
  }

  return { createLazyLib: createLazyLib };
}));
