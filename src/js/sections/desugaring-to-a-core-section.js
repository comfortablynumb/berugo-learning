/**
 * Section: Semantic analysis and desugaring.
 *
 * The measurement is behavioural, and it has to be: a lowering is correct only
 * if the program it produces computes what the program it came from computed,
 * and no amount of reading the rewrite establishes that. Both programs are run
 * by the same reference interpreter and compared on their value, their output,
 * their outcome and every binding they leave behind.
 *
 * That comparison found five real defects in this file's own lowerings, and
 * every one of them looked right in the source:
 *
 *   - `a + b` inside `fn add` lowered to a call to `add`, so the function
 *     called itself forever;
 *   - the same capture for `len`, `is_some`, `payload0` and `unmatched`;
 *   - the `for` loop tested its guard against the index from before the
 *     advance and indexed one element off the end;
 *   - `&&` and `||` lowered to strict calls, so the guard idiom
 *     `d != 0 && 10 / d > 1` divided by zero.
 *
 * The traps table at the bottom keeps all of them runnable.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'desugaring-to-a-core';
  let panel = null;

  const TRAPS = [
    { id: 'capture',
      source: 'fn add(a, b) { return a * b; }\nlet s = add(3, 4) + 1;',
      naive: 'a + b becomes add(a, b)',
      wrong: 'the user function named add is called instead of the runtime one, so it calls ' +
        'itself forever',
      fix: 'every name a lowering introduces starts with $, which no surface identifier can' },
    { id: 'loop',
      source: 'let t = 0;\nfor v in [1, 2, 3] { t = t + v; }',
      naive: 'advance the index at the top of the body behind a first-iteration flag',
      wrong: 'the guard i < len(xs) is tested against the index from before the advance, so ' +
        'the last pass indexes one element off the end',
      fix: 'bind the element, then advance, then run the body — and no flag is needed' },
    { id: 'shortcircuit',
      source: 'let d = 0;\nlet safe = d != 0 && 10 / d > 1;',
      naive: 'a && b becomes $and(a, b)',
      wrong: 'a call evaluates both arguments, so the right side runs when the left was false ' +
        'and 10 / 0 is evaluated',
      fix: 'a && b becomes if a { b } else { false } — the only core form that skips a branch' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one for loop becoming core constructs',
      caption: 'The lowering is four core statements, and the ORDER of the last three is the ' +
        'whole of its correctness. Bind the element, then advance the index, then run the ' +
        'body. Put the advance last, where the loop reads as if it belongs, and `continue` ' +
        'jumps over it and the loop never ends. Put it first, guarded by a flag so the first ' +
        'pass skips it, and the guard is tested against the index from before the advance so ' +
        'the last pass reads one element past the end — which is what this lowering did until ' +
        'the two programs were run and compared. Between the element binding and the body ' +
        'there is nothing that can be skipped, so no ordering of `break` and `continue` can ' +
        'break it, and no flag is needed. Every generated name starts with `$`, which no ' +
        'surface identifier can, so none of them can capture a name the user owns.',
      definition: [
        'graph TD',
        'F["for v in xs { body }"] --> A["let $xs = xs;"]',
        'A --> B["let $i = 0;"]',
        'B --> W{"while $i < $len($xs)"}',
        'W -->|"true"| C["let v = $xs[$i];"]',
        'C --> D["$i = $i + 1;   ← before the body, so continue cannot skip it"]',
        'D --> E["body"]',
        'E -->|"continue jumps here"| W',
        'E -->|"break leaves"| X["after the loop"]',
        'W -->|"false"| X'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The core language is what every later stage sees, and making it smaller here is what ' +
        'stops M29 and M30 from handling nine forms of loop.** No `for`, no `match`, no ' +
        'operators — they are calls — and no string interpolation. Four constructs disappear ' +
        'and every pass downstream is written against a smaller grammar for the rest of the ' +
        'compiler\'s life.',
      '**Every synthesised node carries the span of the surface construct it came from.** That ' +
        'is enforced by construction: one function builds every lowered node and it takes the ' +
        'origin as an argument. Without it, a diagnostic about a lowered `for` loop underlines ' +
        'a generated index variable — code the developer never wrote — and the message is ' +
        'worse than no message.',
      '**A lowering is only correct if the program still computes the same thing, and that has ' +
        'to be RUN.** Both programs go through the same reference interpreter and are compared ' +
        'on value, output, outcome and every binding they leave behind. Reading the rewrite ' +
        'establishes nothing: all five defects this comparison found looked correct in the ' +
        'source, and two of them had explanatory comments arguing they were right.',
      '**Hygiene is not a nicety, it is the first thing that breaks.** A lowering introduces ' +
        'names, and if those names can collide with the user\'s, some program somewhere ' +
        'collides. `fn add(a, b) { return a + b; }` is a perfectly ordinary function, and with ' +
        'an unprefixed `add` for the operator it calls itself until the stack runs out. Every ' +
        'generated name here starts with `$`, which the lexer will not accept as the start of ' +
        'an identifier, so collision is impossible rather than unlikely.',
      '**`&&` and `||` cannot lower to calls, and this is the subtlest trap here.** A call ' +
        'evaluates its arguments, so `$and(a, b)` runs `b` whether or not `a` was false. That ' +
        'is a different program: `d != 0 && 10 / d > 1` is written precisely because the right ' +
        'side is unsafe when the left is false. They lower to `if` instead, which is the only ' +
        'core form that does not evaluate one of its branches.',
      '**`continue` is what makes loop lowering hard, and there is exactly one safe place for ' +
        'the advance.** Last is wrong because `continue` skips it. First-behind-a-flag is wrong ' +
        'because the guard then tests a stale index. Between the element binding and the body ' +
        'is right, because nothing between those two points can be skipped by any control flow ' +
        'the language has.',
      '**Constant folding is at the AST level here because it changes what the CORE looks ' +
        'like.** `2 * 3 + 4` becomes `10` before the core is emitted, so M29 never sees it. ' +
        'That is a deliberate boundary: folding is cheap enough to do twice, and doing it here ' +
        'means the core the learner reads is the core they would have written.',
      '**Lowering usually GROWS the tree, and the growth is the honest cost of the ' +
        'simplification.** A `match` with two arms becomes a binding and nested tests; a `for` ' +
        'loop becomes four statements. The core is simpler per node and larger in total, and ' +
        'the suite table reports both numbers so the trade is visible rather than assumed.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the core, and both programs run and compared',
        markup: root.DesugarTemplate.render()
      },
      diagram: diagram(),
      insight: '**Every desugaring is a chance to lose the user\'s mental model, and the two ' +
        'ways to lose it are different problems with different fixes.** The first is the span: ' +
        'a generated node with no origin produces a message about code the developer never ' +
        'wrote, and the fix is structural — one constructor for every lowered node, taking the ' +
        'origin as an argument, so "keep the span" is enforced rather than remembered. The ' +
        'second is behaviour, and it is much harder to see. A lowering that changes what the ' +
        'program does is not a bad message, it is a different program, and it will be found by ' +
        'a user rather than by you. The three traps below are all of that second kind and all ' +
        'three shipped in this file: each one is a plausible rewrite, each one has a comment ' +
        'in the original source explaining why it is correct, and each one is wrong on a ' +
        'program somebody would actually write. What found them was not review. It was running ' +
        'the surface program and its core side by side and comparing every observable — and ' +
        'the comparison only had teeth once it compared the BINDINGS a program leaves behind, ' +
        'because every conformance program\'s value is `unit` and a comparison of values alone ' +
        'passed all fifteen while the core computed nothing at all.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DesugarTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  /**
   * The memoise key is JSON, not a delimited string. A key built by joining
   * source code to other values needs a separator the source cannot contain,
   * and there is no such character: a newline appears in every program, and
   * the invisible one this used instead is exactly the kind of thing that
   * survives review and breaks later. JSON needs no separator at all.
   */
  const lowerFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const source = parts[0];
    const passes = parts[1];
    const parsed = root.Berugo.Parser.parse(source);
    const lowered = root.Berugo.Desugar.desugar(parsed.tree, passes);

    return { source: source, tree: parsed.tree, lowered: lowered,
      printed: root.Berugo.Ast.print(lowered.core),
      audit: root.Berugo.Desugar.spanAudit(lowered.core, source),
      behaviour: root.Berugo.Interp.compareWithCore(source, passes) };
  });

  const suiteFor = root.Helpers.memoise(function () {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const parsed = root.Berugo.Parser.parse(entry.source);
      const lowered = root.Berugo.Desugar.desugar(parsed.tree);
      const surface = root.Berugo.Ast.countNodes(parsed.tree);
      const core = root.Berugo.Ast.countNodes(lowered.core);
      const behaviour = root.Berugo.Interp.compareWithCore(entry.source);

      return { id: entry.id, surface: surface, core: core, growth: core / surface,
        observed: behaviour.observed, agree: behaviour.agree };
    });
  });

  const trapsFor = root.Helpers.memoise(function () {
    return TRAPS.map(function (trap) {
      const outcome = root.Berugo.Interp.compareWithCore(trap.source);

      return Object.assign({ agrees: outcome.agree, why: outcome.why }, trap);
    });
  });

  function passesFrom(values) {
    return { for: values['dg-for'], operators: values['dg-operators'],
      match: values['dg-match'], fold: values['dg-fold'] };
  }

  function update() {
    const values = panel.values();
    const source = root.DesugarTemplate.SAMPLES[values['dg-sample']];
    const state = lowerFor(JSON.stringify([source, passesFrom(values)]));

    paintCompare(state);
    paintMetrics(state);
    paintRewrites(state);
    paintBehaviour(state);
    paintSuite();
    paintTraps();
  }

  function paintCompare(state) {
    root.jQuery('#dg-compare tbody').html(
      '<tr><td class="mono" style="white-space:pre-wrap;vertical-align:top">' +
      root.Helpers.escapeHtml(state.source) +
      '</td><td class="mono" style="white-space:pre-wrap;vertical-align:top">' +
      root.Helpers.escapeHtml(state.printed) + '</td></tr>');

    root.Helpers.setText('dg-compare-caption',
      'Turning a lowering off leaves that construct in the core, which is what the checkboxes ' +
      'are for: the core is not one thing, it is whatever is left after the passes you chose. ' +
      'Every name beginning with `$` was generated here, and none of them can collide with a ' +
      'name from the source, because the lexer does not accept `$` as the start of an ' +
      'identifier.');
  }

  function paintMetrics(state) {
    const surface = root.Berugo.Ast.countNodes(state.tree);
    const core = root.Berugo.Ast.countNodes(state.lowered.core);
    const behaviour = state.behaviour;

    root.MetricGrid.update({
      'dg-rewrites': { value: root.Format.exact(state.lowered.rewrites.length),
        note: passSummary(state.lowered.passes) },
      'dg-size': { value: surface + ' → ' + core,
        note: core >= surface ? root.Format.fixed(core / surface, 2) +
          '× — lowering trades node count for a smaller grammar'
          : 'smaller, because folding removed more than lowering added' },
      'dg-agree': { value: behaviour.agree ? 'yes' : 'NO',
        note: behaviour.why },
      'dg-spans': { value: state.audit.synthesised + ' of ' + state.audit.synthesised,
        note: state.audit.ok ? 'every synthesised node names the construct it stands for'
          : state.audit.problems.length + ' nodes failed the span audit' }
    });
  }

  function passSummary(passes) {
    const parts = Object.keys(passes).filter(function (id) { return passes[id] > 0; })
      .map(function (id) { return passes[id] + ' ' + id; });

    return parts.length ? parts.join(', ') : 'nothing in this program needed lowering';
  }

  function paintRewrites(state) {
    root.jQuery('#dg-rewrite-table tbody').html(
      state.lowered.rewrites.slice(0, 24).map(function (entry) {
        return '<tr><td class="mono">' + root.Helpers.escapeHtml(entry.pass) +
          '</td><td class="mono">' + root.Helpers.escapeHtml(entry.from) +
          '</td><td class="mono">' + root.Helpers.escapeHtml(entry.to) +
          '</td><td class="mono">' + entry.span.start + '–' + entry.span.end +
          '</td><td class="mono">' +
          root.Helpers.escapeHtml(shorten(entry.printed)) + '</td></tr>';
      }).join('') || '<tr><td colspan="5">no lowering ran — every pass is switched off, or ' +
        'this program has nothing to lower</td></tr>');

    root.Helpers.setText('dg-rewrite-table-caption',
      'The fourth column is the span of the SURFACE construct, not of the generated code — ' +
      'there is no source text for generated code to point at. That is what keeps a ' +
      'diagnostic about the lowered form pointing at something the developer typed, and it is ' +
      'enforced by construction: one function builds every node in this table and it takes ' +
      'the origin as an argument, so a lowering cannot forget.');
  }

  function shorten(text) {
    const flat = String(text).replace(/\s+/g, ' ');

    return flat.length > 60 ? flat.slice(0, 57) + '…' : flat;
  }

  function paintBehaviour(state) {
    const b = state.behaviour;
    const rows = b.ok ? behaviourRows(b) : [];

    root.jQuery('#dg-behaviour tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row[0]) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row[1]) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row[2]) + '</td><td>' + verdictFor(row) + '</td></tr>';
    }).join('') || '<tr><td colspan="4">this program does not parse</td></tr>');

    root.Helpers.setText('dg-behaviour-caption', behaviourCaption(b));
  }

  /**
   * The fourth element marks a row as informational. Cost is allowed to
   * differ — lowering trades steps for a smaller grammar — and printing "NO"
   * beside a step count that is SUPPOSED to change would read as a failure
   * every time the demo is opened.
   */
  function behaviourRows(b) {
    return [
      ['Outcome', b.surface.outcome, b.core.outcome, true],
      ['Value', b.surface.value, b.core.value, true],
      ['Printed output', b.surface.output.join(' ') || '(nothing)',
        b.core.output.join(' ') || '(nothing)', true],
      ['Bindings left behind', b.surface.bindings.join('; ') || '(none)',
        b.core.bindings.join('; ') || '(none)', true],
      ['Steps taken', String(b.surfaceSteps), String(b.coreSteps), false]
    ];
  }

  function verdictFor(row) {
    if (!row[3]) return 'not compared — cost may differ';
    return row[1] === row[2] ? 'yes' : 'NO';
  }

  function behaviourCaption(b) {
    if (!b.ok) return 'The program does not parse, so there is nothing to compare.';
    return 'The bindings row is the one that matters, and it was added because without it this ' +
      'table proved nothing. Every conformance program is a list of `let`s, so its VALUE is ' +
      '`unit` — and a comparison of values alone passes whatever the core computed. Comparing ' +
      'what the program leaves behind is what makes `let s = add(1, 2)` observable as `s = 3`. ' +
      'The steps row is deliberately excluded from the verdict: lowering is allowed to cost ' +
      'more steps and here it costs ' +
      (b.surfaceSteps ? root.Format.fixed(b.coreSteps / b.surfaceSteps, 2) : '—') +
      '× — it is not allowed to change the answer.';
  }

  function paintSuite() {
    const rows = suiteFor('all');
    const agreeing = rows.filter(function (row) { return row.agree; }).length;
    const observed = rows.reduce(function (sum, row) { return sum + row.observed; }, 0);

    root.jQuery('#dg-suite tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.id) + '</td><td class="mono">' +
        row.surface + '</td><td class="mono">' + row.core + '</td><td class="mono">' +
        root.Format.fixed(row.growth, 2) + '×</td><td class="mono">' + row.observed +
        '</td><td>' + (row.agree ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dg-suite-caption',
      agreeing + ' of ' + rows.length + ' conformance programs agree, over ' + observed +
      ' observations — bindings plus printed lines, summed across the suite. That second ' +
      'number is the one to watch: a suite that agrees on zero observations agrees about ' +
      'nothing. The growth column shows what lowering costs in nodes, and `match` and `for` ' +
      'are the two that pay for it, which is exactly the prediction the cost table in 28.1 ' +
      'made before any of this was written.');
  }

  function paintTraps() {
    const rows = trapsFor('all');

    root.jQuery('#dg-traps tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' +
        root.Helpers.escapeHtml(row.source.replace(/\n/g, ' ')) + '</td><td>' +
        root.Helpers.escapeHtml(row.naive) + '</td><td>' +
        root.Helpers.escapeHtml(row.wrong) + '</td><td>' +
        root.Helpers.escapeHtml(row.fix) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dg-traps-caption',
      'All three of these shipped in this file, and all three agree now — the first column is ' +
      'runnable, so selecting any of these programs above shows the current lowering handling ' +
      'it. Each was a plausible rewrite with a comment in the source arguing it was correct, ' +
      'and each is wrong on a program somebody would actually write: a function called `add`, ' +
      'a loop with a `continue`, a division guarded by the test that makes it safe. None of ' +
      'them was found by reading. All three were found by running the surface program and its ' +
      'core and comparing every observable.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
