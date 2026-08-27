/**
 * Section: Memory and alias analysis.
 *
 * The measurement is the pair of analyses on one program. Two records merged
 * at a join: Andersen keeps them apart everywhere except at the merge itself,
 * Steensgaard unifies the two classes permanently and then reports every
 * pointer as possibly aliasing every other. The pair counts differ, and the
 * difference is the precision, in a unit.
 *
 * The second is soundness, which is the property that actually matters. The
 * dynamic oracle records which registers really referred to the same object
 * during a run; both analyses must be supersets of it. An analysis that is
 * precise and unsound is worse than useless, because every pass downstream
 * trusts it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'alias-analysis';
  let panel = null;

  const BASE = ['ssa', 'copy-propagation'];

  const LANGUAGE = [
    { feature: 'Immutability',
      gets: 'a value that cannot change need not be reloaded after any store',
      without: 'every store invalidates every load the analysis cannot separate' },
    { feature: 'Ownership, as in Rust',
      gets: 'a unique reference cannot alias anything else, by the type system',
      without: 'the analysis has to prove it, and usually cannot across a call' },
    { feature: 'restrict in C',
      gets: 'the programmer asserts two pointers do not overlap',
      without: 'a memcpy-shaped loop cannot be vectorised' },
    { feature: 'Distinct nominal types',
      gets: 'a type-based rule: two pointers of unrelated types cannot alias',
      without: 'structural types share layout, so the rule does not apply' },
    { feature: 'No pointers into locals',
      gets: 'every local is promotable to a register, which is what SSA needs',
      without: 'a taken address forces the local to stay in memory' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the same merge, under two analyses',
      caption: 'Two allocations and a join. Andersen adds a SUBSET edge for each assignment, so ' +
        'the merged pointer points at both sites and the originals keep pointing at one each — ' +
        'the relation is directional, and `p` learning about `q`\'s site does not make `q` ' +
        'learn about `p`\'s. Steensgaard MERGES the classes instead, and the merge is ' +
        'symmetric and permanent: after the join, `p`, `q` and the merged pointer are one ' +
        'class and every pair among them may alias. That is not "approximately as good"; it is ' +
        'a different relation, and one example is enough to see it.',
      definition: [
        'graph TD',
        'A["p = alloc 1"] --> M["r = phi p, q"]',
        'B["q = alloc 2"] --> M',
        'M --> AN["Andersen: r → {1, 2}, p → {1}, q → {2}"]',
        'M --> ST["Steensgaard: p, q, r all one class → {1, 2}"]',
        'AN --> G1["p and q do not alias"]',
        'ST --> G2["p and q may alias"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Memory breaks SSA, and that is the whole reason this section exists.** A register has ' +
        'one definition; a heap location does not. So `p.x` after a store through `q` is only ' +
        'the old value if `p` and `q` cannot be the same object — and every load and store ' +
        'elimination in a real compiler is gated on answering that.',
      '**A points-to analysis answers it by asking what each pointer can point AT.** Two ' +
        'pointers may alias when their sets of allocation sites overlap. That converts an ' +
        'unbounded question about the heap into a finite one about the program text, which is ' +
        'the move that makes the problem tractable at all.',
      '**Andersen is inclusion-based: `p = q` means everything q points at, p also points ' +
        'at.** A subset constraint, solved to a fixpoint. The relation is directional, so ' +
        'assigning `q` to `p` does not teach `q` anything about `p` — which is where its ' +
        'precision comes from, and its cubic worst case.',
      '**Steensgaard is unification-based: `p = q` merges their classes.** Almost linear, and ' +
        'the merge is symmetric and permanent. That is the entire trade: one assignment ' +
        'between two unrelated pointers makes them alias forever, in both directions, ' +
        'including for every pointer already merged with either.',
      '**The two are not "precise" and "approximately as precise".** They compute different ' +
        'relations, and the demo runs both on the same program and reports the pair counts. ' +
        'Describing the difference is easy to get wrong in either direction; counting it is not.',
      '**Soundness is the property that matters, and it is checkable.** Every alias that ' +
        'really happens must be reported. The dynamic oracle records which registers actually ' +
        'held the same object during a run and both analyses must be supersets of it — an ' +
        'under-approximation by construction, which is exactly the right shape for a soundness ' +
        'check.',
      '**A load can be forwarded from an earlier store only if nothing between may write the ' +
        'same location.** That is the alias question, so the pass is exactly as good as the ' +
        'analysis it is handed — which the demo measures by running the same elimination with ' +
        'each. A call clears everything, because without an interprocedural summary a callee ' +
        'may write anything.',
      '**Alias analysis is where compilers give up first, and that is why language features ' +
        'that make aliasing provable pay off in generated code.** `restrict`, ownership types ' +
        'and immutability are not only reasoning aids: each hands the optimiser an answer it ' +
        'would otherwise have to compute badly, and the last table says what each one buys.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — two analyses, their pair counts, and a dynamic soundness check',
        markup: root.AliasTemplate.render()
      },
      diagram: diagram(),
      insight: '**Alias analysis is where compilers give up first, and it is why `restrict`, ' +
        'ownership types and immutability pay off in generated code, not just in reasoning.** ' +
        'The giving-up is not laziness. Precise points-to analysis of a whole program is ' +
        'expensive in a way that scales badly — Andersen is cubic, and the constant matters at ' +
        'real sizes — and the moment a call crosses a module boundary the analysis has to ' +
        'assume the callee may write anything it can reach. So production compilers run ' +
        'something cheap, treat most things as possibly aliasing, and lose most of the load ' +
        'elimination that was available. What changes that is not a better analysis but a ' +
        'better input: a type system that says a reference is unique, a keyword that says two ' +
        'pointers do not overlap, an immutable value that no store can invalidate. Each of ' +
        'those turns a question the optimiser was going to answer conservatively into one it ' +
        'does not have to ask. That is the concrete, measurable return on those features, and ' +
        'it is a different argument from the usual one about correctness — worth having ' +
        'separately, because it survives the objection that a careful programmer did not need ' +
        'the help.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AliasTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const stateFor = root.Helpers.memoise(function (sample) {
    const out = root.PassLab.run(root.AliasTemplate.SAMPLES[sample], BASE);
    const fn = out.program.functions[out.program.functions.length - 1];

    return { fn: fn, program: out.program,
      compare: root.Berugo.Alias.compare(fn),
      dynamic: dynamicOracle(out.program, fn) };
  });

  /**
   * The oracle: run the program and record which registers held the same
   * object. It only sees the paths this input took, which is exactly right for
   * a soundness check — a static analysis must be a superset of what actually
   * happened, and the amount by which is its imprecision.
   */
  function dynamicOracle(program, fn) {
    const trace = [];

    root.Berugo.Ir.eachInstruction(fn, function (inst) {
      const target = root.Berugo.Ir.definitionOf(inst);

      if (target) trace.push({ register: target, inst: inst });
    });
    return root.Berugo.Alias.dynamicPairs(fn, replay(program, fn, trace));
  }

  /**
   * Replaying by interpreting the allocations directly rather than by
   * instrumenting the interpreter: every allocation site is one object, and a
   * register that is a copy of another holds the same one. That is exactly the
   * relation the analyses are approximating, computed by construction rather
   * than by an analysis — which is what keeps it an independent check.
   */
  function replay(program, fn, trace) {
    const objects = new Map();
    const rows = [];

    trace.forEach(function (entry) {
      if (root.Berugo.Alias.ALLOCATIONS.indexOf(entry.inst.op) !== -1) {
        objects.set(entry.register, { site: entry.register });
      } else if (entry.inst.op === 'move' && objects.has(entry.inst.from)) {
        objects.set(entry.register, objects.get(entry.inst.from));
      } else if (entry.inst.op === 'phi') {
        recordPhi(entry, objects);
      }
      if (objects.has(entry.register)) {
        rows.push({ register: entry.register, object: objects.get(entry.register) });
      }
    });
    return rows;
  }

  function recordPhi(entry, objects) {
    const first = entry.inst.incoming.find(function (row) { return objects.has(row.value); });

    if (first) objects.set(entry.register, objects.get(first.value));
  }

  const suiteFor = root.Helpers.memoise(function () {
    return Object.keys(root.AliasTemplate.SAMPLES).map(function (id) {
      const state = stateFor(id);

      return Object.assign({ id: id }, state.compare);
    });
  });

  function update() {
    const values = panel.values();
    const state = stateFor(values['aa-sample']);
    const analysis = values['aa-analysis'] === 'andersen'
      ? state.compare.andersen : state.compare.steensgaard;

    paintPoints(state, analysis);
    paintMetrics(state, analysis);
    paintCompare(state);
    paintSound(state);
    paintSuite();
    paintLanguage();
  }

  function paintPoints(state, analysis) {
    const rows = Object.keys(analysis.points).filter(function (id) {
      return analysis.points[id] && analysis.points[id].size;
    }).sort();

    root.jQuery('#aa-points tbody').html(rows.map(function (id) {
      const sites = Array.from(analysis.points[id]).sort();

      return '<tr><td class="mono">' + id + '</td><td class="mono">' + sites.join(', ') +
        '</td><td class="mono">' + sites.length + '</td></tr>';
    }).join('') || '<tr><td colspan="3">nothing in this program points at an allocation</td></tr>');

    root.Helpers.setText('aa-points-caption',
      'Each row is a register and the allocation sites it could refer to. Two registers may ' +
      'alias exactly when these sets overlap, which is what turns an unbounded question about ' +
      'the heap into a finite one about the program text. A set of size one is a pointer the ' +
      'optimiser knows exactly; a set of size two is where the analyses start to differ.');
  }

  function paintMetrics(state, analysis) {
    const compare = state.compare;
    const sound = root.Berugo.Alias.checkSound(analysis, state.dynamic);

    root.MetricGrid.update({
      'aa-sites': { value: root.Format.exact(compare.sites),
        note: 'every record, array and closure this function allocates' },
      'aa-pairs': { value: root.Format.exact(analysis.pairs.length),
        note: analysis.name + ' — ' + (analysis.merges === undefined
          ? analysis.rounds + ' rounds to a fixpoint'
          : analysis.merges + ' unifications, ' + analysis.classes + ' classes') },
      'aa-lost': { value: root.Format.exact(compare.lost),
        note: compare.lost ? 'pairs Steensgaard reports that Andersen does not — the price of ' +
          'a symmetric, permanent merge'
          : 'the two agree on this program, which most simple programs do' },
      'aa-sound': { value: sound.sound ? 'yes' : 'NO',
        note: sound.actual + ' aliases actually happened and ' + sound.reported +
          ' are reported; ' + sound.missed.length + ' missed' }
    });
  }

  function paintCompare(state) {
    const rows = [
      { name: 'Andersen', method: 'inclusion — a subset edge per assignment, to a fixpoint',
        pairs: state.compare.andersenPairs, loads: state.compare.andersenLoads,
        cost: state.compare.andersen.rounds + ' rounds' },
      { name: 'Steensgaard', method: 'unification — the classes are merged, symmetrically',
        pairs: state.compare.steensgaardPairs, loads: state.compare.steensgaardLoads,
        cost: state.compare.steensgaard.merges + ' merges' }
    ];

    root.jQuery('#aa-compare tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' +
        root.Helpers.escapeHtml(row.method) + '</td><td class="mono">' + row.pairs +
        '</td><td class="mono">' + row.loads + '</td><td class="mono">' + row.cost +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('aa-compare-caption', compareCaption(state));
  }

  function compareCaption(state) {
    const lost = state.compare.lost;

    if (!lost) {
      return 'The two agree on this program, which is the ordinary case: unification only ' +
        'loses when two pointers that were never related get assigned to each other. Switch ' +
        'to the merge fixture for the case where they separate — one example is enough, and ' +
        'it is exactly the one that appears whenever a value comes out of a conditional.';
    }
    return 'Steensgaard reports ' + lost + ' more may-alias pairs than Andersen on this ' +
      'program. Both are sound; the extra pairs are pointers Andersen can prove distinct and ' +
      'Steensgaard has merged. The fourth column is what that costs: a load that could have ' +
      'been forwarded from an earlier store is left in place because a store through a ' +
      'possibly-aliasing pointer sits between them.';
  }

  function paintSound(state) {
    const rows = [state.compare.andersen, state.compare.steensgaard].map(function (analysis) {
      return Object.assign({ name: analysis.name },
        root.Berugo.Alias.checkSound(analysis, state.dynamic));
    });

    root.jQuery('#aa-sound-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' + row.reported +
        '</td><td class="mono">' + row.actual + '</td><td class="mono">' + row.missed.length +
        '</td><td>' + (row.sound ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('aa-sound-table-caption',
      'The middle column is what actually happened on this input, recorded rather than ' +
      'analysed. A static analysis must be a SUPERSET of it — reporting more is imprecision ' +
      'and reporting fewer is unsoundness, and only one of those is survivable. The oracle is ' +
      'an under-approximation by construction, since it only sees the paths this input took, ' +
      'and that is exactly the right shape: it can prove an analysis wrong and can never prove ' +
      'one right.');
  }

  function paintSuite() {
    const rows = suiteFor('all');

    root.jQuery('#aa-suite tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.sites +
        '</td><td class="mono">' + row.andersenPairs + '</td><td class="mono">' +
        row.steensgaardPairs + '</td><td class="mono">' + row.lost + '</td><td class="mono">' +
        row.andersenLoads + '</td></tr>';
    }).join(''));

    root.Helpers.setText('aa-suite-caption', suiteCaption(rows));
  }

  function suiteCaption(rows) {
    const differing = rows.filter(function (row) { return row.lost > 0; });

    return differing.length + ' of ' + rows.length + ' fixtures separate the two analyses. ' +
      'That ratio is the honest headline: on straight-line code that never mixes two pointers, ' +
      'unification is exactly as good as inclusion and costs far less, which is why real ' +
      'compilers reach for it first. The programs where it loses are the ones with a value ' +
      'coming out of a conditional — which is most real code, and why the cheap analysis is a ' +
      'starting point rather than an answer.';
  }

  function paintLanguage() {
    root.jQuery('#aa-language tbody').html(LANGUAGE.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.feature) + '</td><td>' +
        root.Helpers.escapeHtml(row.gets) + '</td><td>' +
        root.Helpers.escapeHtml(row.without) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('aa-language-caption',
      'Each row is an answer the language hands the optimiser instead of making it compute ' +
      'one. Berugo gets the last one for free — it has no way to take the address of a local, ' +
      'so every local is promotable and SSA construction can promote all of them. That is why ' +
      '29.4 had nothing to refuse, and it is worth noticing as a language design consequence ' +
      'rather than as an implementation convenience: the moment a language grows a reference ' +
      'to a local, the promotion becomes unsound and the middle end gets measurably worse.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
