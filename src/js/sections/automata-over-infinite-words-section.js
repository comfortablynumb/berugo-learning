/**
 * Section: automata over infinite words.
 *
 * The measurement is the three-by-two matrix: three systems, two properties,
 * and the model checker's verdict for each. The starving server passes the
 * safety check and fails the liveness one, which is the entire lesson of the
 * section made into a table cell — and the counter-example is a lasso that is
 * re-run against the machine to confirm it, because a witness nobody checks is
 * a claim.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'automata-over-infinite-words';
  const SYSTEMS = ['good', 'starve', 'rogue'];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a Büchi automaton and a lasso through it',
      caption: 'The machine below accepts a run that visits `waiting` infinitely often — which ' +
        'is a trace where a request is made and never granted. Acceptance is about the whole ' +
        'infinite run rather than about where it stops, and that is the one change from a ' +
        'finite-word automaton. What makes it computable is that any accepted infinite word has ' +
        'a LASSO representative: a finite stem into a cycle repeated forever. So "does this ' +
        'machine accept anything" becomes "is there a reachable accepting state on a cycle", ' +
        'which is a nested depth-first search — and the cycle it finds is the counter-example a ' +
        'model checker prints.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> idle',
        '    idle --> idle : anything',
        '    idle --> waiting : req without grant',
        '    waiting --> waiting : anything but grant',
        '    note right of waiting',
        '      accepting: visiting here forever',
        '      means the request was never granted',
        '    end note'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A reactive system never terminates, so its behaviour is an INFINITE word.** A server, a ' +
        'protocol endpoint or an event loop has no final state, and asking whether a run ends in ' +
        'an accepting state is the wrong question. Büchi acceptance asks whether an accepting ' +
        'state is visited infinitely often.',
      '**That one change is what lets you express liveness.** "The request is eventually ' +
        'granted" is not a statement about any finite prefix — no matter how long you wait ' +
        'without a grant, it might still arrive. Only an infinite run can violate it.',
      '**Safety fails on a finite prefix; liveness never does.** That is the mechanical ' +
        'distinction and it has a direct consequence: a test can catch a safety violation, ' +
        'because there is a finite trace to catch, and no finite test ever catches a liveness ' +
        'violation. This is why liveness bugs survive testing.',
      '**The demo shows exactly that.** A server that may wait forever passes the safety check ' +
        'and fails the liveness one. Nothing it does in any finite run is wrong; what is wrong ' +
        'is a run it can produce forever.',
      '**Every accepted infinite word has a lasso representative.** A finite stem into a cycle, ' +
        'repeated forever. That is why the language of a Büchi automaton is decidable at all, ' +
        'and why counter-examples are printable.',
      '**Emptiness is a nested depth-first search.** The outer search finds accepting states ' +
        'reachable from the start; for each one, an inner search looks for a path back to it. A ' +
        'hit is an accepting cycle. Doing the inner search in outer post-order keeps the whole ' +
        'thing linear.',
      '**Model checking is the product of the system with the NEGATION of the property.** Build ' +
        'a machine accepting the traces that violate what you want, intersect with the system, ' +
        'and check emptiness. Non-empty means a bug, with a witness.',
      '**Büchi automata do not determinise, which is why the other conditions exist.** No ' +
        'deterministic Büchi automaton recognises "eventually always p". Rabin, Streett and ' +
        'parity conditions are richer acceptance rules that do determinise, at the cost of being ' +
        'harder to read.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — check a system against a property, and get a lasso back',
        markup: root.BuchiTemplate.render()
      },
      diagram: diagram(),
      insight: '**Safety properties fail on a finite prefix and liveness properties never do, ' +
        'which is exactly why liveness bugs survive testing and need model checking or careful ' +
        'reasoning.** The demo\'s middle row is the whole argument: a server that answers every ' +
        'request it ever answers correctly, and may simply never answer one. Every finite trace ' +
        'it produces is indistinguishable from a slow but correct server, so no test, no ' +
        'fuzzing run and no amount of production traffic proves the difference — the ' +
        'counter-example is a behaviour of infinite length. That is the class of bug behind ' +
        'starvation, livelock, unfair locks and retry loops that never converge, and it is why ' +
        'those are found by argument rather than by testing.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BuchiTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function systemFor(name) {
    if (name === 'rogue') return rogueServer();
    return root.Buchi.server(name === 'starve');
  }

  /** A server that emits a grant nobody asked for — the safety violation. */
  function rogueServer() {
    const delta = { q: {} };

    root.Buchi.SYMBOLS.forEach(function (symbol) { delta.q[symbol] = ['q']; });
    return root.Buchi.create({ states: ['q'], alphabet: root.Buchi.SYMBOLS, start: 'q',
      accepting: ['q'], delta: delta, label: 'server that grants without a request' });
  }

  function monitorFor(name) {
    return name === 'safety'
      ? root.Buchi.safetyViolation() : root.Buchi.eventuallyGrantedViolation();
  }

  const checkFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const product = root.Buchi.product(systemFor(parts[0]), monitorFor(parts[1]));
    const result = root.Buchi.emptiness(product);

    return { product: product, result: result,
      confirmed: result.trace ? root.Buchi.accepts(product, result.trace) : null };
  });

  function update() {
    const values = panel.values();
    const state = checkFor(values['inf-system'] + '|' + values['inf-property']);

    paintMetrics(state);
    paintAnswer(state, values);
    paintUnroll(state);
    paintMatrix();
    paintKinds();
    paintConditions();
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'inf-verdict': { value: state.result.empty ? 'holds' : 'VIOLATED',
        note: state.result.empty
          ? 'no accepting cycle is reachable, so no violating behaviour exists'
          : 'an accepting cycle was found, so a violating behaviour exists' },
      'inf-trace': { value: state.result.trace ? state.result.trace.show : 'none',
        note: state.result.trace
          ? root.Format.exact(state.result.trace.stem.length) + '-step stem into a ' +
            root.Format.exact(state.result.trace.cycle.length) + '-step cycle'
          : 'nothing to print — the property holds' },
      'inf-states': { value: root.Format.exact(state.product.states.length),
        note: root.Format.exact(state.result.visits) +
          ' state visits across the outer and inner searches' },
      'inf-confirm': { value: state.confirmed === null ? '—'
        : (state.confirmed ? 'yes' : 'NO'),
      note: state.confirmed === null
        ? 'there is no witness to confirm'
        : 'the lasso was re-run against the product and the accepting state is revisited' }
    });
  }

  function paintAnswer(state, values) {
    root.jQuery('#inf-answer').html(
      '<div class="mono" style="font-size:.85rem">' + values['inf-system'] + ' × ' +
      values['inf-property'] + '</div>' +
      '<div class="mono" style="font-size:.95rem;margin-top:.4rem">' +
      (state.result.empty ? 'the property holds' : 'violated by: ' + state.result.trace.show) +
      '</div>' +
      (state.result.accepting
        ? '<div class="mono" style="font-size:.8rem;margin-top:.4rem">accepting state on the ' +
          'cycle: ' + root.Helpers.escapeHtml(state.result.accepting) + '</div>' : ''));

    root.Helpers.setText('inf-answer-note', state.result.empty
      ? 'The product of the system with the property\'s NEGATION accepts nothing, which is the ' +
        'proof. Note the shape of that argument: the monitor was built to accept exactly the ' +
        'traces that break the property, so an empty language means no such trace exists — not ' +
        'that none was found. The search covered all ' +
        root.Format.exact(state.product.states.length) + ' reachable product states.'
      : 'The notation `stem (cycle)^ω` means: do the stem once, then repeat the cycle forever. ' +
        'Here that is ' + state.result.trace.show + ' — and the last line names the accepting ' +
        'state the cycle keeps returning to, which is what "infinitely often" means ' +
        'operationally. The witness is then re-run against the product to confirm it, because a ' +
        'bug in the nested search would produce a confident wrong trace.');
  }

  function paintUnroll(state) {
    const trace = state.result.trace;
    const steps = trace ? root.Buchi.unroll(trace, 10) : [];

    root.jQuery('#inf-unroll tbody').html(steps.length
      ? steps.map(function (symbol, i) {
        return '<tr><td class="mono">' + i + '</td><td class="mono">' +
          (symbol === '' ? '(nothing happens)' : symbol) + '</td><td class="mono">' +
          (i < trace.stem.length ? 'stem' : 'cycle, repeat ' +
            (Math.floor((i - trace.stem.length) / Math.max(1, trace.cycle.length)) + 1)) +
          '</td></tr>';
      }).join('')
      : '<tr><td class="mono">—</td><td class="mono">no violating trace exists</td>' +
        '<td class="mono">—</td></tr>');

    root.Helpers.setText('inf-unroll-note', trace
      ? 'The first ten steps of an infinite trace. It never ends and it never changes after the ' +
        'stem — which is what makes it a counter-example a person can read, and what makes ' +
        'liveness violations printable at all. Reading it as an incident: the request arrives, ' +
        'and then nothing happens, forever. Every finite prefix of this trace is also a prefix ' +
        'of a perfectly correct run, which is precisely why no test finds it.'
      : 'There is no trace to unroll. For a safety property that means no finite prefix breaks ' +
        'the rule; for a liveness property it means no infinite behaviour does, which is the ' +
        'stronger statement and the one testing cannot reach.');
  }

  function paintMatrix() {
    root.jQuery('#inf-matrix tbody').html(SYSTEMS.map(function (name) {
      const safety = checkFor(name + '|safety');
      const liveness = checkFor(name + '|liveness');

      return '<tr><td>' + label(name) + '</td><td class="mono">' +
        (safety.result.empty ? 'holds' : 'violated') + '</td><td class="mono">' +
        (liveness.result.empty ? 'holds' : 'violated') + '</td><td>' + finding(name) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('inf-matrix-note',
      'The middle row is the section in one line: a server that answers correctly whenever it ' +
      'answers, and may never answer. Safety holds — there is no finite trace in which it does ' +
      'something wrong — and liveness fails, because there is an infinite trace in which it does ' +
      'nothing at all. The last column is what a finite test would report, and for that row it ' +
      'reports nothing wrong. The first and third rows are the controls: a correct server passes ' +
      'both, and a rogue one fails safety with a two-step trace any test would find.');
  }

  function label(name) {
    if (name === 'good') return 'a server that always grants';
    if (name === 'starve') return 'a server that may wait forever';
    return 'a server that grants without a request';
  }

  function finding(name) {
    if (name === 'good') return 'nothing — and correctly so';
    if (name === 'starve') return 'nothing: every finite trace is also a prefix of a correct run';
    return 'the violation immediately — a grant with no request is a two-step trace';
  }

  function paintKinds() {
    const rows = [
      { property: 'Safety — "nothing bad ever happens"',
        violated: 'a finite prefix, after which no continuation can help',
        found: 'testing, fuzzing, assertions, runtime monitors',
        example: 'two threads in the critical section; a grant with no request' },
      { property: 'Liveness — "something good eventually happens"',
        violated: 'only an infinite behaviour',
        found: 'model checking, or an argument',
        example: 'starvation, livelock, a retry loop that never converges' },
      { property: 'Fairness — "if it is enabled infinitely often, it happens"',
        violated: 'an infinite behaviour that ignores an option forever',
        found: 'model checking, as a liveness property under an assumption',
        example: 'a scheduler that never runs one thread; an unfair lock' },
      { property: 'Reachability — "this state is attainable"',
        violated: 'nothing — it is an existence claim, not a rule',
        found: 'search; it is the dual of a safety property',
        example: 'can this error state ever be entered?' }
    ];

    root.jQuery('#inf-kinds tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.property + '</td><td>' + row.violated + '</td><td>' + row.found +
        '</td><td>' + row.example + '</td></tr>';
    }).join(''));

    root.Helpers.setText('inf-kinds-note',
      'The second column is the definition and the third is the consequence, and the pairing is ' +
      'worth memorising because it tells you which tool to reach for. Anything violated by a ' +
      'finite prefix is testable and belongs in a test; anything violated only by an infinite ' +
      'behaviour is not, and belongs in an argument or a model checker. Every property is a ' +
      'conjunction of a safety part and a liveness part — that decomposition is a theorem — so ' +
      'the practical move on a hard requirement is to split it and test the half that can be ' +
      'tested.');
  }

  function paintConditions() {
    const rows = [
      { condition: 'Büchi', accepts: 'some accepting state is visited infinitely often',
        determinisable: 'no — "eventually always p" has no deterministic Büchi automaton',
        used: 'LTL model checking, where nondeterminism is fine' },
      { condition: 'Generalised Büchi', accepts: 'each of several sets is visited infinitely often',
        determinisable: 'no, and it converts to plain Büchi by counting',
        used: 'the natural output of an LTL-to-automaton translation' },
      { condition: 'Rabin', accepts: 'for some pair (E, F): E finitely often, F infinitely often',
        determinisable: 'yes', used: 'determinisation targets, and games' },
      { condition: 'Streett', accepts: 'for every pair: if E infinitely often then F infinitely often',
        determinisable: 'yes', used: 'expressing fairness assumptions directly' },
      { condition: 'Parity', accepts: 'the least priority seen infinitely often is even',
        determinisable: 'yes', used: 'the standard for synthesis and for solving games' },
      { condition: 'Safety (finite)', accepts: 'no bad prefix occurs',
        determinisable: 'yes — it is an ordinary finite automaton on prefixes',
        used: 'runtime monitors, which is why safety can be checked live' }
    ];

    root.jQuery('#inf-conditions tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.condition + '</td><td>' + row.accepts + '</td><td>' +
        row.determinisable + '</td><td>' + row.used + '</td></tr>';
    }).join(''));

    root.Helpers.setText('inf-conditions-note',
      'The third column is the reason the list is this long. Büchi is the easiest condition to ' +
      'read and it does not determinise, which matters because several constructions — ' +
      'complementation, and anything to do with games or synthesis — need a deterministic ' +
      'machine. Rabin, Streett and parity are richer acceptance rules that do determinise, at ' +
      'the cost of being harder to state. The last row is the practical one: safety properties ' +
      'reduce to ordinary finite automata over prefixes, which is exactly why they can be ' +
      'checked by a monitor running in production and liveness properties cannot.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
