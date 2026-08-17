/**
 * SettingsView - theme, motion, and the progress file.
 *
 * Everything is local. The export is the whole state, and importing it back
 * restores exactly what was exported - that round trip is asserted in the unit
 * tests, because a progress file that cannot be re-imported is not a backup.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SettingsView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function esc(value) {
    return scope.Helpers.escapeHtml(value);
  }

  function markup() {
    return '' +
      '<div class="grid-2">' +
      '  <div class="card"><div class="card-header">Appearance</div><div class="card-body">' +
      '    <div class="field-row">' +
      '      <label class="field-label" for="setting-theme">Theme</label>' +
      '      <select id="setting-theme"><option value="light">Light</option><option value="dark">Dark</option></select>' +
      '    </div>' +
      '    <div class="field-row">' +
      '      <label class="field-label" for="setting-speed">Animation speed</label>' +
      '      <input type="range" id="setting-speed" min="0.25" max="2" step="0.25" value="1">' +
      '      <span class="note" id="setting-speed-value">1×</span>' +
      '    </div>' +
      '  </div></div>' +
      '  <div class="card"><div class="card-header">Progress</div><div class="card-body">' +
      '    <div id="settings-summary" class="grid-2" ' +
      '         style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:.75rem"></div>' +
      '    <div style="display:flex;gap:.5rem;flex-wrap:wrap">' +
      '      <button class="btn btn-sm" id="progress-export">Export progress</button>' +
      '      <button class="btn btn-sm" id="progress-import">Import progress</button>' +
      '      <button class="btn btn-sm" id="progress-reset">Reset everything</button>' +
      '    </div>' +
      '    <textarea id="progress-json" class="mono" rows="6" ' +
      '      style="width:100%;margin-top:.75rem;display:none;font-size:.75rem" ' +
      '      aria-label="Progress JSON"></textarea>' +
      '    <p class="note" id="progress-note" style="margin-top:.5rem">' +
      '      Everything is stored in this browser only. The export is the whole state.</p>' +
      '  </div></div>' +
      '</div>';
  }

  function metric(label, value) {
    return '<div class="metric"><span class="metric-label">' + esc(label) + '</span>' +
      '<span class="metric-value">' + esc(String(value)) + '</span></div>';
  }

  function renderSummary(app) {
    const $host = scope.jQuery('#settings-summary');
    if (!$host.length) return;
    const summary = app.progress.summary();
    $host.html(metric('Opened', summary.visited + summary.done) +
      metric('Completed', summary.done) +
      metric('Labs passed', summary.labsPassed) +
      metric('Labs attempted', summary.labsAttempted));
  }

  function bindTheme(app) {
    const $select = scope.jQuery('#setting-theme');
    if (!$select.length) return;
    $select.val(app.theme.current());
    $select.on('change', function () { app.theme.set(String($select.val())); });
  }

  function bindSpeed(app) {
    const $slider = scope.jQuery('#setting-speed');
    const $label = scope.jQuery('#setting-speed-value');
    if (!$slider.length) return;
    $slider.val(String(app.state.get('animationSpeed') || 1));
    $label.text($slider.val() + '×');
    $slider.on('input', function () {
      app.state.set('animationSpeed', Number($slider.val()));
      $label.text($slider.val() + '×');
    });
  }

  function bindProgress(app) {
    const $ = scope.jQuery;
    const $area = $('#progress-json');
    const $note = $('#progress-note');

    $('#progress-export').on('click', function () {
      $area.show().val(JSON.stringify(app.progress.exportAll(), null, 2));
      $note.text('Copy this JSON to move progress to another browser.');
    });

    $('#progress-import').on('click', function () {
      $area.show();
      try {
        app.progress.importAll(JSON.parse(String($area.val())));
        $note.text('Imported. The sidebar and map now reflect the imported state.');
        renderSummary(app);
      } catch (error) {
        $note.text('Import failed: ' + error.message);
      }
    });

    $('#progress-reset').on('click', function () {
      app.progress.reset();
      $note.text('Progress cleared.');
      renderSummary(app);
    });
  }

  function mount(app) {
    bindTheme(app);
    bindSpeed(app);
    bindProgress(app);
    renderSummary(app);
    return true;
  }

  return { markup: markup, mount: mount, renderSummary: renderSummary };
}));
