/**
 * Section: bottom-up parsing, shift-reduce and LR(0)/SLR.
 *
 * The measurement is what one extra rule buys. LR(0) reduces on every terminal
 * and the expression grammar gets two shift/reduce conflicts; SLR reduces only
 * on FOLLOW of the left-hand side and the same twelve states get zero. That is
 * the whole argument for lookahead, in two numbers you can watch change.
 *
 * The conflict report is the other half, and it is what the milestone's
 * acceptance criterion is about: state, token, both competing actions, and the
 * items responsible. "1 shift/reduce conflict" is what a generator prints and
 * it is not enough to act on.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'shift-reduce-and-lr0';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an item set, and what closure added to it',
      caption: 'An ITEM is a production with a dot marking how far the parser has got: ' +
        '`E → E • + T` means "we are parsing an E, we have seen an E, and `+ T` is still to ' +
        'come". A STATE is a set of items, and CLOSURE is the rule that makes the set complete: ' +
        'whenever the dot sits before a nonterminal, every production of that nonterminal joins ' +
        'the set with its dot at the start, because the parser may be about to start one of ' +
        'those instead. In the state below, only the first item was there to begin with; the ' +
        'other three are what closure added, and they are why the parser knows a `(` or an `a` ' +
        'is legal here without having decided which rule it is in the middle of.',
      definition: [
        'stateDiagram-v2',
        '    state "kernel: E → E + • T" as k',
        '    state "closure adds: T → • T * F" as c1',
        '    state "closure adds: T → • F" as c2',
        '    state "closure adds: F → • ( E )  and  F → • a" as c3',
        '    k --> c1 : dot before T',
        '    c1 --> c2 : dot before T again',
        '    c2 --> c3 : dot before F',
        '    c3 --> [*] : nothing new — the set is closed'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Bottom-up parsing builds the tree from the leaves, deciding what a group of symbols WAS ' +
        'after seeing all of it.** That is the opposite bet from top-down parsing, and it is a ' +
        'better one: the parser never has to guess which production it is in before the evidence ' +
        'arrives, so left recursion is not merely allowed but preferred.',
      '**There are exactly two moves: shift and reduce.** Shift pushes the next input token onto ' +
        'the stack. Reduce pops the right-hand side of a production off the stack and pushes its ' +
        'left-hand side. The parse is a sequence of those two, and the reductions read backwards ' +
        'are a rightmost derivation — which is the formal statement of "bottom-up is top-down ' +
        'run in reverse".',
      '**A handle is the right-hand side that should be reduced next, and finding it is the ' +
        'whole problem.** A viable prefix is any stack contents that could still lead to a ' +
        'successful parse. The theorem that makes LR parsing work is that the set of viable ' +
        'prefixes of any context-free grammar is REGULAR — so a finite automaton can recognise ' +
        'them, and that automaton is the parse table.',
      '**An LR(0) item is a production with a dot; a state is a set of them.** Closure completes ' +
        'a state: a dot before a nonterminal pulls in that nonterminal\'s productions with the ' +
        'dot at the start. GOTO moves the dot past one symbol and closes again. Those two ' +
        'operations generate every state of the automaton from the start item, and nothing else ' +
        'is involved.',
      '**The ACTION table says what to do on a terminal; GOTO says where to go after a ' +
        'reduction.** ACTION cells hold shift-to-a-state, reduce-by-a-production, accept, or ' +
        'nothing. GOTO is consulted only after a reduce, when the exposed nonterminal has to be ' +
        'walked over. Two tables, one automaton.',
      '**LR(0) reduces whenever a state contains a completed item, regardless of what comes ' +
        'next.** That is exactly as blunt as it sounds and it is why the demo\'s expression ' +
        'grammar has two conflicts under LR(0) — the state that has just finished a T also wants ' +
        'to shift a `*`, and with no lookahead there is no basis for choosing.',
      '**SLR adds one rule and it is enough for most real grammars: reduce by `A → α` only when ' +
        'the lookahead is in FOLLOW(A).** The demo shows the same twelve states dropping from ' +
        'two conflicts to zero. FOLLOW is a coarse approximation — it pools what can follow A ' +
        'ANYWHERE rather than what can follow it here — which is why SLR is not always enough ' +
        'and why the next section exists.',
      '**A shift/reduce conflict is a real ambiguity at that point in that state, and the ' +
        'generator\'s default is to shift.** For the dangling else that default is the behaviour ' +
        'every language wants — bind to the nearest `if` — arrived at by accident rather than by ' +
        'decision. That is fine until a conflict you did not look at resolves the other way from ' +
        'what you intended, which is how grammars rot.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — build the item-set automaton and read its conflicts',
        markup: root.LrTemplate.render()
      },
      diagram: diagram(),
      insight: '**A shift/reduce conflict is a real ambiguity in the grammar at that state, and ' +
        'the generator\'s default — shift — is what makes the dangling else work by accident. ' +
        'Silencing conflicts by default is how grammars rot.** Every mainstream generator prints ' +
        'a conflict count and carries on, and every long-lived grammar accumulates them: someone ' +
        'adds a rule, the count goes from 3 to 5, and because 3 was already tolerated nobody ' +
        'investigates the 2. Years later a construct parses in a way nobody chose. The fix is ' +
        'procedural rather than technical — declare the expected conflict count in the build and ' +
        'fail when it changes, so that every new conflict has to be looked at and either fixed ' +
        'or explicitly accepted with a comment saying why.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LrTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const builtFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.LrParser.build(root.ParseLab.fixture(parts[0]), parts[1]);
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const built = builtFor(parts[0] + '\n' + parts[1]);
    const tokens = parts[2].split(' ').filter(function (part) { return part !== ''; });

    return root.LrParser.parse(built, tokens);
  });

  const comparisonFor = root.Helpers.memoise(function (name) {
    return root.LrParser.compare(root.ParseLab.fixture(name));
  });

  function update() {
    const values = panel.values();
    const key = values['slr-grammar'] + '\n' + values['slr-mode'];
    const built = builtFor(key);
    const run = runFor(key + '\n' + values['slr-input']);
    const state = Math.min(Number(values['slr-state']), built.collection.states.length - 1);

    paintMetrics(built, run, values['slr-grammar']);
    paintItems(built, state);
    paintGraph(built);
    paintTable(built);
    paintTrace(run);
    paintConflicts(built);
  }

  function paintMetrics(built, run, name) {
    const rows = comparisonFor(name);
    const lr0 = rows.filter(function (row) { return row.mode === 'lr0'; })[0];
    const slr = rows.filter(function (row) { return row.mode === 'slr'; })[0];

    root.MetricGrid.update({
      'slr-states': { value: root.Format.exact(built.states),
        note: 'generated from the start item by closure and goto, nothing else' },
      'slr-conflicts': { value: root.Format.exact(built.conflicts.length),
        note: built.conflicts.length
          ? 'each named below with its state, its token and the items responsible'
          : 'every cell holds at most one action, so the parse never has to choose' },
      'slr-gain': { value: root.Format.exact(lr0.conflicts) + ' → ' +
        root.Format.exact(slr.conflicts),
      note: lr0.conflicts === slr.conflicts
        ? 'FOLLOW resolves none of them here — the conflict is not about lookahead'
        : 'restricting reduce to FOLLOW of the left-hand side removed ' +
          root.Format.exact(lr0.conflicts - slr.conflicts) + ', at no cost in states' },
      'slr-parse': { value: run.accepted ? 'accepted' : 'rejected',
        note: run.accepted
          ? root.Format.exact(run.steps.length) + ' shift and reduce steps'
          : 'stopped at token ' + run.consumed + (run.expected.length
            ? '; the state expected ' + run.expected.join(' ') : '') }
    });
  }

  function paintItems(built, state) {
    const rows = root.LrItems.stateRows(built.collection);
    const row = rows[state] || rows[0];

    root.jQuery('#slr-items').html(
      '<div style="opacity:.75">state ' + row.state + ' — kernel</div>' +
      row.kernel.map(function (item) {
        return root.Helpers.escapeHtml(item);
      }).join('<br>') +
      '<div style="margin-top:.5rem;opacity:.75">closure added ' +
      (row.items.length - row.kernel.length) + '</div>' +
      row.items.filter(function (item) { return row.kernel.indexOf(item) === -1; })
        .map(function (item) { return root.Helpers.escapeHtml(item); }).join('<br>') +
      '<div style="margin-top:.5rem;opacity:.75">transitions</div>' +
      root.Helpers.escapeHtml(row.transitions.join('   ') || 'none — this state only reduces'));

    root.Helpers.setText('slr-items-note',
      'The kernel is what the parser actually knows; the closure is what it might be starting. ' +
      'Only kernel items are stored in a real generator — the closure is recomputed on demand — ' +
      'because the kernel is small and the closure can be most of the grammar. A state whose ' +
      'kernel contains a completed item (dot at the end) is a state where a reduce is possible, ' +
      'and a state that has both a completed item and a transition on a terminal is exactly ' +
      'where a shift/reduce conflict can live.');
  }

  function paintGraph(built) {
    const machine = automatonOf(built);

    root.jQuery('#slr-graph').html(root.AutomatonView.markup({ machine: machine,
      layout: 'layers', ariaLabel: 'the automaton of item sets', width: 620, height: 340 }));

    root.Helpers.setText('slr-graph-note',
      'This is the finite automaton over viable prefixes — the whole theoretical content of LR ' +
      'parsing in one picture. Its states are the item sets, its alphabet is every grammar ' +
      'symbol (terminals and nonterminals both), and the parser walks it while shifting. The ' +
      'stack holds the states it walked through, so a reduce of a right-hand side of length ' +
      'three pops three states and re-enters the automaton from wherever it was, which is what ' +
      'the GOTO column is for.');
  }

  /** The item-set graph in the shared automaton shape, so the M24 view draws
   *  it — the same picture, reused rather than reimplemented. */
  function automatonOf(built) {
    const states = built.collection.states.map(function (items, i) { return 'q' + i; });
    const delta = {};
    const alphabet = [];

    states.forEach(function (name) { delta[name] = {}; });
    built.collection.transitions.forEach(function (edge) {
      const from = 'q' + edge.from;

      if (alphabet.indexOf(edge.symbol) === -1) alphabet.push(edge.symbol);
      if (!delta[from][edge.symbol]) delta[from][edge.symbol] = [];
      delta[from][edge.symbol].push('q' + edge.to);
    });
    return root.Automaton.create({ states: states, alphabet: alphabet, start: 'q0',
      accepting: states.filter(function (name, i) {
        return built.collection.states[i].some(function (item) {
          return root.LrItems.nextSymbol(item) === null;
        });
      }), delta: delta, label: 'item sets' });
  }

  function paintTable(built) {
    root.jQuery('#slr-table').html(root.ParseTableView.lrMarkup(built, {
      caption: built.mode.toUpperCase() + ' table — ' + built.states + ' states, ' +
        built.conflicts.length + ' conflicts'
    }));

    root.Helpers.setText('slr-table-note',
      '`s5` means shift and go to state 5; `r3` means reduce by production 3; `acc` is accept. ' +
      'The rightmost columns are GOTO, consulted only after a reduce. A highlighted cell wants ' +
      'two actions and the hover text names both. Note how sparse the table is: most cells are ' +
      'empty, and an empty cell is a syntax error whose message can list exactly the tokens the ' +
      'row does have — which is the best error message any parser gets for free.');
  }

  function paintTrace(run) {
    root.jQuery('#slr-trace tbody').html(run.steps.slice(0, 18).map(function (step, i) {
      return '<tr><td class="mono">' + i + '</td><td class="mono">' +
        root.Helpers.escapeHtml(step.stack) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(step.remaining) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(step.action) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">—</td><td class="mono">—</td>' +
      '<td class="mono">no steps</td></tr>');

    root.Helpers.setText('slr-trace-note',
      'The stack column shows symbols interleaved with state numbers, which is how a real LR ' +
      'parser stores it — the states are what the algorithm needs and the symbols are what makes ' +
      'the trace readable. Read the reduce lines from the bottom up and you have the rightmost ' +
      'derivation of the input. Notice that the parser shifts a long way before its first ' +
      'reduce: it is deliberately postponing every decision until the evidence is complete, ' +
      'which is precisely the property a top-down parser gives up.');
  }

  function paintConflicts(built) {
    root.jQuery('#slr-conflict-table tbody').html(built.conflicts.map(function (conflict) {
      return '<tr><td class="mono">state ' + conflict.state + ' on ' +
        root.Helpers.escapeHtml(conflict.terminal) + '</td><td class="mono">' +
        conflict.kind + '</td><td class="mono">' +
        root.Helpers.escapeHtml(conflict.first + '  |  ' + conflict.second) +
        '</td><td class="mono" style="font-size:.78rem">' +
        root.Helpers.escapeHtml(conflict.items.join('  ·  ')) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">none</td>' +
      '<td class="mono">every cell holds one action</td><td class="mono">—</td></tr>');

    root.Helpers.setText('slr-conflict-note',
      'This is what a conflict report should contain and what a generator gives you instead of ' +
      'a count. For the dangling-else grammar the row reads: state 7, on the token `e`, wants ' +
      'both to shift and to reduce `S → i E t S`, and the two items responsible are the ' +
      'completed `S → i E t S •` and the still-going `S → i E t S • e S`. From that you can see ' +
      'immediately that shifting attaches the `else` to the inner `if` and reducing attaches it ' +
      'to the outer one, and that shifting is the behaviour you want — a decision, rather than ' +
      'a default you never examined.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
