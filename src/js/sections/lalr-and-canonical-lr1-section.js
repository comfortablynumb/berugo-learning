/**
 * Section: LALR and canonical LR(1).
 *
 * The measurement is the merge and what it costs. The default grammar is the
 * classic one that is LR(1) and not LALR(1): canonical LR(1) builds fourteen
 * states with no conflicts, LALR merges one pair down to thirteen and gains two
 * reduce/reduce conflicts that neither LR(1) nor SLR has. The demo puts the
 * merged state's pooled lookaheads on screen, because that pooling IS the
 * mechanism and every description of it is otherwise hand-waving.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'lalr-and-canonical-lr1';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — two LR(1) states with the same core, merged',
      caption: 'An LR(1) item carries a lookahead: `E → e •, c` means "we have finished an E and ' +
        'this reduction is only valid if the next token is `c`". Two states can hold the same ' +
        'ITEMS with different lookaheads — the same position in the grammar, reached by two ' +
        'different routes. LALR merges every such pair, keeping the items and taking the UNION ' +
        'of the lookaheads. That gives exactly as many states as LR(0), which is the entire ' +
        'reason LALR exists. The cost is on the right: after the merge, the state reduces E on ' +
        'both `c` and `d`, and reduces F on both too — so the two reductions now collide on both ' +
        'tokens, in a state where neither collision was possible before.',
      definition: [
        'graph TD',
        '    A["state 6<br/>E → e • , c<br/>F → e • , d"] -->|same core| C',
        '    B["state 9<br/>E → e • , d<br/>F → e • , c"] -->|same core| C',
        '    C["merged state<br/>E → e • , c d<br/>F → e • , c d<br/>reduce/reduce on both"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A canonical LR(1) item is an LR(0) item plus one lookahead terminal.** The lookahead is ' +
        'computed during closure: when a dot before A pulls in A\'s productions, their lookahead ' +
        'is FIRST of whatever follows A in the current item, falling back to the current item\'s ' +
        'own lookahead when that is nullable. That one rule is the entire difference from LR(0).',
      '**The precision is real and so is the state explosion.** Two states with identical items ' +
        'and different lookaheads are different states, so the count multiplies. The demo\'s ' +
        'expression grammar goes from twelve LR(0) states to twenty-two LR(1) ones for exactly ' +
        'that reason, with no change to the grammar.',
      '**LALR(1) merges the states whose CORES are equal and unions their lookaheads.** The core ' +
        'is the item set with lookaheads stripped, so the cores ARE the LR(0) states — which is ' +
        'why LALR always has exactly as many states as LR(0) and SLR. That is the deal: LR(1) ' +
        'precision at LR(0) size.',
      '**The merge can create reduce/reduce conflicts that neither neighbour has.** Pooling ' +
        'lookaheads means a reduction valid on `c` in one route and a different reduction valid ' +
        'on `d` in another become two reductions each valid on both. The demo\'s default grammar ' +
        'is the standard witness, and the induced-conflict metric counts exactly the conflicts ' +
        'LALR has and LR(1) does not.',
      '**A merge never creates a SHIFT/reduce conflict, only reduce/reduce.** Shifts come from ' +
        'transitions, which depend on the core alone, so merging cannot add one. That asymmetry ' +
        'is why "LALR is almost LR(1)" is a fair summary in practice: the failure mode is narrow ' +
        'and identifiable.',
      '**Precedence declarations are conflict resolution without grammar surgery.** yacc and ' +
        'bison let you say `%left \'+\'` and `%left \'*\'` and resolve shift/reduce conflicts by ' +
        'comparing the precedence of the rule and of the lookahead. It works, it is what every ' +
        'real yacc grammar does, and it means the grammar file no longer specifies the language ' +
        'on its own — the declarations are part of the definition.',
      '**LALR is what the generators you have used actually build.** yacc, bison, and (until ' +
        'recently) most of the ecosystem. When bison reports a reduce/reduce conflict on a ' +
        'grammar you believe is unambiguous, the merge is the first thing to suspect, and ' +
        '`bison -Wcounterexamples` or switching to canonical LR(1) with `%define lr.type ' +
        'canonical-lr` will tell you.',
      '**GLR is the escape hatch and it changes the cost model.** Instead of demanding a ' +
        'conflict-free table, GLR takes every action a conflicted cell offers and lets the ' +
        'branches die or merge. It parses any context-free grammar, at a cost that is linear on ' +
        'the deterministic parts and worse where the ambiguity is — which is the right shape for ' +
        'a real language that is deterministic except in three places.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — merge LR(1) states by core and watch a conflict appear',
        markup: root.LalrTemplate.render()
      },
      diagram: diagram(),
      insight: '**Precedence declarations are a way of resolving conflicts without fixing the ' +
        'grammar; they work, and they also make the grammar no longer a specification of the ' +
        'language.** After `%left \'+\'` the grammar file admits two parses for `a + a + a` and ' +
        'a separate declaration picks one, so anyone reading the rules to learn the language ' +
        'reads something incomplete. That is a real cost when the grammar is the reference — a ' +
        'standards document, a second implementation, a syntax highlighter written from the ' +
        'spec. The pragmatic position is to use precedence declarations for expression ' +
        'operators, where the convention is universal and the alternative is a tower of ' +
        'nonterminals nobody reads, and to fix the grammar everywhere else.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LalrTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const builtFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.LrParser.build(root.ParseLab.fixture(parts[0]), parts[1]);
  });

  const comparisonFor = root.Helpers.memoise(function (name) {
    return root.LrParser.compare(root.ParseLab.fixture(name));
  });

  /**
   * Which LR(1) states each LALR state came from, and what the union did to
   * their lookaheads. Recomputing the canonical collection here is the point:
   * the merge is only visible against what it merged.
   */
  const mergesFor = root.Helpers.memoise(function (name) {
    const augmented = root.LrItems.augment(root.ParseLab.fixture(name));
    const canonical = root.LrItems.collection(augmented, 'lr1');
    const merged = root.LrItems.mergeByCore(canonical);
    const groups = {};

    Object.keys(merged.mapping).forEach(function (from) {
      const to = merged.mapping[from];

      if (!groups[to]) groups[to] = [];
      groups[to].push(Number(from));
    });
    return Object.keys(groups).map(Number)
      .filter(function (to) { return groups[to].length > 1; })
      .map(function (to) {
        return { state: to, from: groups[to],
          items: merged.states[to].map(root.LrItems.show) };
      });
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const built = builtFor(parts[0] + '\n' + parts[1]);
    const tokens = parts[2].split(' ').filter(function (part) { return part !== ''; });

    return root.LrParser.parse(built, tokens);
  });

  function update() {
    const values = panel.values();
    const key = values['lal-grammar'] + '\n' + values['lal-mode'];
    const built = builtFor(key);
    const run = runFor(key + '\n' + values['lal-input']);

    paintMetrics(built, run, values['lal-grammar']);
    paintCompare(values['lal-grammar']);
    paintMerges(values['lal-grammar']);
    paintTable(built);
    paintConflicts(built, values['lal-grammar']);
    paintChoice();
  }

  function induced(name) {
    const rows = comparisonFor(name);
    const lalr = rows.filter(function (row) { return row.mode === 'lalr'; })[0];
    const lr1 = rows.filter(function (row) { return row.mode === 'lr1'; })[0];

    return { count: lalr.conflicts - lr1.conflicts, lalr: lalr, lr1: lr1 };
  }

  function paintMetrics(built, run, name) {
    const gap = induced(name);

    root.MetricGrid.update({
      'lal-states': { value: root.Format.exact(built.states) + ' of ' +
        root.Format.exact(gap.lr1.states),
      note: built.states === gap.lr1.states
        ? 'this grammar needs no extra states for lookahead'
        : 'the canonical construction needs ' +
          root.Format.exact(gap.lr1.states - gap.lalr.states) + ' more' },
      'lal-merged': { value: root.Format.exact(gap.lalr.merged),
        note: gap.lalr.merged
          ? 'cores that appeared in more than one LR(1) state, pooled into one'
          : 'no two LR(1) states share a core, so LALR and LR(1) are the same table here' },
      'lal-induced': { value: root.Format.exact(Math.max(0, gap.count)),
        note: gap.count > 0
          ? 'conflicts LALR has and canonical LR(1) does not — caused by the merge alone'
          : 'the merge cost nothing on this grammar' },
      'lal-parse': { value: run.accepted ? 'accepted' : 'rejected',
        note: run.accepted
          ? root.Format.exact(run.steps.length) + ' steps through the ' +
            built.mode.toUpperCase() + ' table'
          : 'stopped at token ' + run.consumed + (run.expected.length
            ? '; the state expected ' + run.expected.join(' ') : '') }
    });
  }

  function paintCompare(name) {
    root.jQuery('#lal-compare tbody').html(comparisonFor(name).map(function (row) {
      return '<tr><td class="mono">' + row.mode.toUpperCase() + '</td><td class="mono">' +
        row.states + '</td><td class="mono">' + row.shiftReduce + '</td><td class="mono">' +
        row.reduceReduce + '</td></tr>';
    }).join(''));

    root.Helpers.setText('lal-compare-note',
      'Read the states column top to bottom: LR(0), SLR and LALR always agree, because all ' +
      'three are built on the LR(0) cores, and canonical LR(1) is the only one that can be ' +
      'larger. Then read the reduce/reduce column: on the default grammar LALR is the only row ' +
      'with entries, which is the phenomenon this section exists for — a conflict that is not in ' +
      'the grammar, not in the LR(0) automaton and not in canonical LR(1), and appears purely ' +
      'because two states were pooled.');
  }

  function paintMerges(name) {
    const merges = mergesFor(name);

    root.jQuery('#lal-merges tbody').html(merges.slice(0, 8).map(function (merge) {
      return '<tr><td class="mono">' + merge.state + '</td><td class="mono">' +
        merge.from.join(', ') + '</td><td class="mono" style="font-size:.78rem">' +
        root.Helpers.escapeHtml(merge.items.join('  ·  ')) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">nothing merged</td>' +
      '<td class="mono">every core appears in exactly one LR(1) state</td></tr>');

    root.Helpers.setText('lal-merges-note',
      'The third column is the merged item set, and the lookahead after each comma is the UNION ' +
      'of what the source states had. On the default grammar look for the state containing both ' +
      '`E → e •` and `F → e •`: before the merge one state reduced E on `c` and F on `d`, and ' +
      'the other did the reverse; afterwards both reductions are valid on both tokens, so the ' +
      'parser cannot tell which one it is finishing. Nothing about the grammar changed — the ' +
      'information that distinguished the two routes was thrown away by the merge.');
  }

  function paintTable(built) {
    root.jQuery('#lal-table').html(root.ParseTableView.lrMarkup(built, {
      caption: built.mode.toUpperCase() + ' table — ' + built.states + ' states, ' +
        built.conflicts.length + ' conflicts'
    }));

    root.Helpers.setText('lal-table-note',
      'Switch the flavour control and watch the row count change while the columns stay the ' +
      'same. That is the size argument for LALR made concrete: a real language grammar has ' +
      'hundreds of LR(0) cores and thousands of LR(1) states, and in 1975 the difference was ' +
      'between a table that fitted in memory and one that did not. The constraint is gone and ' +
      'the tooling is not — bison still defaults to LALR, so the conflicts it reports are still ' +
      'the ones the merge causes.');
  }

  function paintConflicts(built, name) {
    const lr1 = builtFor(name + '\nlr1');

    root.jQuery('#lal-conflicts tbody').html(built.conflicts.map(function (conflict) {
      return '<tr><td class="mono">state ' + conflict.state + ' on ' +
        root.Helpers.escapeHtml(conflict.terminal) + '</td><td class="mono">' +
        conflict.kind + '</td><td class="mono">' +
        root.Helpers.escapeHtml(conflict.first + '  |  ' + conflict.second) +
        '</td><td class="mono">' + (inCanonical(lr1, conflict) ? 'yes — a real ambiguity'
        : 'NO — the merge caused it') + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">none</td>' +
      '<td class="mono">every cell holds one action</td><td class="mono">—</td></tr>');

    root.Helpers.setText('lal-conflicts-note',
      'The last column is the diagnosis that matters. A conflict present in canonical LR(1) is ' +
      'a genuine problem with the grammar and no table technique will remove it — the ' +
      'dangling-else row is that case, and it survives every flavour. A conflict absent from ' +
      'LR(1) was manufactured by the merge, and the fixes are different: rename a nonterminal to ' +
      'break the shared core, or switch the generator to canonical LR. Reporting the two ' +
      'identically, which is what every generator does, is why the second kind eats an ' +
      'afternoon.');
  }

  function inCanonical(lr1, conflict) {
    return lr1.conflicts.some(function (other) {
      return other.kind === conflict.kind && other.terminal === conflict.terminal;
    });
  }

  function paintChoice() {
    const rows = [
      { technique: 'LR(0)', size: 'smallest — one state per core',
        grammars: 'almost none; any grammar with a completed item and a shift conflicts',
        used: 'nothing directly; it is the substrate for SLR and LALR' },
      { technique: 'SLR(1)', size: 'same as LR(0)',
        grammars: 'most textbook grammars, and many real ones',
        used: 'small generators; a good first thing to try' },
      { technique: 'LALR(1)', size: 'same as LR(0)',
        grammars: 'nearly everything LR(1) accepts, minus the merge casualties',
        used: 'yacc, bison, and most of the last fifty years of compilers' },
      { technique: 'Canonical LR(1)', size: 'up to an order of magnitude larger',
        grammars: 'every deterministic context-free language',
        used: 'bison with lr.type=canonical-lr; some newer generators by default' },
      { technique: 'IELR(1)', size: 'close to LALR',
        grammars: 'everything LR(1) accepts',
        used: 'bison with lr.type=ielr — LALR size, LR(1) power, and few people know it exists' },
      { technique: 'GLR', size: 'an LR table plus a runtime graph stack',
        grammars: 'every context-free grammar, ambiguous ones included',
        used: 'bison %glr-parser, tree-sitter, Elkhound, and C++ front ends' }
    ];

    root.jQuery('#lal-choice tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.technique + '</td><td>' + row.size + '</td><td>' +
        row.grammars + '</td><td>' + row.used + '</td></tr>';
    }).join(''));

    root.Helpers.setText('lal-choice-note',
      'The IELR row is the practical takeaway and almost nobody uses it: it accepts everything ' +
      'canonical LR(1) does at close to LALR size, it has been in bison since 2012, and it is ' +
      'one line in the grammar file. If you are staring at a reduce/reduce conflict that the ' +
      'demo above says the merge caused, that line is the fix. The GLR row is the other answer, ' +
      'and it is the right one when the ambiguity is genuine and has to be resolved with ' +
      'information the parser does not have — which is where the next section starts.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
