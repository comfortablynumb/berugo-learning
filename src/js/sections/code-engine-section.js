/**
 * Section: How this platform runs your code.
 *
 * The demo runs real snippets through the real runner and shows the actual
 * message stream, including the timeout path - the section is a live
 * description of the machinery every other section depends on.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'code-engine';

  const SNIPPETS = {
    ok: 'function work() {\n  let total = 0;\n  for (let i = 0; i < 1e5; i += 1) total += i;\n  return total;\n}',
    logging: 'function work() {\n  log("starting");\n  log("seeded value", rng.int(100));\n  log.warn("a warning");\n  return "done";\n}',
    counted: 'function work() {\n  const values = [8, 3, 5, 1];\n  for (let i = 0; i < values.length; i += 1) {\n' +
      '    for (let j = i + 1; j < values.length; j += 1) {\n      if (ops.cmp(values[j], values[i]) < 0) ops.swap(values, i, j);\n' +
      '    }\n  }\n  return values.join(",");\n}',
    throws: 'function work() {\n  const config = null;\n  return config.value;\n}',
    syntax: 'function work( {\n  return 1;\n}',
    timeout: 'function work() {\n  while (true) {}\n}'
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID) return;
      if (!app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'Every runnable thing on this platform goes through one path: your code is compiled with ' +
          'new Function inside a Web Worker, given four capabilities (log, a seeded rng, instrumented ' +
          'ops counters and assert) and nothing else, and watched by a wall-clock budget.',
        'The budget matters because a bare infinite loop cannot be stopped from inside. The only ' +
          'reliable stop is terminate(), which is why the runner owns a watchdog and replaces the ' +
          'worker afterwards.',
        'Run the snippets below and watch the message stream. The timeout snippet really does hang ' +
          'a worker, and the inspector shows it being killed.'
      ],
      demo: { title: 'Interactive demo — the protocol, live', markup: root.CodeEngineTemplate.render() },
      diagram: {
        title: 'Diagram — one run, host to worker',
        caption: 'The watchdog is the only path that can end a run the worker will not end itself.',
        definition: [
          'sequenceDiagram',
          '    participant H as Host (CodeLab)',
          '    participant R as Runner',
          '    participant W as Worker',
          '    H->>R: run({ code, entry, tests, seed })',
          '    R->>W: postMessage(run)',
          '    R-->>R: start watchdog(timeoutMs)',
          '    W-->>R: log / test / metric …',
          '    alt finishes in time',
          '        W->>R: done(result)',
          '        R->>H: result',
          '    else exceeds the budget',
          '        R-)W: terminate()',
          '        R->>H: timeout result',
          '        R-->>W: replace worker',
          '    end'
        ].join('\n')
      },
      insight: 'Measurement is part of the teaching, not decoration. Every number this platform ' +
        'shows names the counter it came from, because "faster" without a unit is how benchmarks lie.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });
    bind(app);
  }

  function bind(app) {
    const $ = root.jQuery;

    $('#engine-backend').text(app.runner.backendName +
      (app.runner.enforcesTimeout ? ' (enforces the budget)' : ' (no timeout enforcement)'));

    $('#engine-budget').on('input', function () {
      $('#engine-budget-value').text(String($('#engine-budget').val()));
    });

    $('#engine-run').on('click', function () { runSnippet(app); });
  }

  function runSnippet(app) {
    const $ = root.jQuery;
    const kind = String($('#engine-snippet').val());
    const timeoutMs = Number($('#engine-budget').val());
    const rows = [];
    const started = performance.now();

    $('#engine-verdict').text('running…');
    $('#engine-run').prop('disabled', true);

    function record(type, payload) {
      rows.push({ t: performance.now() - started, type: type, payload: payload });
      paintMessages(rows);
    }

    record('run', kind + ' · budget ' + timeoutMs + ' ms');

    app.runner.run({
      code: SNIPPETS[kind], entry: 'work', mode: 'run', seed: 7, timeoutMs: timeoutMs
    }, {
      onLog: function (message) { record('log', message.level + ': ' + message.text); }
    }).then(function (result) {
      record('done', result.stage);
      paintMetrics(result, rows);
      $('#engine-verdict').text(result.timedOut ? 'terminated' : result.stage);
      $('#engine-run').prop('disabled', false);
    });
  }

  function paintMessages(rows) {
    const escape = root.Helpers.escapeHtml;
    root.jQuery('#engine-messages tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.t.toFixed(1) + '</td>' +
        '<td class="mono">' + escape(row.type) + '</td>' +
        '<td>' + escape(row.payload) + '</td></tr>';
    }).join(''));
  }

  function paintMetrics(result, rows) {
    const format = root.Format;
    const outcome = result.timedOut ? 'timeout' : (result.ok ? 'ok' : 'error');
    root.Helpers.setText('engine-outcome', outcome);
    root.Helpers.setText('engine-outcome-note', result.error
      ? result.error.name + ': ' + result.error.message
      : 'stage: ' + result.stage);
    root.Helpers.setText('engine-duration', format.duration(result.durationMs));
    root.Helpers.setText('engine-ops', String((result.metrics && result.metrics.total) || 0));
    root.Helpers.setText('engine-ops-note', describeOps(result.metrics));
    root.Helpers.setText('engine-logs', String(rows.filter(function (r) { return r.type === 'log'; }).length));
  }

  function describeOps(metrics) {
    if (!metrics || !metrics.total) return 'this snippet used none';
    return Object.keys(metrics)
      .filter(function (key) { return key !== 'total'; })
      .map(function (key) { return key + ': ' + metrics[key]; })
      .join(' · ');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
