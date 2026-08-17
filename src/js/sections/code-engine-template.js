/** Markup for "How this platform runs your code". No logic, no state. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CodeEngineTemplate = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function controls() {
    return '' +
      '<div class="card"><div class="card-header">Run a snippet</div><div class="card-body">' +
      '  <div class="field-row">' +
      '    <label class="field-label" for="engine-snippet">Snippet</label>' +
      '    <select id="engine-snippet">' +
      '      <option value="ok">completes normally</option>' +
      '      <option value="logging">writes to the console</option>' +
      '      <option value="counted">uses instrumented primitives</option>' +
      '      <option value="throws">throws</option>' +
      '      <option value="syntax">has a syntax error</option>' +
      '      <option value="timeout">never terminates</option>' +
      '    </select>' +
      '  </div>' +
      '  <div class="field-row">' +
      '    <label class="field-label" for="engine-budget">Wall-clock budget: ' +
      '      <span id="engine-budget-value">600</span> ms</label>' +
      '    <input type="range" id="engine-budget" min="100" max="2000" step="100" value="600">' +
      '  </div>' +
      '  <button class="btn btn-primary" id="engine-run">Run</button>' +
      '  <p class="note" style="margin-top:.5rem">Backend: <span id="engine-backend">…</span></p>' +
      '</div></div>';
  }

  function inspector() {
    return '' +
      '<div class="card"><div class="card-header">Protocol inspector' +
      '  <span class="chip" id="engine-verdict">idle</span></div>' +
      '  <div class="card-body">' +
      '    <table class="ref-table" id="engine-messages">' +
      '      <thead><tr><th>t (ms)</th><th>message</th><th>payload</th></tr></thead>' +
      '      <tbody><tr><td colspan="3" class="note">Run a snippet to see the message stream.</td></tr></tbody>' +
      '    </table>' +
      '  </div>' +
      '</div>';
  }

  function metrics() {
    return '' +
      '<div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:.875rem">' +
      '  <div class="metric"><span class="metric-label">Outcome</span>' +
      '    <span class="metric-value" id="engine-outcome">—</span>' +
      '    <span class="metric-note" id="engine-outcome-note">stage of the run</span></div>' +
      '  <div class="metric"><span class="metric-label">Duration</span>' +
      '    <span class="metric-value" id="engine-duration">—</span>' +
      '    <span class="metric-note">measured inside the sandbox</span></div>' +
      '  <div class="metric"><span class="metric-label">Instrumented ops</span>' +
      '    <span class="metric-value" id="engine-ops">—</span>' +
      '    <span class="metric-note" id="engine-ops-note">counted, not estimated</span></div>' +
      '  <div class="metric"><span class="metric-label">Console lines</span>' +
      '    <span class="metric-value" id="engine-logs">—</span>' +
      '    <span class="metric-note">captured in the worker</span></div>' +
      '</div>';
  }

  function render() {
    return '<div class="grid-2">' + controls() + inspector() + '</div>' + metrics();
  }

  return { render: render };
}));
