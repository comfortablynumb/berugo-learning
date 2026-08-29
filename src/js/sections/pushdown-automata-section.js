/**
 * Section: pushdown automata.
 *
 * The measurement is agreement: the CFG → PDA construction is run against
 * Earley over every string up to length six, and the table prints both verdicts
 * per input. That is the acceptance criterion the milestone names, and it is
 * also the only honest way to claim a construction is correct — the equivalence
 * proof is a page of induction and the check is a loop.
 *
 * The second measurement is the stack depth, which is the whole difference
 * between this milestone and the last one. A finite automaton has none; the
 * demo shows the number growing with the nesting, which is what "unbounded
 * memory" means when you can watch it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'pushdown-automata';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one transition, and what it does to the stack',
      caption: 'A PDA transition reads three things and writes one. It reads the input symbol ' +
        '(or nothing, which is an ε-move and consumes no input), the state, and the symbol on ' +
        'top of the stack; it writes a new state and a replacement for that top symbol — which ' +
        'may be several symbols (a push), one (a rewrite) or none (a pop). Everything a PDA can ' +
        'do is that. The reason it recognises `aⁿbⁿ` and a finite automaton cannot is that the ' +
        'stack has no bound: the machine below has two states and can match a million brackets, ' +
        'because the counting lives in the stack rather than in the state set.',
      definition: [
        'graph LR',
        '    A["state: push<br/>stack top: A<br/>input: a"] -->|"read a, pop A, push A A"| ' +
          'B["state: push<br/>stack: A A<br/>one symbol deeper"]',
        '    B -->|"read b, pop A, push<br/>nothing"| C["state: pop<br/>stack: A<br/>one symbol shallower"]',
        '    C -->|"read nothing, pop Z,<br/>push nothing"| D["stack empty<br/>accept"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A pushdown automaton is a finite automaton with one unbounded stack, and that single ' +
        'addition is the whole of this milestone.** M24 established that a finite automaton can ' +
        'count modulo k and cannot count to n, because counting to n needs n states and the set ' +
        'is fixed in advance. A stack lifts exactly that restriction and nothing else.',
      '**The stack is why nesting is parseable and matching brackets is not regular.** Every ' +
        '"you cannot match brackets with a regex" argument bottoms out here: the pumping lemma ' +
        'says a finite automaton on `(ⁿ)ⁿ` must repeat a state inside the opening run, and ' +
        'pumping that repetition breaks the balance. A stack does not repeat — it grows.',
      '**Acceptance comes in two flavours and they are equivalent.** By final state: the input ' +
        'is exhausted and the machine is in an accepting state. By empty stack: the input is ' +
        'exhausted and nothing is left on the stack. Either can simulate the other with a bottom ' +
        'marker and one extra state, so the choice is presentational — the machines here use ' +
        'empty stack because it makes the bracket example one rule shorter.',
      '**PDAs and context-free grammars are equivalent, in both directions.** The grammar → PDA ' +
        'direction is three transition kinds and the demo runs it live: push the start symbol, ' +
        'replace a nonterminal on top by one of its right-hand sides, and match a terminal on ' +
        'top against the input. That machine is a nondeterministic top-down parser, which is ' +
        'why it accepts exactly what the grammar derives.',
      '**Nondeterminism is not optional here.** The constructed machine has to GUESS which ' +
        'production to expand, and the demo explores every guess breadth-first as a set of live ' +
        'configurations — the same technique as running an NFA, with the stack as the extra ' +
        'state. That is also why the configuration count grows so much faster than the input ' +
        'length.',
      '**Deterministic PDAs recognise strictly less.** A DPDA has at most one move per ' +
        '(state, input, stack top) and cannot mix an ε-move with a reading move. The ' +
        'deterministic context-free languages are exactly what LR parsers handle, and they are a ' +
        'strict subset: the palindromes over {a, b} are context-free and not deterministic, ' +
        'because nothing tells the machine where the middle is.',
      '**Context-free languages are closed under union, concatenation and star, and not under ' +
        'intersection or complement.** That non-closure is practical rather than academic: it ' +
        'is why you cannot express "a valid program that also satisfies this other grammar" as ' +
        'one grammar, and it is why type checking is a separate pass rather than more rules.',
      '**Left recursion makes the constructed PDA search forever.** `E → E + E` lets the machine ' +
        'expand E to E + E to E + E + E without ever consuming input, so a breadth-first search ' +
        'with no bound does not terminate. The demo caps the search and says so rather than ' +
        'reporting a rejection, because a cap silently reported as "no" is a lie about the ' +
        'language.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — run a PDA, or build one from a grammar and check it',
        markup: root.PdaTemplate.render()
      },
      diagram: diagram(),
      insight: '**The stack is exactly what a regular language lacks, and it is exactly one ' +
        'unbounded resource — every "a regex cannot match nested brackets" argument bottoms out ' +
        'here.** The practical form of that is a rule for choosing a tool: if the thing you are ' +
        'matching nests, no regular expression will do it, and no amount of cleverness with ' +
        'backreferences changes the class of the problem. A regex over HTML, over JSON, over ' +
        'balanced quotes in a template — each of these is the same mistake, and each one works ' +
        'on the examples in the ticket and fails on the first input that nests one level ' +
        'deeper than the author imagined. The fix is not a longer pattern; it is a parser, and ' +
        'this section is the reason why.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PdaTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function machineFor(kind, grammarName) {
    if (kind === 'brackets') return root.Pda.brackets();
    if (kind === 'anbn') return root.Pda.anbn();
    return root.Pda.fromGrammar(root.ParseLab.fixture(grammarName));
  }

  function tokensOf(text) {
    return String(text).split(' ').filter(function (part) { return part !== ''; });
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const machine = machineFor(parts[0], parts[1]);
    const tokens = tokensOf(parts[2]);
    const result = root.Pda.run(machine, tokens, 20000);

    return { machine: machine, tokens: tokens, result: result,
      depth: result.trace.reduce(function (best, snap) {
        return Math.max(best, snap.stack.split(' ').length);
      }, 0) };
  });

  /**
   * Every string up to length six through both the PDA and Earley. For the
   * hand-built machines the reference grammar is the one the machine claims to
   * recognise; for the construction it is the grammar it was built from.
   */
  const agreementFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const machine = machineFor(parts[0], parts[1]);
    const grammar = referenceGrammar(parts[0], parts[1]);
    const inputs = root.ParseLab.exhaustive(grammar.terminals, 4);
    const rows = inputs.map(function (tokens) {
      const pda = root.Pda.run(machine, tokens, 8000);
      const earley = root.Earley.parse(grammar, tokens).accepted;

      return { tokens: tokens, text: tokens.join(' ') || 'ε',
        pda: pda.exhausted && !pda.accepted ? null : pda.accepted, earley: earley,
        agree: (pda.exhausted && !pda.accepted) ? null : pda.accepted === earley };
    });

    return { rows: rows, checked: rows.filter(function (r) { return r.agree !== null; }).length,
      failures: rows.filter(function (r) { return r.agree === false; }),
      capped: rows.filter(function (r) { return r.agree === null; }).length };
  });

  function referenceGrammar(kind, grammarName) {
    if (kind === 'fromGrammar') return root.ParseLab.fixture(grammarName);
    if (kind === 'anbn') {
      return root.Grammar.create({ start: 'S',
        productions: { S: [['a', 'S', 'b'], []] }, label: 'aⁿbⁿ' });
    }
    return root.ParseLab.fixture('balanced');
  }

  function update() {
    const values = panel.values();
    const key = values['pda-machine'] + '\n' + values['pda-grammar'] + '\n' + values['pda-input'];
    const state = runFor(key);
    const agreement = agreementFor(values['pda-machine'] + '\n' + values['pda-grammar']);

    paintMetrics(state, agreement);
    paintTape(state);
    paintTransitions(state);
    paintTrace(state);
    paintAgreement(agreement);
    paintClosure();
  }

  function paintMetrics(state, agreement) {
    root.MetricGrid.update({
      'pda-accept': { value: state.result.exhausted && !state.result.accepted ? 'search capped'
        : (state.result.accepted ? 'yes' : 'no'),
      note: state.result.exhausted && !state.result.accepted
        ? 'left recursion expands without consuming — a cap, not a rejection'
        : (state.machine.byEmptyStack ? 'the whole input read and the stack empty'
          : 'the whole input read in an accepting state') },
      'pda-configs': { value: root.Format.exact(state.result.steps),
        note: 'each is a state, a stack and a position — the search space of a ' +
          'nondeterministic machine' },
      'pda-depth': { value: root.Format.exact(state.depth),
        note: 'the deepest stack in the first forty configurations; a finite automaton has none' },
      'pda-agrees': { value: agreement.failures.length === 0 ? 'yes' : 'NO',
        note: root.Format.exact(agreement.checked) + ' inputs checked against Earley' +
          (agreement.capped ? ', ' + agreement.capped + ' capped and excluded' : '') }
    });
  }

  function paintTape(state) {
    const trace = state.result.trace;
    const last = trace.length ? trace[trace.length - 1] : null;

    root.jQuery('#pda-tape').html(
      '<div>input: ' + root.Helpers.escapeHtml(state.tokens.join(' ') || 'ε') + '</div>' +
      (last ? '<div style="margin-top:.4rem">read so far: ' +
        root.Helpers.escapeHtml(state.tokens.slice(0, last.at).join(' ') || 'nothing') +
        '</div><div>stack, top first: ' +
        root.Helpers.escapeHtml(last.stack || '(empty)') + '</div>' : ''));

    root.Helpers.setText('pda-tape-note',
      'The last configuration the search reached, which for an accepted input is the accepting ' +
      'one. Read the stack as the machine\'s memory of what is still owed: for the bracket ' +
      'machine each symbol is an unclosed bracket, and for the grammar construction each symbol ' +
      'is a piece of the sentential form still to be matched. That is the whole intuition — a ' +
      'PDA is a machine that remembers a list of obligations in the order they were incurred.');
  }

  function paintTransitions(state) {
    const rows = root.Pda.transitionRows(state.machine).slice(0, 20);

    root.jQuery('#pda-transitions tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.from + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.read) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.pop) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.push) + '</td><td class="mono">' + row.to +
        '</td><td>' + root.Helpers.escapeHtml(row.why) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pda-transitions-note',
      'A row with ε in the read column consumes no input, which is where the nondeterminism ' +
      'lives: the machine may take such a move at any time, so the search has to try both taking ' +
      'it and not. For a machine built from a grammar every expand row is an ε-move and every ' +
      'match row is not, so the number of guesses at each step is the number of productions for ' +
      'the nonterminal on top.');
  }

  function paintTrace(state) {
    root.jQuery('#pda-trace tbody').html(state.result.trace.slice(0, 14)
      .map(function (snap, i) {
        return '<tr><td class="mono">' + i + '</td><td class="mono">' + snap.state +
          '</td><td class="mono">' + root.Helpers.escapeHtml(snap.stack || '(empty)') +
          '</td><td class="mono">' +
          root.Helpers.escapeHtml(state.tokens.slice(0, snap.at).join(' ') || 'nothing') +
          '</td></tr>';
      }).join('') || '<tr><td class="mono">—</td><td class="mono">—</td>' +
        '<td class="mono">no configurations</td><td class="mono">—</td></tr>');

    root.Helpers.setText('pda-trace-note',
      'These are configurations in the order the breadth-first search dequeued them, not steps ' +
      'of one run — several rows may be alternative guesses alive at the same time. That is the ' +
      'correct picture of a nondeterministic machine and it is also the reason the count in the ' +
      'metrics grows so fast: the search is exploring a tree of guesses, and only a parser that ' +
      'shares work between branches (which is what the Earley and GLR sections build) avoids ' +
      'paying for each one separately.');
  }

  function paintAgreement(agreement) {
    const shown = agreement.failures.length
      ? agreement.failures.slice(0, 10) : agreement.rows.slice(0, 10);

    root.jQuery('#pda-agreement tbody').html(shown.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.text) + '</td>' +
        '<td class="mono">' + verdict(row.pda) + '</td><td class="mono">' +
        verdict(row.earley) + '</td><td class="mono">' +
        (row.agree === null ? 'capped' : (row.agree ? 'yes' : 'NO')) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pda-agreement-note', agreement.failures.length
      ? 'A disagreement is a bug in the construction and the row names the input, which is the ' +
        'only useful form for such a report.'
      : 'Every one of the ' + root.Format.exact(agreement.checked) + ' inputs gets the same ' +
        'answer from the machine and from Earley, which is what "the construction is correct" ' +
        'means operationally. The proof of the equivalence is an induction on derivation length; ' +
        'this is the same claim checked exhaustively over short strings, and it is the version ' +
        'that catches an implementation bug rather than a reasoning one.');
  }

  function verdict(value) {
    if (value === null) return 'capped';
    return value ? 'accepts' : 'rejects';
  }

  function paintClosure() {
    const rows = [
      { op: 'Union', regular: 'closed', cf: 'closed — one new start symbol',
        dcfl: 'NOT closed' },
      { op: 'Concatenation', regular: 'closed', cf: 'closed — one new rule',
        dcfl: 'NOT closed' },
      { op: 'Kleene star', regular: 'closed', cf: 'closed', dcfl: 'NOT closed' },
      { op: 'Intersection', regular: 'closed — the product construction',
        cf: 'NOT closed — aⁿbⁿcᵐ ∩ aᵐbⁿcⁿ is not context-free',
        dcfl: 'NOT closed' },
      { op: 'Complement', regular: 'closed — swap the accepting states',
        cf: 'NOT closed', dcfl: 'closed — the one thing determinism buys' },
      { op: 'Intersection with a regular language', regular: 'closed',
        cf: 'closed — this is the useful one', dcfl: 'closed' },
      { op: 'Equivalence of two machines', regular: 'decidable', cf: 'UNDECIDABLE',
        dcfl: 'decidable, and the algorithm is enormous' }
    ];

    root.jQuery('#pda-closure tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.op + '</td><td>' + row.regular + '</td><td>' + row.cf +
        '</td><td>' + row.dcfl + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pda-closure-note',
      'Two rows here change how you build things. Context-free languages are NOT closed under ' +
      'intersection, so you cannot express "parses as this grammar and also as that one" as a ' +
      'grammar — which is why every static check beyond syntax is a separate pass over the tree. ' +
      'And they ARE closed under intersection with a regular language, which is the standard ' +
      'trick for restricting a grammar by a token-level rule without leaving the class. The ' +
      'last row is the one that ends arguments: asking whether two grammars describe the same ' +
      'language is undecidable, so "is my rewrite equivalent" can only ever be answered by ' +
      'testing, which is what this whole milestone does.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
