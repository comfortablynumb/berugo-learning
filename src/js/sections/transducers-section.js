/**
 * Section: transducers.
 *
 * The measurement is the equality between chaining and composing. The demo
 * runs two machines in sequence — materialising the intermediate string — and
 * runs the composed machine in one pass, over every sample and over two
 * hundred generated strings, and reports whether they agree. That equality is
 * the whole claim of the section: composing is not an approximation of
 * chaining, it is the same function with one traversal instead of two.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'transducers';
  const SAMPLES = ['Hello   World .', 'A  B   C', '   spaced   out   ', 'NoChangeHere'];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a Mealy machine, with output on the transitions',
      caption: 'The space collapser needs exactly one bit of memory: am I immediately after a ' +
        'space? In the `text` state a space is written through and moves to `space`; in the ' +
        '`space` state a further space is read and NOTHING is written, which is how deletion is ' +
        'expressed. Anything else writes itself and returns to `text`. Two states, and the ' +
        'output on the arrows rather than in the states is what makes it a Mealy machine — a ' +
        'Moore machine would need one state per distinct output, which for a case folder means ' +
        'one per letter.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> text',
        '    text --> space : space / write space',
        '    text --> text : other / write it',
        '    space --> space : space / write NOTHING',
        '    space --> text : other / write it'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A transducer is an automaton that writes.** Same states, same transitions, plus an ' +
        'output on each move. Recognition becomes translation, and the whole toolkit — ' +
        'composition, determinisation, minimisation — carries over.',
      '**Mealy puts the output on the transition, Moore puts it on the state.** They are ' +
        'interconvertible and Mealy is usually smaller, because Moore must split a state per ' +
        'distinct output arriving at it. The demo converts a one-state case folder into a ' +
        'Moore machine and it grows to one state per letter.',
      '**An output may be empty, which is what makes deletion expressible.** A transition that ' +
        'consumes a symbol and writes nothing is how whitespace collapsing, comment stripping ' +
        'and case normalisation to a shorter form are all written.',
      '**Composition is the operation that matters.** Chaining two passes materialises the ' +
        'intermediate string: a full copy, a second traversal, and every position offset in the ' +
        'original lost. Composing produces one machine that does both jobs in a single pass.',
      '**The composed state is a pair, exactly as in the product construction.** The subtlety is ' +
        'that the first machine may write several symbols or none for one input symbol, so the ' +
        'second machine advances zero or many steps per composed transition.',
      '**The demo checks composition against chaining rather than asserting it.** Every sample ' +
        'and two hundred generated strings are run both ways and compared. A composition with a ' +
        'subtle bug produces plausible output on the examples somebody wrote by hand.',
      '**Losing position information is the real cost of chaining.** After the second pass, an ' +
        'offset in the output no longer maps to an offset in the original, so error messages ' +
        'point at the wrong character. A composed machine can carry the mapping because it never ' +
        'lost it.',
      '**Weighted transducers turn the run into a shortest-path problem.** Put weights on the ' +
        'transitions, add them along a path, and "run the machine" becomes "find the cheapest ' +
        'path" — which is the same shape as the Viterbi decoder in the next section.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — compose two text machines and check the result',
        markup: root.TransducerTemplate.render()
      },
      diagram: diagram(),
      insight: '**Composing transducers instead of chaining string passes is how text pipelines ' +
        'stay linear-time and lossless; each intermediate string you materialise is a copy and a ' +
        'chance to lose position information.** The copy is the obvious cost and the smaller one. ' +
        'The real damage is the offsets: after a normalisation pass, character 42 of the output ' +
        'is no longer character 42 of the input, so anything that wants to point at the original ' +
        '— a compiler error, a syntax highlighter, a diff — has to reconstruct a mapping that ' +
        'the pass threw away. A composed machine never had two strings to relate, which is why ' +
        'FST pipelines in speech and NLP are built this way and why a five-stage `replace` chain ' +
        'is so hard to attach diagnostics to.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TransducerTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function alphabet() {
    const out = [];

    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function (ch) { out.push(ch); });
    'abcdefghijklmnopqrstuvwxyz .'.split('').forEach(function (ch) { out.push(ch); });
    return out;
  }

  const machinesFor = root.Helpers.memoise(function () {
    const symbols = alphabet();
    const lower = symbols.map(function (ch) { return ch.toLowerCase(); })
      .filter(function (ch, i, all) { return all.indexOf(ch) === i; });
    const fold = root.Transducer.caseFolder(symbols);
    const collapse = root.Transducer.spaceCollapser(lower);

    return { fold: fold, collapse: collapse,
      composed: root.Transducer.compose(fold, collapse),
      moore: root.Transducer.toMoore(fold) };
  });

  /** Chained against composed, over the samples and a generated corpus. */
  const checkFor = root.Helpers.memoise(function () {
    const set = machinesFor('');
    const rng = root.Random.seeded(11);
    const symbols = alphabet();
    const cases = SAMPLES.slice();

    for (let i = 0; i < 200; i += 1) {
      let word = '';

      for (let j = 0; j < 24; j += 1) word += symbols[Math.floor(rng.next() * symbols.length)];
      cases.push(word);
    }
    const rows = cases.map(function (text) {
      const chained = root.Transducer.run(set.collapse,
        root.Transducer.run(set.fold, text).output).output;
      const composed = root.Transducer.run(set.composed, text).output;

      return { text: text, chained: chained, composed: composed, same: chained === composed };
    });

    return { rows: rows, agree: rows.filter(function (row) { return row.same; }).length,
      tested: rows.length };
  });

  function chosen(set, stage) {
    if (stage === 'fold') return set.fold;
    if (stage === 'collapse') return set.collapse;
    return set.composed;
  }

  function update() {
    const values = panel.values();
    const set = machinesFor('');
    const check = checkFor('');
    const machine = chosen(set, values['fst-stage']);
    const input = values['fst-stage'] === 'collapse'
      ? values['fst-input'].toLowerCase() : values['fst-input'];
    const run = root.Transducer.run(machine, input);

    paintMetrics(set, check, run, input);
    paintText(run, input, values['fst-stage']);
    paintRun(run);
    paintCompare(check);
    paintShapes(set);
    paintUses();
  }

  function paintMetrics(set, check, run, input) {
    root.MetricGrid.update({
      'fst-output': { value: root.Format.exact(run.output.length) + ' of ' +
        root.Format.exact(input.length),
      note: run.output.length === input.length
        ? 'nothing was deleted on this input'
        : root.Format.exact(input.length - run.output.length) +
          ' characters consumed and not written' },
      'fst-passes': { value: '1 against 2',
        note: 'the composed machine reads the text once; chaining reads it twice and ' +
          'materialises the middle' },
      'fst-states': { value: root.Format.exact(set.composed.states.length),
        note: root.Format.exact(set.fold.states.length) + ' × ' +
          root.Format.exact(set.collapse.states.length) + ' is the bound, and only reachable ' +
          'pairs are built' },
      'fst-same': { value: root.Format.exact(check.agree) + ' of ' +
        root.Format.exact(check.tested),
      note: check.agree === check.tested
        ? 'composing and chaining produce identical output on every case tested'
        : 'THEY DISAGREE, which would mean the composition is wrong' }
    });
  }

  function paintText(run, input, stage) {
    root.jQuery('#fst-text').html(
      '<div class="mono" style="font-size:.9rem">in : "' +
      root.Helpers.escapeHtml(input) + '"</div>' +
      '<div class="mono" style="font-size:.9rem">out: "' +
      root.Helpers.escapeHtml(run.output) + '"</div>');

    root.Helpers.setText('fst-text-note',
      'The machine shown is "' + stage + '", and it read ' +
      root.Format.exact(input.length) + ' characters to write ' +
      root.Format.exact(run.output.length) + '. ' +
      (input.length === run.output.length
        ? 'Nothing was deleted here, so every transition wrote exactly what it read.'
        : 'The difference is the deletions: ' +
          root.Format.exact(input.length - run.output.length) + ' transitions consumed a symbol ' +
          'and wrote nothing, which is how a repeated space disappears.') +
      ' The state never grows with the input — this is a finite machine, so a megabyte of text ' +
      'costs the same memory as a sentence.');
  }

  function paintRun(run) {
    root.jQuery('#fst-run tbody').html(run.trace.slice(0, 14).map(function (step) {
      return '<tr><td class="mono">' + step.index + '</td><td class="mono">"' +
        root.Helpers.escapeHtml(step.symbol) + '"</td><td class="mono">' +
        root.Helpers.escapeHtml(step.from) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(step.to) + '</td><td class="mono">' +
        (step.out === '' ? '(nothing)' : '"' + root.Helpers.escapeHtml(step.out) + '"') +
        '</td></tr>';
    }).join(''));

    const silent = run.trace.filter(function (step) { return step.out === ''; }).length;

    root.Helpers.setText('fst-run-note',
      'One row per character, with the state before and after and what was written. ' +
      root.Format.exact(silent) + ' of the ' + root.Format.exact(run.trace.length) +
      ' transitions wrote nothing at all, which is the deletion case made visible — a plain ' +
      'automaton has no way to express it, because it has no output to withhold. Note that the ' +
      'state column never carries any information about how much text has been read, only about ' +
      'what still matters, which is the same discipline as section 24.2.');
  }

  function paintCompare(check) {
    root.jQuery('#fst-compare tbody').html(check.rows.slice(0, 6).map(function (row) {
      return '<tr><td class="mono">"' + root.Helpers.escapeHtml(row.text) +
        '"</td><td class="mono">"' + root.Helpers.escapeHtml(row.chained) +
        '"</td><td class="mono">"' + root.Helpers.escapeHtml(row.composed) +
        '"</td><td class="mono">' + (row.same ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('fst-compare-note',
      root.Format.exact(check.agree) + ' of ' + root.Format.exact(check.tested) +
      ' inputs produce identical output both ways — the four hand-written samples plus ' +
      root.Format.exact(check.tested - SAMPLES.length) + ' generated strings of 24 characters ' +
      'each. The generated ones matter: hand-picked examples exercise the cases the author ' +
      'thought of, and a composition bug in the "first machine wrote two symbols" branch would ' +
      'survive all four samples and fail on the corpus. This is the same argument the ' +
      'brute-force oracles make everywhere else in the platform.');
  }

  function paintShapes(set) {
    const rows = [
      { shape: 'Mealy', where: 'the transition', states: set.fold.states.length,
        suits: 'translation, where the output depends on what was just read' },
      { shape: 'Moore', where: 'the state', states: set.moore.states.length,
        suits: 'protocol outputs and hardware, where the output is a property of being somewhere' },
      { shape: 'Weighted (tropical semiring)', where: 'the transition, plus a cost',
        states: set.composed.states.length,
        suits: 'decoding — the best output is the cheapest path' },
      { shape: 'Plain automaton', where: 'nothing is written', states: set.collapse.states.length,
        suits: 'recognition only; it can accept or reject and nothing else' }
    ];

    root.jQuery('#fst-shapes tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.shape + '</td><td>' + row.where + '</td><td class="mono">' +
        root.Format.exact(row.states) + '</td><td>' + row.suits + '</td></tr>';
    }).join(''));

    root.Helpers.setText('fst-shapes-note',
      'The state counts in the third column are the whole trade: the case folder is ' +
      root.Format.exact(set.fold.states.length) + ' state as a Mealy machine and ' +
      root.Format.exact(set.moore.states.length) + ' as a Moore machine, because Moore must ' +
      'split a state per distinct output arriving at it and there is one output per letter. ' +
      'Moore is easier to reason about — the output is a property of where you are rather than ' +
      'of how you got there — which is why hardware and protocol specifications use it and text ' +
      'processing does not.');
  }

  function paintUses() {
    const rows = [
      { use: 'Case folding and Unicode normalisation', reads: 'characters',
        writes: 'their normalised forms, sometimes several per character' },
      { use: 'Tokenising with output', reads: 'source characters',
        writes: 'token types and their text, in one pass' },
      { use: 'Morphological analysis', reads: 'a surface word form',
        writes: 'the lemma and its features — the standard FST application' },
      { use: 'Speech decoding', reads: 'acoustic frames',
        writes: 'words, through composed context, lexicon and grammar transducers' },
      { use: 'Spell correction', reads: 'a possibly wrong word',
        writes: 'candidates, weighted by edit cost — a weighted transducer' },
      { use: 'Protocol translation', reads: 'messages in one dialect',
        writes: 'messages in another, with the state tracking the session' }
    ];

    root.jQuery('#fst-uses tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.use + '</td><td>' + row.reads + '</td><td>' + row.writes +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('fst-uses-note',
      'The fourth row is the one that made the technique famous: a speech decoder is three or ' +
      'four transducers — context dependency, a pronunciation lexicon, a language model — ' +
      'composed into one machine and then optimised as a single object. Nobody runs them in ' +
      'sequence, because the intermediate lattices would be enormous and the composition can be ' +
      'minimised as a whole. That is the same argument as the demo\'s two text machines, at a ' +
      'scale where it stops being an elegance and becomes the only way it works.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
