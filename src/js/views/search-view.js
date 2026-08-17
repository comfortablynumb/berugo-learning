/**
 * SearchView - the header search box and its result list.
 *
 * Results are grouped by nothing and ranked by relevance, because a learner
 * searching "tombstone" wants the section that explains tombstones, not the
 * track it happens to sit in. Each row says what kind of thing matched -
 * concept, worked example, reference, exercise - so the answer is legible
 * before the click.
 *
 * Keyboard: Ctrl/Cmd+K focuses, ArrowUp/ArrowDown move, Enter opens, Escape
 * closes and blurs. A search that never leaves the keyboard is the point.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SearchView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const KIND_LABEL = {
    section: 'section',
    concept: 'concept',
    example: 'worked example',
    reference: 'reference',
    exercise: 'exercise'
  };

  function helpers() {
    if (scope && scope.Helpers) return scope.Helpers;
    return require('../utils/helpers.js');
  }

  function esc(value) {
    return helpers().escapeHtml(String(value === undefined || value === null ? '' : value));
  }

  function row(result, index, activeIndex) {
    return '<a class="search-hit' + (index === activeIndex ? ' active' : '') + '" ' +
      'href="#' + result.sectionId + '" data-nav="' + result.sectionId + '" data-hit="' + index + '">' +
      '<span class="search-hit-head">' +
      '<span class="search-hit-label">' + esc(result.label) + '</span>' +
      '<span class="search-hit-kind">' + esc(KIND_LABEL[result.kind] || result.kind) + '</span>' +
      '</span>' +
      '<span class="search-hit-where">' + esc(result.sectionTitle) + '</span>' +
      (result.snippet ? '<span class="search-hit-snippet">' + esc(result.snippet) + '</span>' : '') +
      '</a>';
  }

  function markup(results, activeIndex, query) {
    if (!results.length) {
      return '<div class="search-empty">nothing matches “' + esc(query) + '”</div>';
    }
    return results.map(function (result, index) {
      return row(result, index, activeIndex);
    }).join('');
  }

  function mount(options) {
    const $ = scope.jQuery;
    const $input = options.$input;
    const $results = options.$results;
    const index = options.index;
    const onOpen = options.onOpen || function () {};
    const limit = options.limit || 12;

    let results = [];
    let active = -1;

    function close() {
      results = [];
      active = -1;
      $results.attr('hidden', 'hidden').empty();
    }

    function render(query) {
      $results.html(markup(results, active, query)).removeAttr('hidden');
    }

    function run() {
      const query = String($input.val()).trim();
      if (query.length < 2) { close(); return; }
      results = index.search(query, limit);
      active = results.length ? 0 : -1;
      render(query);
    }

    function move(delta) {
      if (!results.length) return;
      active = (active + delta + results.length) % results.length;
      render(String($input.val()).trim());
      const node = $results.find('.search-hit.active')[0];
      if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
    }

    function open(result) {
      if (!result) return;
      close();
      $input.val('').trigger('blur');
      onOpen(result);
    }

    bindKeys({ $: $, $input: $input, move: move, close: close, run: run,
      current: function () { return results[active]; }, open: open });

    $results.on('mousedown', '.search-hit', function (event) {
      event.preventDefault();
      open(results[Number($(this).attr('data-hit'))]);
    });

    $input.on('input', run);
    $input.on('blur', function () { scope.setTimeout(close, 120); });

    return { run: run, close: close, results: function () { return results.slice(); } };
  }

  function bindKeys(deps) {
    const $ = deps.$;

    deps.$input.on('keydown', function (event) {
      const key = event.key;
      if (key === 'ArrowDown') { event.preventDefault(); deps.move(1); return; }
      if (key === 'ArrowUp') { event.preventDefault(); deps.move(-1); return; }
      if (key === 'Enter') { event.preventDefault(); deps.open(deps.current()); return; }
      if (key === 'Escape') { deps.close(); deps.$input.trigger('blur'); }
    });

    $(document).on('keydown', function (event) {
      if (!(event.ctrlKey || event.metaKey) || String(event.key).toLowerCase() !== 'k') return;
      event.preventDefault();
      deps.$input.trigger('focus').trigger('select');
    });
  }

  return { markup: markup, mount: mount, KIND_LABEL: KIND_LABEL };
}));
