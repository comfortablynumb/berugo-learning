/**
 * MermaidRenderer - on-demand diagram rendering with theme awareness.
 *
 * mermaid is initialised with `startOnLoad: false` and rendered explicitly, so
 * nothing scans the DOM. Every rendered host is remembered, and the `theme`
 * event re-renders all of them with fresh `themeVariables` read from the CSS
 * custom properties - which is why no diagram in this platform carries a
 * hard-coded colour.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.createMermaidRenderer = api.createMermaidRenderer;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const VARIABLE_MAP = {
    background: '--surface-card',
    primaryColor: '--accent-soft',
    primaryTextColor: '--text-primary',
    primaryBorderColor: '--accent',
    secondaryColor: '--hue-purple-soft',
    tertiaryColor: '--surface-sunken',
    lineColor: '--border-strong',
    textColor: '--text-primary',
    mainBkg: '--surface-sunken',
    nodeBorder: '--border-strong',
    clusterBkg: '--surface-page',
    clusterBorder: '--border-color',
    edgeLabelBackground: '--surface-card',
    noteBkgColor: '--hue-amber-soft',
    noteTextColor: '--text-primary',
    actorBkg: '--surface-sunken',
    actorTextColor: '--text-primary',
    signalColor: '--text-secondary',
    signalTextColor: '--text-secondary',
    labelBoxBkgColor: '--surface-sunken',
    labelTextColor: '--text-primary'
  };

  /* mermaid caps a node's width at `wrappingWidth` and then styles the label
     `white-space: nowrap`, so a label wider than the cap is not wrapped - it is
     clipped, silently, mid-word. At mermaid's default of 200px that was
     happening to 908 label lines across this curriculum: "what do you know
     about the input?" rendered as "what do you know about the".

     720 is measured rather than guessed. Every label line in every diagram here
     was rendered at the 16px mermaid gives them and the widest came to 678px,
     in the simply-typed lambda calculus. This clears it with room to spare. */
  const WRAPPING_WIDTH = 720;

  function createRendererConfig(themeVariables) {
    return {
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: themeVariables,
      flowchart: { curve: 'basis', htmlLabels: true, wrappingWidth: WRAPPING_WIDTH },
      sequence: { useMaxWidth: true, wrap: true }
    };
  }

  function createMermaidRenderer(options) {
    const settings = options || {};
    const lazy = settings.lazyLib;
    const documentRef = settings.document || (typeof document !== 'undefined' ? document : null);
    const hosts = new Set();
    let counter = 0;

    function readVariables() {
      const styles = getComputedStyle(documentRef.documentElement);
      return Object.keys(VARIABLE_MAP).reduce(function (acc, key) {
        const value = styles.getPropertyValue(VARIABLE_MAP[key]).trim();
        if (value) acc[key] = value;
        return acc;
      }, { fontFamily: styles.getPropertyValue('--font-sans').trim() || 'sans-serif' });
    }

    function configure(mermaid) {
      mermaid.initialize(createRendererConfig(readVariables()));
      return mermaid;
    }

    function render(host, definition) {
      if (!host) return Promise.resolve(null);
      host.dataset.mermaidSource = definition;
      hosts.add(host);
      host.classList.add('mermaid-host');
      host.textContent = 'rendering diagram…';

      return lazy.mermaid().then(function (mermaid) {
        configure(mermaid);
        counter += 1;
        return mermaid.render('mermaid-' + counter, definition);
      }).then(function (output) {
        host.innerHTML = output.svg;
        if (output.bindFunctions) output.bindFunctions(host);
        return host;
      }).catch(function (error) {
        host.innerHTML = '';
        const pre = documentRef.createElement('pre');
        pre.className = 'mermaid-error';
        pre.textContent = 'diagram failed to render: ' + (error && error.message ? error.message : error);
        host.appendChild(pre);
        return host;
      });
    }

    function refreshAll() {
      if (!lazy.isLoaded('mermaid')) return Promise.resolve([]);
      const live = Array.from(hosts).filter(function (host) { return host.isConnected; });
      hosts.clear();
      return Promise.all(live.map(function (host) {
        return render(host, host.dataset.mermaidSource || '');
      }));
    }

    return { render: render, refreshAll: refreshAll, trackedCount: function () { return hosts.size; } };
  }

  return {
    createMermaidRenderer: createMermaidRenderer,
    createRendererConfig: createRendererConfig,
    wrappingWidth: WRAPPING_WIDTH
  };
}));
