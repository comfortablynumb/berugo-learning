/**
 * TabController - the only tab implementation.
 *
 * Sections never hand-roll a tab strip: a second implementation is a second
 * set of keyboard behaviour, a second active-class convention and a second
 * bug. Handlers are delegated, so a strip can be bound before its markup is
 * rendered.
 *
 * `panelClass` is the selector the controller shows and hides, so it must be
 * unique to the strip that owns it - every section renders a strip, and a
 * shared class would let one section's tab hide another's panel. Styling hooks
 * go in `panelExtraClass`, which the controller never selects on.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TabController = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function buttonId(options, tabId) {
    return options.panelPrefix + tabId + '-tab';
  }

  function button(options, tab, index) {
    const panelId = options.panelPrefix + tab.id;
    const active = index === 0;
    return '<button type="button" class="tab-btn' + (active ? ' active' : '') + '" role="tab"' +
      ' id="' + buttonId(options, tab.id) + '"' +
      ' aria-controls="' + panelId + '" aria-selected="' + (active ? 'true' : 'false') + '"' +
      ' data-tab="' + tab.id + '">' + tab.label + '</button>';
  }

  function panel(options, tab, index) {
    const extra = (options.panelExtraClass ? ' ' + options.panelExtraClass : '') +
      (tab.panelClass ? ' ' + tab.panelClass : '');
    return '<div class="' + options.panelClass + extra + '" id="' + options.panelPrefix + tab.id + '"' +
      ' role="tabpanel" aria-labelledby="' + buttonId(options, tab.id) + '"' +
      (index === 0 ? '' : ' hidden') + '>' + (tab.content || '') + '</div>';
  }

  function markup(options) {
    const tabs = options.tabs || [];
    const buttons = tabs.map(function (tab, i) { return button(options, tab, i); }).join('');
    const panels = tabs.map(function (tab, i) { return panel(options, tab, i); }).join('');
    const stripClass = 'tab-strip' + (options.stripExtraClass ? ' ' + options.stripExtraClass : '');

    return '<div class="' + stripClass + '" id="' + options.stripId + '" role="tablist">' +
      buttons + '</div>' + panels;
  }

  function init(options) {
    const settings = options || {};
    const $ = scope && scope.jQuery;
    if (!$) return null;

    const $strip = $('#' + settings.stripId);
    if (!$strip.length) return null;

    let active = null;

    function activate(tabId) {
      if (active === tabId) return active;

      $strip.find('.tab-btn').each(function () {
        const isActive = $(this).attr('data-tab') === tabId;
        $(this).toggleClass('active', isActive).attr('aria-selected', isActive ? 'true' : 'false');
      });

      $('.' + settings.panelClass).each(function () {
        this.hidden = this.id !== settings.panelPrefix + tabId;
      });

      active = tabId;
      if (settings.onChange) settings.onChange(tabId);
      return active;
    }

    $strip.on('click', '.tab-btn', function () { activate($(this).attr('data-tab')); });

    const first = $strip.find('.tab-btn').first();
    if (first.length) activate(first.attr('data-tab'));

    return { activate: activate, current: function () { return active; } };
  }

  return { init: init, markup: markup };
}));
