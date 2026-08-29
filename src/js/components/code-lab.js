/**
 * CodeLab - the editable, graded code panel.
 *
 * The editor is a textarea layered over a highlighted <pre>: no editor
 * dependency, no iframe, and the learner's keystrokes go straight into a plain
 * form control. Running always goes through Runner, so learner code never
 * executes on the main thread when a worker is available.
 *
 * jQuery is used here because this is the UI layer; the logic it drives
 * (Runner, Sandbox, Progress) never touches the DOM.
 */
(function (root, factory) {
  const api = factory(root, root ? root.jQuery : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CodeLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, $) {
  'use strict';

  /* Resolved on use, not on load, exactly as the annotator itself does: it
     lets `node --test` require this renderer and check that the notation is
     actually decoded, rather than that guarantee living only in a browser. */
  function notation() {
    return scope && scope.NotationMarkup ? scope.NotationMarkup
      : require('../utils/notation-markup.js');
  }

  function helpers() {
    return scope && scope.Helpers ? scope.Helpers : require('../utils/helpers.js');
  }

  function esc(value) {
    return helpers().escapeHtml(value);
  }

  /* The prompt states the task, and it states it in the notation the section
     just taught - "returns the smallest c for which f(n) <= c*g(n)". A learner
     who has to leave the lab to look a symbol up has left the lab, so the
     prompt is annotated. The starter and the solution are code and are never
     annotated: a backticked or typed identifier is not notation. */
  function markup(exercise, options) {
    const id = exercise.id;
    const mark = notation().createAnnotator({
      sectionId: options && options.sectionId
    });
    return '' +
      '<div class="code-lab" data-lab="' + id + '">' +
      '  <div class="code-lab-prompt">' +
      '    <div class="prompt-title">' + mark.annotate(exercise.title || 'Exercise') + '</div>' +
      '    <div class="prompt-text">' + mark.annotate(exercise.prompt) + '</div>' +
      (exercise.entry
        ? '    <div class="note">Define a function named <code>' + esc(exercise.entry) + '</code>. ' +
          'Available inside your code: <code>log</code>, <code>rng</code>, <code>ops</code>, ' +
          '<code>assert</code>.</div>'
        : '') +
      '  </div>' +
      '  <div class="code-lab-toolbar">' +
      '    <button type="button" class="btn btn-primary btn-sm" data-lab-run="' + id + '">Run tests</button>' +
      '    <button type="button" class="btn btn-sm" data-lab-reset="' + id + '">Reset</button>' +
      (exercise.solution
        ? '    <button type="button" class="btn btn-sm" data-lab-solution="' + id + '">Show solution</button>'
        : '') +
      '    <span class="spacer"></span>' +
      '    <span class="code-lab-status" id="lab-status-' + id + '">ready</span>' +
      '  </div>' +
      '  <div class="editor" id="lab-editor-' + id + '">' +
      '    <div class="editor-scroll">' +
      '      <div class="gutter" id="lab-gutter-' + id + '">1</div>' +
      '      <pre id="lab-pre-' + id + '" aria-hidden="true"></pre>' +
      '      <textarea id="lab-code-' + id + '" spellcheck="false" autocomplete="off" ' +
      '        aria-label="Code editor for ' + esc(exercise.title || exercise.id) + '"></textarea>' +
      '    </div>' +
      '  </div>' +
      '  <div class="code-lab-console" id="lab-console-' + id + '"></div>' +
      '  <div class="verdict" id="lab-verdict-' + id + '"></div>' +
      '</div>';
  }

  function collectNodes(id) {
    return {
      id: id,
      $code: $('#lab-code-' + id),
      $pre: $('#lab-pre-' + id),
      $gutter: $('#lab-gutter-' + id),
      $console: $('#lab-console-' + id),
      $verdict: $('#lab-verdict-' + id),
      $status: $('#lab-status-' + id)
    };
  }

  function paint(nodes) {
    const code = nodes.$code.val();
    const lines = code.split('\n');
    nodes.$pre.html(scope.JsHighlight.highlight(code) + '\n');
    nodes.$gutter.text(lines.map(function (_, i) { return i + 1; }).join('\n'));
    const height = (Math.max(6, lines.length + 1) * 1.5 * 0.8125) + 'rem';
    nodes.$code.css('height', height);
    nodes.$pre.css('min-height', height);
  }

  function setCode(nodes, code) {
    nodes.$code.val(code || '');
    paint(nodes);
  }

  function bindEditor(nodes, onChange) {
    const persist = scope.Helpers.debounce(function () { onChange(nodes.$code.val()); }, 400);

    nodes.$code.on('input', function () {
      paint(nodes);
      persist();
    });

    nodes.$code.on('scroll', function () {
      nodes.$pre.css('transform', 'translateY(' + -nodes.$code.scrollTop() + 'px)');
    });

    nodes.$code.on('keydown', function (event) {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const element = nodes.$code[0];
      const start = element.selectionStart;
      const end = element.selectionEnd;
      const value = nodes.$code.val();
      nodes.$code.val(value.slice(0, start) + '  ' + value.slice(end));
      element.selectionStart = start + 2;
      element.selectionEnd = start + 2;
      paint(nodes);
    });
  }

  function bindButtons(config) {
    const exercise = config.exercise;
    const nodes = config.nodes;
    const save = function (code) {
      if (config.storage) config.storage.write(config.draftKey, code);
    };

    $(document).on('click', '[data-lab-run="' + exercise.id + '"]', function () {
      runLab(exercise, nodes, config.runner, config.onResult);
    });

    $(document).on('click', '[data-lab-reset="' + exercise.id + '"]', function () {
      setCode(nodes, exercise.starter);
      save(exercise.starter);
      clearOutput(nodes);
    });

    $(document).on('click', '[data-lab-solution="' + exercise.id + '"]', function () {
      setCode(nodes, exercise.solution);
      save(exercise.solution);
    });
  }

  function mount(options) {
    const exercise = options.exercise;
    const storage = options.storage;
    const nodes = collectNodes(exercise.id);
    if (!nodes.$code.length) return null;

    const draftKey = 'draft:' + options.sectionId + ':' + exercise.id;
    const saved = storage ? storage.read(draftKey, null) : null;
    setCode(nodes, saved === null ? exercise.starter : saved);

    bindEditor(nodes, function (code) {
      if (storage) storage.write(draftKey, code);
    });

    bindButtons({
      exercise: exercise,
      nodes: nodes,
      runner: options.runner,
      storage: storage,
      draftKey: draftKey,
      onResult: options.onResult || function () {}
    });

    return { nodes: nodes, run: function () { return runLab(exercise, nodes, options.runner, options.onResult); } };
  }

  function clearOutput(nodes) {
    nodes.$console.empty();
    nodes.$verdict.empty();
    nodes.$status.text('ready');
  }

  function appendLog(nodes, message) {
    $('<div>')
      .addClass('console-line log-' + (message.level || 'log'))
      .text(message.text)
      .appendTo(nodes.$console);
    nodes.$console.scrollTop(nodes.$console[0].scrollHeight);
  }

  function toRequest(exercise, code) {
    const tests = (exercise.tests || []).map(function (test) {
      return { name: test.name, src: String(test.assert) };
    });
    return {
      code: code,
      entry: exercise.entry,
      tests: tests,
      mode: tests.length ? 'grade' : 'run',
      seed: exercise.seed || 1,
      opsLimit: exercise.opsLimit,
      timeoutMs: exercise.timeoutMs
    };
  }

  function runLab(exercise, nodes, runner, onResult) {
    clearOutput(nodes);
    nodes.$status.text('running…');

    return runner.run(toRequest(exercise, nodes.$code.val()), {
      onLog: function (message) { appendLog(nodes, message); }
    }).then(function (result) {
      renderVerdict(nodes, result);
      nodes.$status.text(statusText(result));
      if (onResult) onResult(result);
      return result;
    });
  }

  function statusText(result) {
    if (result.timedOut) return 'timed out';
    if (result.stage === 'compile') return 'syntax error';
    if (result.total) return result.passedCount + '/' + result.total + ' tests';
    return result.ok ? 'ran' : 'error';
  }

  function verdictParts(result) {
    const parts = [];

    if (result.error) {
      parts.push('<div class="verdict-summary fail">' + esc(result.error.name) + ': ' +
        esc(result.error.message) + '</div>');
    }

    if (result.total) {
      parts.push('<div class="verdict-summary ' + (result.ok ? 'pass' : 'fail') + '">' +
        result.passedCount + ' of ' + result.total + ' tests passed</div>');
      result.tests.forEach(function (test) {
        parts.push('<div class="verdict-item ' + (test.passed ? 'pass' : 'fail') + '">' +
          '<span class="mark">' + (test.passed ? '✓' : '✗') + '</span>' +
          '<span>' + esc(test.name) +
          (test.message ? '<br><span class="detail">' + esc(test.message) + '</span>' : '') +
          '</span></div>');
      });
    }

    if (result.metrics && result.metrics.total) {
      parts.push('<div class="note">instrumented operations: ' + result.metrics.total + '</div>');
    }

    (result.warnings || []).forEach(function (warning) {
      parts.push('<div class="note">' + esc(warning) + '</div>');
    });

    return parts;
  }

  function renderVerdict(nodes, result) {
    nodes.$verdict.html(verdictParts(result).join(''));
  }

  return { markup: markup, mount: mount, runLab: runLab, statusText: statusText };
}));
