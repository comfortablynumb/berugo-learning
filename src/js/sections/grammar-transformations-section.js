/**
 * Section: grammar transformations.
 *
 * Every claim here is a differential test. "This transformation preserves the
 * language" is exactly the kind of statement that is easy to believe and easy
 * to get wrong — the ε-removal that forgets the start symbol may itself be
 * nullable, the left-recursion elimination that handles the direct case and
 * loops forever on the indirect one — so each step is run and then both
 * grammars are enumerated over every string up to a length and compared in both
 * directions.
 *
 * The second measurement is the one nobody quotes: the tree changed. The
 * language survives and the structure does not, which is why an AST builder
 * written against the old grammar produces silent nonsense against the new one.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'grammar-transformations';
  const ORDER = ['useless', 'epsilon', 'unit', 'left-recursion', 'left-factor', 'cnf'];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — direct left recursion becomes a tail nonterminal',
      caption: 'The rule `E → E + T | T` cannot be parsed top-down: a recursive-descent parser ' +
        'calls `E` first, which calls `E` first, forever, with no input consumed. The standard ' +
        'rewrite pulls the non-recursive alternative to the front and puts the repetition in a ' +
        'fresh tail nonterminal that either continues or stops. The language is identical — the ' +
        'demo checks that over every string up to length eight — and the tree is not: the left ' +
        'spine that made `+` left-associative has become a right-leaning chain, so an evaluator ' +
        'that folded left now folds right and `1 - 2 - 3` changes value.',
      definition: [
        'graph LR',
        '    A["E → E + T | T"] -->|eliminate| B["E → T E′"]',
        '    B --> C["E′ → + T E′ | ε"]',
        '    A --> D["tree: left spine"]',
        '    C --> E["tree: right spine"]',
        '    D -.->|associativity must be re-imposed| E'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A grammar transformation rewrites the rules and keeps the language.** That is the ' +
        'contract, and it is the only part most descriptions state. The part that bites is what ' +
        'it does NOT keep: the parse tree. Every transformation in this section changes the ' +
        'shape of the tree for at least some input, and everything downstream that read the old ' +
        'shape is now reading a different one.',
      '**Useless symbols come in two kinds and both are bugs.** A symbol that derives no ' +
        'terminal string can never appear in a parse; a symbol unreachable from the start can ' +
        'never be entered. Removing them changes nothing about the language, and finding them ' +
        'usually means finding a typo — a nonterminal you spelled two ways is unreachable under ' +
        'one spelling and non-productive under the other.',
      '**ε-removal is the transformation with the surprise.** For every nullable nonterminal you ' +
        'add copies of each rule that mentions it, with and without it, which is exponential in ' +
        'the number of nullable symbols in one right-hand side. The demo shows four nullable ' +
        'symbols turning three productions into six, and the start symbol keeps its own ε rule ' +
        'if the language contains the empty string — dropping that is the classic off-by-one ' +
        'language change.',
      '**Unit productions look harmless and cost you the chain.** `A → B` adds a level to every ' +
        'tree that passes through it and nothing to the language. Removing them means replacing ' +
        'each unit chain with the rules at its end, which multiplies the rule count and flattens ' +
        'the tree — and flattening the tree is exactly what removes the precedence levels a ' +
        'well-built expression grammar was using them for.',
      '**Left recursion is fatal to a top-down parser and free to a bottom-up one.** `E → E + T` ' +
        'makes recursive descent loop with no input consumed. LR parsers PREFER it, because a ' +
        'left-recursive rule keeps the stack shallow. So the same grammar shape is a bug in one ' +
        'parser family and best practice in the other, and there is no neutral way to write it.',
      '**Indirect left recursion needs Paull’s algorithm, not a special case.** `A → B x`, ' +
        '`B → A y` has no rule that begins with its own left-hand side and still loops. The ' +
        'algorithm substitutes earlier nonterminals into later ones in a fixed order until every ' +
        'cycle becomes direct, and then eliminates the direct case — which is why the ordering ' +
        'is part of the algorithm rather than an implementation detail.',
      '**Left factoring is what makes a grammar LL(1)-able.** Two alternatives sharing a prefix ' +
        'cannot be chosen between with one token of lookahead; factoring the prefix out into a ' +
        'shared head and a tail decision fixes exactly that. It is the transformation the LL(1) ' +
        'section depends on, and it is why hand-written recursive descent so often parses a ' +
        'common prefix and then decides.',
      '**Chomsky normal form is a means, not an end.** Every rule becomes `A → B C` or `A → a`, ' +
        'which is what CYK needs — and it costs you the readable rule names and multiplies the ' +
        'productions. The demo turns a six-rule expression grammar into thirty-three. Nobody ' +
        'writes a grammar in CNF; a tool converts to it, parses, and maps back.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — transform a grammar and check the language survived',
        markup: root.TransformTemplate.render()
      },
      diagram: diagram(),
      insight: '**Every transformation changes the parse tree, so anything that consumed the ' +
        'old shape — an AST builder, a pretty printer, a source-to-source rewriter — breaks ' +
        'silently. Transform, then re-derive the AST mapping deliberately.** The failure mode is ' +
        'specific and it is not a crash: the parser still accepts the same programs, the ' +
        'visitor still runs, and the tree it walks has different nesting. Left-recursion ' +
        'elimination turns a left spine into a right one, so a fold that was left-associative ' +
        'becomes right-associative and subtraction quietly changes meaning. The habit that ' +
        'catches it is to test the AST, not the parse: assert the built structure for a handful ' +
        'of inputs with known associativity, so a grammar change that alters the shape fails a ' +
        'test rather than shipping.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TransformTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const stateFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const before = root.ParseLab.fixture(parts[0]);
    const after = root.GrammarTransform.STEPS[parts[1]](before).grammar;
    const bound = Number(parts[2]);

    return {
      before: before, after: after, step: parts[1], bound: bound,
      check: root.Grammar.sameLanguage(before, after, bound),
      recursive: root.GrammarTransform.leftRecursive(before),
      stillRecursive: root.GrammarTransform.leftRecursive(after),
      shapes: shapeChange(before, after, bound)
    };
  });

  const pipelineFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.GrammarTransform.pipeline(root.ParseLab.fixture(parts[0]), ORDER,
      Number(parts[1]));
  });

  /** The first string whose tree shape differs between the two grammars — the
   *  measurement that "the language survived" deliberately cannot see. */
  function shapeChange(before, after, bound) {
    const inputs = root.ParseLab.exhaustive(before.terminals, Math.min(bound, 5));

    for (let i = 0; i < inputs.length; i += 1) {
      const left = firstShape(before, inputs[i]);
      const right = firstShape(after, inputs[i]);

      if (left === null || right === null) continue;
      if (left !== right) {
        return { tokens: inputs[i], text: inputs[i].join(' ') || 'ε', before: left,
          after: right };
      }
    }
    return null;
  }

  function firstShape(grammar, tokens) {
    const trees = root.Earley.trees(root.Earley.parse(grammar, tokens), 1);

    return trees.length ? root.Grammar.shape(trees[0]) : null;
  }

  function update() {
    const values = panel.values();
    const state = stateFor(values['gtr-grammar'] + '\n' + values['gtr-step'] + '\n' +
      values['gtr-length']);

    paintMetrics(state);
    paintRules(state);
    paintPipeline(values['gtr-grammar'] + '\n' + values['gtr-length']);
    paintTrees(state);
    paintCosts();
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'gtr-preserved': { value: state.check.same ? 'yes' : 'NO',
        note: state.check.same
          ? root.Format.exact(state.check.tested) + ' strings compared in both directions, up to '
            + 'length ' + state.bound
          : 'differs on ' + (state.check.missing.concat(state.check.extra)[0] || 'a string') },
      'gtr-rules': { value: root.Format.exact(state.before.productions.length) + ' → ' +
        root.Format.exact(state.after.productions.length),
      note: root.Format.exact(state.before.nonterminals.length) + ' → ' +
        root.Format.exact(state.after.nonterminals.length) + ' nonterminals' },
      'gtr-recursion': { value: (state.recursive.length ? state.recursive.join(', ') : 'none') +
        ' → ' + (state.stillRecursive.length ? state.stillRecursive.join(', ') : 'none'),
      note: state.stillRecursive.length
        ? 'before and after this step; these can still reach themselves as their own leftmost '
          + 'symbol, so recursive descent would still loop'
        : 'before and after this step; no nonterminal can now reach itself as its own leftmost '
          + 'symbol' },
      'gtr-shape': { value: state.shapes ? 'yes, at ' + state.shapes.text : 'not up to length 5',
        note: state.shapes
          ? 'same string, different nesting — an AST builder reading the old shape breaks here'
          : 'no input up to length 5 parses to a different shape under this step' }
    });
  }

  function paintRules(state) {
    root.jQuery('#gtr-rules-view').html(
      '<div style="opacity:.75">before</div>' +
      state.before.productions.map(showRule).join('<br>') +
      '<div style="margin-top:.5rem;opacity:.75">after ' +
      root.Helpers.escapeHtml(state.step) + '</div>' +
      state.after.productions.map(showRule).join('<br>'));

    root.Helpers.setText('gtr-view-note',
      'The two rule sets define the same language and are not the same grammar. Read the ' +
      'nonterminal names: anything with a prime or a numeric suffix was introduced by the ' +
      'transformation and has no counterpart in what you wrote, which is why an error message ' +
      'quoting a generated nonterminal is unreadable and why real tools keep a mapping back to ' +
      'the source rule.');
  }

  function showRule(rule) {
    return root.Helpers.escapeHtml(rule.lhs + ' → ' + (rule.rhs.join(' ') || 'ε'));
  }

  function paintPipeline(key) {
    const result = pipelineFor(key);

    root.jQuery('#gtr-pipeline tbody').html(result.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.step) + '</td>' +
        '<td class="mono">' + row.productions + '</td><td class="mono">' + row.nonterminals +
        '</td><td class="mono">' + (row.preserved ? 'yes' :
          'NO — ' + row.missing.concat(row.extra).join(', ')) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('gtr-pipeline-note',
      'Each row applies its step to the OUTPUT of the row above, and the last column re-checks ' +
      'against the original grammar rather than against the previous step — so an error ' +
      'introduced early cannot be hidden by a later step that is internally consistent. The ' +
      'productions column is the cost: the expression grammar leaves this pipeline with several ' +
      'times the rules it entered with, almost all of it from the normal-form conversion at the ' +
      'end.');
  }

  function paintTrees(state) {
    if (!state.shapes) {
      root.jQuery('#gtr-trees').html('<p class="mono" style="font-size:.85rem">' +
        'no input up to length 5 changes shape under this step</p>');
      root.Helpers.setText('gtr-trees-note',
        'Some steps are shape-neutral on small inputs — removing a symbol nothing derives ' +
        'cannot change a tree that never mentioned it. That is the exception; the pipeline ' +
        'above shows the steps that are not.');
      return;
    }
    const before = root.Earley.trees(root.Earley.parse(state.before, state.shapes.tokens), 1)[0];
    const after = root.Earley.trees(root.Earley.parse(state.after, state.shapes.tokens), 1)[0];

    root.jQuery('#gtr-trees').html(
      '<div class="mono" style="font-size:.8rem">before: ' +
      root.Helpers.escapeHtml(state.shapes.before) + '</div>' +
      root.ParseTreeView.markup({ tree: before, ariaLabel: 'tree before the transformation' }) +
      '<div class="mono" style="font-size:.8rem;margin-top:.5rem">after: ' +
      root.Helpers.escapeHtml(state.shapes.after) + '</div>' +
      root.ParseTreeView.markup({ tree: after, ariaLabel: 'tree after the transformation' }));

    root.Helpers.setText('gtr-trees-note',
      'Same input, same language, different tree. This is the entire risk of a grammar rewrite ' +
      'in one picture: nothing about the set of accepted programs changed, so every acceptance ' +
      'test still passes, and the structure a semantic pass walks is not the structure it was ' +
      'written for. The habit is to assert tree shapes for a handful of inputs, not only ' +
      'acceptance.');
  }

  function paintCosts() {
    const rows = [
      { step: 'Remove useless symbols', needed: 'every other transformation, as a precondition',
        blowup: 'none — it only removes', tree: 'none: the removed symbols were in no tree' },
      { step: 'Remove ε-productions',
        needed: 'CNF, CYK, and any parser that dislikes empty alternatives',
        blowup: 'exponential in the nullable symbols in one right-hand side',
        tree: 'the ε leaves vanish, so a visitor counting children sees fewer' },
      { step: 'Remove unit productions', needed: 'CNF; also shrinks LR tables',
        blowup: 'quadratic in the nonterminals, via the unit chains',
        tree: 'levels collapse — precedence levels encoded as unit chains are lost' },
      { step: 'Eliminate left recursion', needed: 'recursive descent and LL(k); never LR',
        blowup: 'linear for direct, quadratic for indirect via substitution',
        tree: 'a left spine becomes a right spine — associativity must be re-imposed' },
      { step: 'Left factoring', needed: 'LL(1), to make one token of lookahead sufficient',
        blowup: 'one extra nonterminal per factored prefix',
        tree: 'the shared prefix and the choice become separate nodes' },
      { step: 'Chomsky normal form', needed: 'CYK, and several proofs',
        blowup: 'the demo takes six productions to thirty-three',
        tree: 'binarised: every node has exactly two children or one terminal' }
    ];

    root.jQuery('#gtr-costs tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.step + '</td><td>' + row.needed + '</td><td>' + row.blowup +
        '</td><td>' + row.tree + '</td></tr>';
    }).join(''));

    root.Helpers.setText('gtr-costs-note',
      'The second column is the honest reason to run each step, and it is always a downstream ' +
      'tool rather than the grammar itself. That matters for the decision: if you are hand-' +
      'writing a recursive-descent parser you need left-recursion elimination and left ' +
      'factoring and nothing else, and if you are feeding an LR generator you need neither and ' +
      'should not apply them. The last column is what the rewrite costs you in every case, and ' +
      'it is the column that gets left out of the tutorial.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
