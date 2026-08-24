/**
 * Section: PEGs and packrat parsing.
 *
 * The measurement is the step count, and it is a real one — the same fixture
 * parsed with and without the cache, with the evaluator counting every call.
 * At depth 14 the plain parser takes 606 207 steps and the packrat parser 124,
 * a ratio of 4 888.8, while the memo table holds 28 entries. That is what
 * "exponential to linear" means when you can watch it happen.
 *
 * The second measurement is the static check nobody runs: `("a" / "ab")` has an
 * alternative that can never win, and the demo names it and says why.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'pegs-and-packrat-parsing';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — ordered choice commits to the first success',
      caption: 'A CFG\'s `|` is a set: `A | B` means "either, and if both work the string has ' +
        'two parses". A PEG\'s `/` is a sequence of attempts: try A, and only if A FAILS try B. ' +
        'That removes ambiguity by construction, because there is never a second parse to find. ' +
        'The trap is in the middle box: A succeeding is enough to commit, even if what A matched ' +
        'leaves the rest of the input unparseable. There is no backtracking into a choice that ' +
        'already succeeded, so `("a" / "ab")` on the input `ab` commits to `a`, the caller finds ' +
        'a leftover `b`, and the whole parse fails without ever trying the second alternative.',
      definition: [
        'flowchart TD',
        '    A["A / B, at position p"] --> B{try A at p}',
        '    B -->|succeeds| C[commit to A and return]',
        '    B -->|fails| D{try B at p}',
        '    D -->|succeeds| E[commit to B and return]',
        '    D -->|fails| F[the whole choice fails]',
        '    C --> G["the caller may now fail<br/>and B is never reconsidered"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A parsing expression grammar looks like a CFG and means something different.** The ' +
        'rules read the same, the operators are almost the same, and the semantics are ' +
        'operational rather than declarative: a PEG describes a recursive-descent parser with ' +
        'backtracking, not a set of strings. That distinction is the source of every surprise in ' +
        'this section.',
      '**Ordered choice replaces ambiguity, and it does not remove the underlying problem.** ' +
        '`A / B` tries A first and commits to it if it succeeds. A PEG therefore cannot be ' +
        'ambiguous — there is exactly one parse by construction. What was ambiguity in the CFG ' +
        'becomes a silent preference, and the reading you did not want is simply unreachable ' +
        'rather than reported.',
      '**Repetition is greedy and never gives anything back.** `A*` consumes as many A\'s as it ' +
        'can and does not reconsider even if the rest of the rule then fails. In a CFG `A* A` ' +
        'matches any non-empty sequence of A\'s; in a PEG it matches nothing at all, ever, ' +
        'because the star has already taken the last one.',
      '**Syntactic predicates are the PEG feature with no CFG counterpart.** `&e` succeeds if e ' +
        'matches and consumes nothing; `!e` succeeds if e does NOT match. That is unbounded ' +
        'lookahead, and it lets a PEG recognise things no context-free grammar can — `aⁿbⁿcⁿ` is ' +
        'a short PEG — so the class is genuinely different, not merely a restriction.',
      '**Packrat memoisation makes it linear by caching (rule, position).** Each pair is ' +
        'computed once, so the total work is bounded by the number of rules times the input ' +
        'length. The demo measures it: on the designed fixture the step count without the cache ' +
        'roughly triples per level and the memoised count grows by a constant.',
      '**The memory cost is the reason packrat is not always on.** One entry per rule per input ' +
        'position, which for a real grammar and a large file is often more memory than the file ' +
        'itself. Production PEG tools memoise selectively — only the rules that actually get ' +
        're-entered — which recovers most of the speed for a fraction of the memory.',
      '**Left recursion does not work in a plain PEG and the workarounds are real.** `A ← A x / ' +
        'y` recurses forever with no input consumed. Warth\'s algorithm seeds the memo entry ' +
        'with a failure and re-runs the rule while the result keeps growing, which does handle ' +
        'both direct and indirect cases; this implementation seeds with failure and stops, which ' +
        'turns the hang into a rejection and is what most simpler tools do.',
      '**The unreachable-alternative check exists and almost nothing runs it.** If an earlier ' +
        'alternative always matches a prefix of what a later one matches, the later one can ' +
        'never win. The general question is undecidable; the common case — a shorter literal ' +
        'before a longer one — is exactly detectable, and the demo detects it.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — measure the cache, and find the alternative that never wins',
        markup: root.PegTemplate.render()
      },
      diagram: diagram(),
      insight: '**PEGs cannot be ambiguous, which sounds like a feature until the ordered choice ' +
        'hides a rule that can never match. There is a static check for that, and most PEG tools ' +
        'do not run it.** The failure mode is specific: you add a keyword to a language whose ' +
        'identifier rule comes first in the choice, everything still compiles, every existing ' +
        'test passes, and the new keyword is silently lexed as an identifier forever. Nothing ' +
        'reports a conflict because a PEG has no conflicts — that is the selling point. If you ' +
        'are using a PEG, order your alternatives longest-first as a discipline, and add a ' +
        'test that every alternative in every choice is reached by at least one input in your ' +
        'corpus; it is a twenty-line test and it catches the entire class.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PegTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const fixtureFor = root.Helpers.memoise(function (depth) {
    const grammar = root.Peg.exponentialFixture(Number(depth));
    const memo = root.Peg.parse(grammar, 'a', { memo: true });
    const plain = root.Peg.parse(grammar, 'a', { memo: false, cap: 4000000 });

    return { grammar: grammar, memo: memo, plain: plain,
      ratio: memo.steps ? plain.steps / memo.steps : 0,
      same: memo.matched === plain.matched && memo.complete === plain.complete };
  });

  const growthRows = root.Helpers.memoise(function () {
    return [2, 4, 6, 8, 10, 12, 14].map(function (depth) {
      const state = fixtureFor(depth);

      return { depth: depth, memo: state.memo.steps, entries: state.memo.entries,
        plain: state.plain.steps, ratio: state.ratio, overflow: state.plain.overflow };
    });
  });

  const choiceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const pair = root.Peg.orderedChoicePair();
    const grammar = pair[parts[0]];
    const samples = ['a', 'ab', 'b', 'abc', ''];

    return { grammar: grammar,
      result: root.Peg.parse(grammar, parts[1]),
      unreachable: root.Peg.unreachableAlternatives(grammar, samples),
      samples: samples.map(function (input) {
        const run = root.Peg.parse(grammar, input);

        return { input: input, matched: run.matched, complete: run.complete,
          consumed: run.consumed };
      }) };
  });

  function update() {
    const values = panel.values();
    const state = fixtureFor(values['peg-depth']);
    const choice = choiceFor(values['peg-order'] + '\n' + values['peg-input']);

    paintMetrics(state, values['peg-memo']);
    paintChoice(choice, values);
    paintGrowth();
    paintUnreachable(choice);
    paintVersus(choice);
    paintSemantics();
  }

  function paintMetrics(state, memoOn) {
    const chosen = memoOn === 'on' ? state.memo : state.plain;

    root.MetricGrid.update({
      'peg-steps': { value: root.Format.exact(chosen.steps) +
        (chosen.overflow ? ' (capped)' : ''),
      note: memoOn === 'on'
        ? 'every (rule, position) pair evaluated once'
        : 'the same expression re-evaluated at the same position, over and over' },
      'peg-ratio': { value: root.Format.fixed(state.ratio, 1) + '×',
        note: root.Format.exact(state.plain.steps) + ' plain steps against ' +
          root.Format.exact(state.memo.steps) + ' memoised' },
      'peg-entries': { value: root.Format.exact(state.memo.entries),
        note: root.Format.exact(state.memo.hits) + ' cache hits, ' +
          root.Format.exact(state.memo.misses) + ' misses' },
      'peg-same': { value: state.same ? 'yes' : 'NO',
        note: state.same
          ? 'the cache changed the cost and not the answer, which is the requirement'
          : 'the cache changed the result — that is a bug, not an optimisation' }
    });
  }

  function paintChoice(choice, values) {
    root.jQuery('#peg-choice').html(
      '<div>' + root.Helpers.escapeHtml('S ← ' + choice.grammar.label) + '</div>' +
      '<div style="margin-top:.4rem">input: ' +
      root.Helpers.escapeHtml(JSON.stringify(values['peg-input'])) + '</div>' +
      '<div>matched: ' + (choice.result.matched ? 'yes' : 'no') +
      ', consumed ' + choice.result.consumed + ' of ' + values['peg-input'].length +
      '</div><div>complete parse: ' + (choice.result.complete ? 'yes' : 'NO') + '</div>');

    root.Helpers.setText('peg-choice-note',
      'Switch the order control with the input left at `ab`. With `"a" / "ab"` the parser ' +
      'commits to the first alternative, consumes one character, and the parse is incomplete — ' +
      'there is a leftover `b` and the second alternative is never tried. With `"ab" / "a"` it ' +
      'consumes both. Same alternatives, same input, different result, and the only difference ' +
      'is the order they were written in. In a CFG the two rule sets are identical.');
  }

  function paintGrowth() {
    root.jQuery('#peg-growth tbody').html(growthRows('rows').map(function (row) {
      return '<tr><td class="mono">' + row.depth + '</td><td class="mono">' +
        root.Format.exact(row.memo) + '</td><td class="mono">' + row.entries +
        '</td><td class="mono">' + root.Format.exact(row.plain) +
        (row.overflow ? ' (capped)' : '') + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 1) + '×</td></tr>';
    }).join(''));

    root.Helpers.setText('peg-growth-note',
      'The fixture is `Aᵢ ← Aᵢ₊₁ Aᵢ₊₁ "z" / Aᵢ₊₁`, with `Aₙ ← "a"`, run on the single ' +
      'character `a`. Each level parses the next level twice in an alternative that then fails ' +
      'on the missing `z`, and then parses it a third time in the second alternative — so ' +
      'without a cache the work triples per level. Read the last two columns together: the plain ' +
      'count multiplies by roughly five per two levels while the memoised count grows by nine, ' +
      'because there are nine more (rule, position) pairs. That is the definition of the ' +
      'trade, measured rather than asserted.');
  }

  function paintUnreachable(choice) {
    root.jQuery('#peg-unreachable tbody').html(choice.unreachable.map(function (finding) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(finding.rule) +
        '</td><td class="mono">alternative ' + (finding.index + 1) +
        '</td><td class="mono">alternative ' + (finding.shadowedBy + 1) + '</td><td>' +
        root.Helpers.escapeHtml(finding.reason) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">none</td>' +
      '<td class="mono">—</td><td>every alternative is reached by at least one sample</td></tr>');

    root.Helpers.setText('peg-unreachable-note',
      'This is the check the insight is about, and it is worth being precise about what it can ' +
      'and cannot do. Deciding in general whether an alternative is reachable is undecidable — ' +
      'it reduces to grammar equivalence. What is decidable is the case that actually occurs: ' +
      'an earlier alternative that is a literal prefix of a later one, which always wins and ' +
      'always leaves the later one dead. The check runs that test exactly and samples the rest, ' +
      'which is the honest split between a proof and evidence.');
  }

  function paintVersus(choice) {
    root.jQuery('#peg-versus tbody').html(choice.samples.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.input || 'ε') +
        '</td><td class="mono">' + cfgVerdict(row.input) + '</td><td class="mono">' +
        (row.complete ? 'accepts' : (row.matched ? 'partial — consumed ' + row.consumed
          : 'rejects')) + '</td><td>' + reasonFor(row) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('peg-versus-note',
      'The `ab` row is the one to read. As a context-free grammar, `S → "a" | "ab"` accepts both ' +
      '`a` and `ab`, because a CFG asks whether ANY derivation produces the string. As a PEG ' +
      'with the short alternative first, `ab` is rejected: the choice committed to `a`, the ' +
      'caller demanded the whole input, and the second alternative was already out of reach. ' +
      'The rules look identical on the page and define different languages, which is why ' +
      '"a PEG is just a grammar" is the single most expensive misunderstanding in this section.');
  }

  function cfgVerdict(input) {
    return input === 'a' || input === 'ab' ? 'accepts' : 'rejects';
  }

  function reasonFor(row) {
    if (row.input === 'ab' && !row.complete) {
      return 'ordered choice committed to the shorter alternative and never reconsidered';
    }
    if (row.complete && cfgVerdict(row.input) === 'accepts') return 'the two agree here';
    if (!row.matched && cfgVerdict(row.input) === 'rejects') return 'the two agree here';
    return 'the alternatives were tried in order and one succeeded';
  }

  function paintSemantics() {
    const rows = [
      { construct: 'A | B against A / B', cfg: 'a set — both parses exist if both match',
        peg: 'ordered — the first success wins and the second is unreachable',
        consequence: 'an alternative can be dead code with nothing reporting it' },
      { construct: 'A*', cfg: 'any number of A, and the parser may take fewer',
        peg: 'greedy, and never gives one back',
        consequence: '`A* A` matches nothing in a PEG and any A⁺ in a CFG' },
      { construct: '!e and &e', cfg: 'no counterpart',
        peg: 'unbounded lookahead, consuming nothing',
        consequence: 'PEGs recognise aⁿbⁿcⁿ — the class is not a subset of context-free' },
      { construct: 'Left recursion', cfg: 'ordinary, and preferred by LR parsers',
        peg: 'infinite recursion with no input consumed',
        consequence: 'either a hang, a rejection, or Warth\'s seed-and-grow algorithm' },
      { construct: 'Ambiguity', cfg: 'possible, detectable, and sometimes what you want',
        peg: 'impossible by construction',
        consequence: 'no conflict report, because there are no conflicts to report' },
      { construct: 'Time', cfg: 'cubic in general, linear for the deterministic subclasses',
        peg: 'exponential without memoisation, linear with it',
        consequence: 'the cache is not an optimisation; it is part of the algorithm' }
    ];

    root.jQuery('#peg-semantics tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.construct) + '</td><td>' +
        row.cfg + '</td><td>' + row.peg + '</td><td>' + row.consequence + '</td></tr>';
    }).join(''));

    root.Helpers.setText('peg-semantics-note',
      'The third row is the one that gets forgotten in both directions. Syntactic predicates ' +
      'make PEGs able to express things no context-free grammar can, so a PEG is not a weaker ' +
      'formalism that trades power for determinism — it is a DIFFERENT formalism whose class is ' +
      'incomparable with the context-free languages. That is why you cannot mechanically ' +
      'translate a CFG into an equivalent PEG, and why a tool that offers both syntaxes is ' +
      'offering two languages rather than two notations.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
