/**
 * Section: Runtime support.
 *
 * The measurement is the stack map checked against a live run — and the
 * direction of the check is the whole lesson. A register still holding an
 * object nobody will read again is exactly what a precise collector is
 * entitled to ignore, so its absence from the map is the feature. The bug is
 * the other way round: a register the program does read, missing from the
 * map. Finding that needs the program run, because it is a question about the
 * future.
 *
 * The second is the trace. The same walk that produces a root set produces a
 * source-level stack trace, because both are asking one compiled frame to
 * explain itself in the interpreter's terms.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'runtime-support';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a stack map describing live references in a frame',
      caption: 'At a safepoint the collector needs to know which locations hold references it '
        + 'must not free, and the compiler is the only thing that knows. A stack map is that '
        + 'answer, per safepoint: these registers, these slots, this much operand stack. What '
        + 'makes it PRECISE rather than conservative is what it leaves out — a register still '
        + 'physically holding an object that nothing will read again is not a root, and a '
        + 'collector that scanned it anyway would keep dead objects alive forever.',
      definition: [
        'graph TD',
        'S["safepoint: CALL_R at pc 14"] --> M["stack map"]',
        'M --> R["registers 0 and 3 — read after this point"]',
        'M --> L["every named slot — the frame owns them"]',
        'M --> D["operand stack depth 2"]',
        'X["register 5 — holds an object, never read again"] -.->|"deliberately absent"| M'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Compiled code and the runtime meet at a boundary, and the boundary is a set of rules '
        + 'both sides have to honour.** Where the arguments are, who allocates the frame, where '
        + 'the result goes, when a collection may happen. None of those is discoverable from '
        + 'the code — they are agreements, and an agreement nobody wrote down is one two parts '
        + 'of the compiler will eventually disagree about.',
      '**A safepoint is a place a collection may happen, which is a call or an allocation.** '
        + 'Nothing else can trigger one, so nothing else needs a map. Restricting them is what '
        + 'keeps the metadata small — a map at every instruction would be larger than the code '
        + 'it describes.',
      '**A stack map says which locations hold references at one exact instruction, and the '
        + 'compiler is the only thing that can know.** At runtime a register holds a value; '
        + 'whether that value is a live reference or a dead one depends on what the program '
        + 'does next, and only the compiler has seen that.',
      '**Precision is what the map leaves out, and getting the direction wrong is easy.** A '
        + 'register still holding an object that nothing will read again is not a root: a '
        + 'collector that scanned it would keep a dead object alive, and everything that object '
        + 'points at with it. So its absence from the map is the feature, not a miss.',
      '**The bug is the other direction, and it needs the program run to find.** A location the '
        + 'program will read, missing from the map, is an object the collector frees while '
        + 'something still needs it. Checking that means asking what the program actually reads '
        + 'after each safepoint, which is a question about the future — so the check is dynamic, '
        + 'not another static analysis.',
      '**Conservative collection is what a runtime without maps has to do.** Treat anything '
        + 'that looks like a pointer as one. It works, it is what Boehm\'s collector does, and '
        + 'it costs you: dead objects retained by chance, and no ability to move an object, '
        + 'because moving means updating the references and you do not know which words really '
        + 'are references.',
      '**A stack trace is the same metadata read the other way.** Each frame is at an '
        + 'instruction, each instruction carries the span of the construct it came from, and '
        + 'the span names a line. M28 spent a milestone keeping spans through desugaring and '
        + 'M29 kept them through every pass; this is where that pays.',
      '**Inlining is what makes both hard, and it is the same difficulty twice.** An inlined '
        + 'frame does not exist at runtime, so both the collector and the debugger have to '
        + 'reconstruct it from metadata the compiler left behind — which is the same metadata '
        + 'deoptimisation needs in 30.7. Runtimes that skip it end up with conservative '
        + 'collection AND unreadable traces, and those are one omission rather than two.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — maps, safepoints and a source-level trace',
        markup: root.RuntimeTemplate.render() },
      diagram: diagram(),
      insight: '**Precise garbage collection and inlined stack traces are both consequences of '
        + 'the same metadata; runtimes that skip it end up with conservative collection and '
        + 'unreadable traces.** It is worth seeing that these are one decision rather than two, '
        + 'because they are usually made by different people at different times. The collector '
        + 'team wants to move objects, which needs to know exactly which words are references. '
        + 'The tools team wants a stack trace that names a source line inside an inlined '
        + 'function. Both are asking the compiler the same question — at this instruction, in '
        + 'this frame, what is really here and where did it come from — and both get an answer '
        + 'only if the compiler was made to write it down as it went. A back end that does not '
        + 'is not missing a feature; it has foreclosed two. And the cost is not the metadata '
        + 'itself, which is small, it is that every pass has to preserve it: the M29 optimiser '
        + 'moving an instruction has to move its span, the allocator reassigning a register has '
        + 'to update the map, and the JIT inlining a call has to record the frame it deleted. '
        + 'That is why this is a design decision taken at the start rather than a feature added '
        + 'later.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.RuntimeTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const stateFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const source = root.RuntimeTemplate.SAMPLES[parts[0]];
    const program = root.Berugo.IrLower.compile(source).program;
    const compiled = root.Berugo.Bytecode.compile(program, { mode: parts[1] });

    return { source: source, compiled: compiled,
      chunk: compiled.chunks[compiled.main],
      maps: allMaps(compiled),
      checked: root.Berugo.Runtime.checkSafepoints(compiled, { budget: 200000 }),
      trace: root.Berugo.Runtime.traceAtFault(compiled, source, { budget: 200000 }),
      summary: root.Berugo.Runtime.summary(compiled, source) };
  });

  function allMaps(compiled) {
    const rows = [];

    Object.keys(compiled.chunks).forEach(function (name) {
      root.Berugo.Runtime.stackMap(compiled.chunks[name]).forEach(function (row) {
        rows.push(Object.assign({ fn: name }, row));
      });
    });
    return rows;
  }

  const suiteFor = root.Helpers.memoise(function (mode) {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const program = root.Berugo.IrLower.compile(entry.source).program;
      const compiled = root.Berugo.Bytecode.compile(program, { mode: mode });
      const out = root.Berugo.Runtime.checkSafepoints(compiled, { budget: 200000 });

      return { id: entry.id, safepoints: out.safepoints, observed: out.observed,
        missed: out.missed.length, slack: out.slack };
    });
  });

  function update() {
    const values = panel.values();
    const state = stateFor(JSON.stringify([values['su-sample'], values['su-mode']]));

    paintTrace(state);
    paintMetrics(state);
    paintMaps(state);
    paintSource(state);
    paintConvention();
    paintSuite(values['su-mode']);
  }

  function paintTrace(state) {
    const rows = state.trace.rows;

    root.jQuery('#su-trace tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.depth + '</td><td class="mono">' + row.fn +
        '</td><td class="mono">' + row.origin + '</td><td class="mono">' + row.line +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.locals.join('; ') || '—') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="5">this program runs to the end, so there is no fault '
      + 'to trace</td></tr>');

    root.Helpers.setText('su-trace-caption', traceCaption(state));
  }

  function traceCaption(state) {
    if (!state.trace.faulted) {
      return 'No fault here. Choose the out-of-range index to see the frames captured at the '
        + 'moment one happens — they exist then and are gone a moment later, which is why a '
        + 'runtime has to capture them before the unwinding rather than after.';
    }
    return 'The program faulted with "' + state.trace.error + '", and these are the frames that '
      + 'existed at that instant. Every row names a construct and a source line rather than a '
      + 'bytecode offset, and it does so because each instruction carried the span of the thing '
      + 'it came from all the way from the parser.';
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'su-safepoints': { value: state.summary.safepoints,
        note: 'of ' + state.summary.instructions + ' instructions — only calls and allocations' },
      'su-mapped': { value: state.summary.mapped,
        note: 'live registers, summed over every safepoint of every function' },
      'su-missed': { value: state.checked.missed.length,
        note: state.checked.missed.length ? 'a root the collector would never scan'
          : 'every register the run read after a safepoint was in that safepoint\'s map' },
      'su-spans': { value: state.summary.withSpans + ' of ' + state.summary.instructions,
        note: 'over ' + state.summary.lines + ' lines of source' }
    });
  }

  function paintMaps(state) {
    root.jQuery('#su-maps tbody').html(state.maps.map(function (row) {
      return '<tr><td class="mono">' + row.fn + ':' + row.pc + '</td><td class="mono">' +
        row.op + '</td><td class="mono">' + (row.origin || '—') + '</td><td class="mono">' +
        (row.registers.join(', ') || '—') + '</td><td class="mono">' + row.slots.length +
        '</td><td class="mono">' + row.stackDepth + '</td></tr>';
    }).join('') || '<tr><td colspan="6">this program has no call and no allocation, so it has '
      + 'no safepoint</td></tr>');

    root.Helpers.setText('su-maps-caption',
      state.maps.length + ' safepoints. The register column is the precise part: it lists what '
      + 'is read AFTER this point, not what happens to be sitting in a register. Every slot is '
      + 'always in the map because the frame owns its slots for its whole lifetime, which is '
      + 'why slots are cheap to describe and registers are not.');
  }

  function paintSource(state) {
    const rows = root.Berugo.Runtime.sourceMap(state.chunk, state.source);

    root.jQuery('#su-source tbody').html(rows.slice(0, 16).map(function (row) {
      return '<tr><td class="mono">' + row.pc + '</td><td class="mono">' + row.op +
        '</td><td class="mono">' + row.origin + '</td><td class="mono">' + row.line +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.text) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('su-source-caption',
      'The first ' + Math.min(16, rows.length) + ' of ' + rows.length + ' instructions, each '
      + 'back to the construct and the line it came from. This table IS the source map, and it '
      + 'is the same field the stack trace above reads — one piece of metadata, two consumers, '
      + 'and a third in the collector.');
  }

  function paintConvention() {
    root.jQuery('#su-convention tbody').html(root.Berugo.Runtime.CONVENTION.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.rule) + '</td><td>' +
        root.Helpers.escapeHtml(row.why) + '</td><td>' +
        root.Helpers.escapeHtml(row.breaks) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('su-convention-caption',
      root.Berugo.Runtime.CONVENTION.length + ' rules, and the third column is why they are '
      + 'written down rather than remembered. Every one of them is invisible in the code of '
      + 'either side and catastrophic when the two sides disagree — which is the definition of '
      + 'an interface that needs a specification.');
  }

  function paintSuite(mode) {
    const rows = suiteFor(mode);

    root.jQuery('#su-suite tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.safepoints +
        '</td><td class="mono">' + row.observed + '</td><td class="mono">' + row.missed +
        '</td><td class="mono">' + row.slack + '</td></tr>';
    }).join(''));

    root.Helpers.setText('su-suite-caption', suiteCaption(rows));
  }

  function suiteCaption(rows) {
    const totals = rows.reduce(function (into, row) {
      return { s: into.s + row.safepoints, o: into.o + row.observed,
        m: into.m + row.missed, k: into.k + row.slack };
    }, { s: 0, o: 0, m: 0, k: 0 });

    return totals.s + ' safepoints across the suite, after which the run read ' + totals.o +
      ' registers — ' + totals.m + ' of them missing from a map, and ' + totals.k +
      ' locations mapped that were never read. The first number has to be zero and the second '
      + 'does not: a missing root is an object freed while something needs it, and a spare '
      + 'entry is one wasted read by the collector. Confusing the two directions is the '
      + 'commonest way to write this check backwards, and the first version of it here reported '
      + 'fifteen failures that were the collector being precise.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
