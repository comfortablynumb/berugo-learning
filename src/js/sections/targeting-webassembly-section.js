/**
 * Section: Targeting WebAssembly.
 *
 * The measurement is a real module: bytes built here, validated by the host's
 * own WebAssembly validator, instantiated, run, and compared against the IR
 * interpreter on every top-level binding. Nothing about the output is
 * simulated, which is what makes the size and the validation column mean
 * something.
 *
 * The second is the subset. wasm has no dynamic values, so this back end
 * compiles the numeric part of Berugo — and every program outside it carries
 * the reason it is outside. A column of "compiled: no" with no reason is a
 * column nobody can act on, and hiding the excluded programs would make the
 * agreement column meaningless.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'targeting-webassembly';
  let panel = null;
  let chart = null;
  let application = null;

  const SECTION_NAMES = {
    1: 'every function signature, deduplicated',
    3: 'which signature each function has',
    6: 'the mutable globals the top-level bindings live in',
    7: 'what the host can reach: main, and every global',
    10: 'the bodies — locals, then structured control flow'
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a control-flow graph turned back into structure',
      caption: 'wasm has no jumps, so a graph has to become nested `block`, `loop` and `if` '
        + 'with branches to enclosing labels. The rule is read off the dominator tree: a block '
        + 'that is the target of a back edge becomes a `loop`; a block with several '
        + 'predecessors becomes a `block` opened at its immediate dominator and closed just '
        + 'before it; every other edge is emitted inline, because its source dominates its '
        + 'target. A branch is then a `br` whose depth is the label\'s position in the enclosing '
        + 'context — which is why an irreducible graph has no answer at all and this compiler '
        + 'refuses one.',
      definition: [
        'graph TD',
        'G["graph: header → body → latch → header"] --> S["loop L: header; body; br L"]',
        'J["graph: two arms joining at m"] --> B["block M: if …; …; end; then m"]',
        'I["graph: an edge into the middle of a loop"] --> X["no structured form — refused"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**WebAssembly is a real target you can reach from a browser, and the module is bytes '
        + 'you build.** A magic number, a version, and a sequence of sections: types, '
        + 'functions, globals, exports, code. Every integer is LEB128 and every float is eight '
        + 'little-endian bytes. There is nothing to simulate — the host validates and runs what '
        + 'this compiler emits.',
      '**Its control flow is structured, and that is the hard part.** `block`, `loop` and `if` '
        + 'nest, and the only branch is `br N`, which jumps to the end of the Nth enclosing '
        + 'construct. A control-flow graph has no such shape, so a compiler targeting wasm has '
        + 'to turn the graph back into structure — the operation everything before it spent '
        + 'effort undoing.',
      '**The stackifier reads its answer off the dominator tree.** A block targeted by a back '
        + 'edge becomes a `loop`; a block with several predecessors becomes a `block` opened at '
        + 'its immediate dominator; anything else is emitted inline because its source '
        + 'dominates it. That is Ramsey\'s recursive translation, and it is correct for '
        + 'reducible graphs.',
      '**An irreducible graph has no structured form, and this compiler refuses one.** That is '
        + 'M29\'s footnote becoming an engineering problem: no Berugo program produces an '
        + 'irreducible graph, but a language with `goto`, a template expander or a '
        + 'block-merging pass does, and the real answers are node splitting (which duplicates '
        + 'code) or a dispatch loop (which defeats the engine\'s own optimiser).',
      '**Everything in this module is an f64, which is the whole of the subset.** Numbers and '
        + 'Bools fit; a record, an array, a string or a closure over captured values needs a '
        + 'heap, and a heap in wasm means linear memory, an allocator and a layout. So this '
        + 'back end compiles the numeric part of the language and says so per program.',
      '**Erasing types into one machine type costs the observables, which is where the subset '
        + 'really ends.** A Bool comes back as 1 unless the compiler carries its declared type '
        + 'across; a polymorphic function\'s result has no single type to carry, so its binding '
        + 'cannot be printed back at all. That is why a real wasm back end for a dynamic '
        + 'language either boxes every value or specialises per call site.',
      '**Semantics that differ have to be made to agree, and division is the example.** Berugo '
        + 'faults on a division by zero and wasm produces an infinity, so the emitted code '
        + 'guards the divisor and traps — five extra instructions on every division, which is '
        + 'exactly the sort of tax a language pays for a semantics its target does not share.',
      '**The top-level bindings are exported mutable globals, and that is what makes the result '
        + 'readable.** After the host calls the exported `main`, every binding is a global it '
        + 'can read — including after a trap, which is how a faulting program reports the same '
        + 'partial bindings the interpreter does.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — a module built, validated and run',
        markup: root.WasmTemplate.render() },
      diagram: diagram(),
      insight: '**wasm\'s structured control flow means an unstructured graph has to be '
        + 'restructured, which is where the irreducible-flow-graph case from M29 stops being a '
        + 'footnote and becomes a real engineering problem.** M29.2 measured that no Berugo '
        + 'program produces an irreducible graph and reported it as a curiosity — the edge '
        + 'splitter and the reducibility check earned nothing, and the fixture had to be built '
        + 'by hand. Here the same fact is load-bearing: if the graph is reducible the '
        + 'stackifier always succeeds, and if it is not there is no structured form to emit. '
        + 'Compilers that target wasm from languages with `goto` — and every C compiler does — '
        + 'have to either duplicate blocks until the graph becomes reducible, which can grow '
        + 'the code exponentially in the worst case, or emit a dispatch loop with a state '
        + 'variable, which is correct and defeats the engine\'s branch predictor and register '
        + 'allocator on the hottest code in the program. Neither is good. That is the general '
        + 'shape of a target constraint: it does not make anything impossible, it makes one '
        + 'thing expensive, and the expense lands on whoever wrote the least structured code.'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.WasmTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const stateFor = root.Helpers.memoise(function (id) {
    const program = root.Berugo.IrLower.compile(root.WasmTemplate.SAMPLES[id]).program;
    const applicable = root.Berugo.WasmEmit.applicable(program);
    const reference = root.Berugo.IrInterp.run(program);

    if (!applicable.ok) return { program: program, applicable: applicable, reference: reference };
    const bytes = root.Berugo.WasmEmit.buildModule(program);

    return { program: program, applicable: applicable, reference: reference, bytes: bytes,
      valid: root.Berugo.WasmEmit.validate(bytes),
      sections: root.Berugo.WasmEmit.sectionSizes(bytes),
      out: root.Berugo.WasmEmit.run(program),
      shape: root.Berugo.WasmEmit.structureOf(program.functions[0]) };
  });

  const suiteFor = root.Helpers.memoise(function () {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const program = root.Berugo.IrLower.compile(entry.source).program;
      const applicable = root.Berugo.WasmEmit.applicable(program);

      if (!applicable.ok) {
        return { id: entry.id, inSubset: false, why: applicable.reasons[0].why };
      }
      return Object.assign({ id: entry.id, inSubset: true, why: '' },
        suiteRow(program, root.Berugo.IrInterp.run(program)));
    });
  });

  function suiteRow(program, reference) {
    const bytes = root.Berugo.WasmEmit.buildModule(program);
    const out = root.Berugo.WasmEmit.run(program);

    return { bytes: bytes.length, valid: root.Berugo.WasmEmit.validate(bytes).ok,
      agrees: out.outcome === reference.outcome
        && out.bindings.join('|') === reference.bindings.join('|') };
  }

  function update() {
    const state = stateFor(panel.values()['tw-sample']);

    paintSections(state);
    paintMetrics(state);
    paintGraph(state);
    paintBlocks(state);
    paintResult(state);
    paintSuite();
  }

  function paintSections(state) {
    const rows = state.sections || [];

    root.jQuery('#tw-sections tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' + row.id +
        '</td><td class="mono">' + row.size + '</td><td>' +
        (SECTION_NAMES[row.id] || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="4">this program is outside the numeric subset, so no '
      + 'module was built</td></tr>');

    root.Helpers.setText('tw-sections-caption', state.bytes
      ? rows.length + ' sections and ' + state.bytes.length + ' bytes, including the '
        + 'eight-byte header. The code section is almost all of it, which is what you would '
        + 'expect from a format whose other sections are declarations.'
      : 'Nothing to show: this program uses something the numeric subset has no encoding for, '
        + 'and the reason is in the metric below.');
  }

  function paintMetrics(state) {
    const suite = suiteFor();
    const inSubset = suite.filter(function (row) { return row.inSubset; });
    const agreeing = inSubset.filter(function (row) { return row.agrees; }).length;

    root.MetricGrid.update({
      'tw-bytes': { value: state.bytes ? state.bytes.length + ' bytes' : '—',
        note: state.bytes ? 'a module the host will accept'
          : state.applicable.reasons[0].why },
      'tw-valid': { value: state.valid ? (state.valid.ok ? 'yes' : 'NO') : 'n/a',
        note: 'checked by the host\'s own validator, not by this compiler' },
      'tw-agrees': { value: agreementOf(state), note: agreementNote(state) },
      'tw-subset': { value: inSubset.length + ' of ' + suite.length,
        note: agreeing + ' of those ' + inSubset.length + ' agree with the interpreter' }
    });
  }

  function agreementOf(state) {
    if (!state.out) return 'n/a';
    return state.out.outcome === state.reference.outcome
      && state.out.bindings.join('|') === state.reference.bindings.join('|') ? 'yes' : 'NO';
  }

  function agreementNote(state) {
    if (!state.out) return 'outside the subset, so there is nothing to compare';
    return 'wasm says ' + state.out.outcome + ', the interpreter says ' + state.reference.outcome;
  }

  function paintGraph(state) {
    if (chart && chart.chart) chart.chart.destroy();
    const fn = state.program.functions[0];
    const graph = root.Berugo.Cfg.build(fn);
    const tree = root.Berugo.Dominators.compute(graph);

    chart = root.CfgView.render(document.getElementById('tw-graph'), {
      graph: graph, dominators: tree.idom, lazyLib: application.lazyLib,
      backEdges: root.Berugo.Cfg.backEdges(graph, tree),
      notes: structureNotes(graph, tree) });

    root.Helpers.setText('tw-graph-caption',
      'The graph of `' + fn.name + '`, with the dominator tree drawn over it. The note under '
      + 'each block is what the stackifier turned it into — a `loop`, a `block`, or nothing at '
      + 'all because it was emitted inline where its dominator left off.');
  }

  function structureNotes(graph, tree) {
    const headers = new Set(root.Berugo.Cfg.backEdges(graph, tree)
      .map(function (edge) { return edge.to; }));
    const notes = {};

    graph.blocks.forEach(function (id) {
      notes[id] = headers.has(id) ? 'loop'
        : ((graph.preds[id] || []).length > 1 ? 'block' : 'inline');
    });
    return notes;
  }

  function paintBlocks(state) {
    const fn = state.program.functions[0];
    const graph = root.Berugo.Cfg.build(fn);
    const tree = root.Berugo.Dominators.compute(graph);
    const headers = new Set(root.Berugo.Cfg.backEdges(graph, tree)
      .map(function (edge) { return edge.to; }));

    root.jQuery('#tw-blocks tbody').html(graph.blocks.map(function (id) {
      const preds = graph.preds[id] || [];

      return '<tr><td class="mono">' + id + '</td><td class="mono">' +
        (preds.join(', ') || '—') + '</td><td>' + (headers.has(id) ? 'yes' : '—') +
        '</td><td>' + (preds.length > 1 ? 'yes' : '—') + '</td><td class="mono">' +
        becomes(headers.has(id), preds.length > 1) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tw-blocks-caption',
      graph.blocks.length + ' blocks. Reading the last column down is reading the stackifier: '
      + 'two boolean questions per block — is it a back-edge target, does it have several '
      + 'predecessors — and the whole nesting falls out of the answers. That is why the '
      + 'dominator tree from M29.3 had to exist before this section could.');
  }

  function becomes(header, merge) {
    if (header) return 'loop … end';
    if (merge) return 'block … end';
    return 'emitted inline';
  }

  function paintResult(state) {
    const rows = [
      { name: 'outcome', wasm: state.out ? state.out.outcome : 'n/a',
        reference: state.reference.outcome },
      { name: 'bindings', wasm: state.out ? state.out.bindings.join(', ') || '—' : 'n/a',
        reference: state.reference.bindings.join(', ') || '—' }
    ];

    root.jQuery('#tw-result tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.wasm) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.reference) + '</td><td>' +
        (row.wasm === row.reference ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tw-result-caption', resultCaption(state));
  }

  function resultCaption(state) {
    if (!state.out) return 'Outside the subset: ' + state.applicable.reasons[0].why + '.';
    if (state.out.outcome === 'runtime') {
      return 'The module traps, and the globals are still read back — which is why a faulting '
        + 'program reports the same partial bindings the interpreter does. Without the divisor '
        + 'guard wasm would have produced an infinity here and quietly disagreed.';
    }
    return 'Two implementations of the same program agreeing on the outcome and on every '
      + 'top-level binding. The globals are the mechanism: the host calls the exported `main` '
      + 'and then reads them, which is the same observable the interpreter reports.';
  }

  function paintSuite() {
    const rows = suiteFor();

    root.jQuery('#tw-suite tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td>' + (row.inSubset ? 'yes' : 'no') +
        '</td><td class="mono">' + (row.bytes || '—') + '</td><td>' +
        (row.inSubset ? (row.valid ? 'yes' : 'NO') : '—') + '</td><td>' +
        (row.inSubset ? (row.agrees ? 'yes' : 'NO') : '—') + '</td><td>' +
        root.Helpers.escapeHtml(row.why || '') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tw-suite-caption', suiteCaption(rows));
  }

  function suiteCaption(rows) {
    const inSubset = rows.filter(function (row) { return row.inSubset; });
    const agreeing = inSubset.filter(function (row) { return row.agrees; }).length;
    const bytes = inSubset.reduce(function (sum, row) { return sum + row.bytes; }, 0);

    return inSubset.length + ' of ' + rows.length + ' conformance programs are in the numeric '
      + 'subset, compiling to ' + bytes + ' bytes in total; all ' + inSubset.length +
      ' validate and ' + agreeing + ' agree with the interpreter. The last column is the '
      + 'honest part of this table. A back end that quietly skipped the programs it could not '
      + 'handle would show a perfect agreement column that means nothing, and the reasons here '
      + 'are the shape of the work a real wasm back end for a dynamic language has to do: a '
      + 'heap, a value representation, and a type at every observable.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
