/**
 * Section: Subtyping and variance.
 *
 * The measurement is the unsoundness search. Nothing here asserts that
 * covariant mutable arrays are broken: the demo asks, for every pair the
 * covariant rule admits, whether some value the supertype accepts cannot go in
 * the underlying container. Two pairs come back with a witness — store a
 * Double through a CovariantArray<Number> view of a CovariantArray<Integer>,
 * and store an Integer through the Double one. The invariant version rejects
 * both, which is the check that the fix is really a fix.
 *
 * The second is the function rule: `Number → Integer ≤ Integer → Number` holds
 * and the reverse does not, with the flipped premise visible in the derivation.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'subtyping-and-variance';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function pairs() {
    const S = root.Subtyping;
    const P = S.prim;

    return [
      [S.record({ x: P('Integer'), y: P('Integer'), c: P('String') }),
        S.record({ x: P('Number'), y: P('Number') })],
      [S.record({ y: P('Integer'), x: P('Integer') }),
        S.record({ x: P('Number'), y: P('Number') })],
      [S.record({ x: P('Number') }), S.record({ x: P('Integer') })],
      [S.arrow(P('Number'), P('Integer')), S.arrow(P('Integer'), P('Number'))],
      [S.arrow(P('Integer'), P('Integer')), S.arrow(P('Number'), P('Number'))],
      [S.generic('List', [P('Integer')]), S.generic('List', [P('Number')])],
      [S.generic('Ref', [P('Integer')]), S.generic('Ref', [P('Number')])],
      [S.generic('Sink', [P('Number')]), S.generic('Sink', [P('Integer')])],
      [S.generic('Map', [P('Integer'), P('Integer')]),
        S.generic('Map', [P('Number'), P('Number')])],
      [S.generic('CovariantArray', [P('Integer')]),
        S.generic('CovariantArray', [P('Number')])]
    ];
  }

  function latticePairs() {
    const S = root.Subtyping;
    const P = S.prim;

    return [
      [P('Integer'), P('Double')],
      [P('Integer'), P('String')],
      [S.record({ x: P('Integer'), y: P('String') }),
        S.record({ x: P('Double'), z: P('Boolean') })],
      [S.record({ x: P('Integer'), y: P('String') }),
        S.record({ x: P('Integer'), z: P('Boolean') })]
    ];
  }

  function diagram() {
    return {
      title: 'Diagram — function subtyping, with the argument position flipping',
      caption: 'The rule everybody can recite and few apply. A function is safely usable where ' +
        'another is expected when it accepts at least as much and returns at most as much. ' +
        'Trace it through substitutability: the caller was promised it could pass an Integer, ' +
        'so the replacement must accept Integers — accepting Numbers is fine, since every ' +
        'Integer is one. The caller was promised a Number back, so the replacement may return ' +
        'anything that IS a Number, including an Integer. Argument contravariant, result ' +
        'covariant, and the arrow in the premise genuinely points the other way.',
      definition: [
        'graph TD',
        'A["is  S₁ → S₂  ≤  T₁ → T₂ ?"] --> B["premise 1: T₁ ≤ S₁ — flipped"]',
        'A --> C["premise 2: S₂ ≤ T₂ — same direction"]',
        'B --> D["the replacement must accept everything the original accepted"]',
        'C --> E["the replacement may return something more specific"]',
        'D --> F["Number → Integer  ≤  Integer → Number ✓"]',
        'E --> F',
        'F --> G["and Integer → Integer  ≤  Number → Number ✗ — it refuses a Double"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Subsumption is the one rule that makes subtyping a type system feature.** If `e : S` ' +
        'and `S ≤ T` then `e : T` — a value of a subtype may be used wherever the supertype is ' +
        'expected. Everything else in this section is about deciding the `≤` relation; ' +
        'subsumption is what makes it matter.',
      '**Record subtyping has three faces and one rule.** Width: more fields is a subtype, ' +
        'because it satisfies every requirement and then some. Depth: each field may itself be ' +
        'a subtype. Permutation: order does not matter. All three come from a single check — ' +
        'every field the supertype names must be present and a subtype — and the demo derives ' +
        'them from exactly that.',
      '**Function subtyping flips the argument, and this is the rule that gets applied ' +
        'backwards.** `S₁ → S₂ ≤ T₁ → T₂` requires `T₁ ≤ S₁` and `S₂ ≤ T₂`. A callback that ' +
        'accepts a NARROWER type cannot be substituted where a wider one is expected, because ' +
        'the caller may pass something it refuses. That is the single most common variance ' +
        'mistake in practice.',
      '**Variance is that rule lifted to a type constructor, and it follows from read and ' +
        'write.** A parameter that only appears in output positions is covariant. One that ' +
        'only appears in input positions is contravariant. One that appears in both — anything ' +
        'you can read AND write — is invariant. A mutable cell is invariant for exactly this ' +
        'reason, and no design cleverness gets around it.',
      '**Declaration-site variance states it once; use-site variance states it per use.** ' +
        'Scala\'s `List[+A]` and Kotlin\'s `out A` are declaration-site: the container says how ' +
        'it behaves and every use follows. Java has no such declaration, so it has ' +
        '`List<? extends Number>` at each use instead. Same rule, different place to write it, ' +
        'and the Java version is noisier because it is repeated.',
      '**Java\'s covariant arrays are a known hole, plugged at run time.** `Object[] a = new ' +
        'String[1]` compiles, and `a[0] = 1` throws `ArrayStoreException`. The demo finds the ' +
        'pairs the covariant rule admits and then searches for a value that breaks each one, ' +
        'so the hole arrives as a witness. It was a deliberate 1995 trade for polymorphism ' +
        'before generics existed, and the runtime check is the interest payment.',
      '**Bounded quantification is where subtyping and polymorphism meet.** `∀α ≤ Number. ' +
        'α → α` is a function polymorphic over anything below Number, so its body may use ' +
        'Number operations and its result keeps the caller\'s exact type. That is ' +
        '`<T extends Number>` and it is the reason generics and subtyping have to be designed ' +
        'together rather than bolted on separately.',
      '**TypeScript is deliberately unsound in a place worth knowing.** Method parameters are ' +
        'bivariant — a method taking a narrower type is accepted where a wider one is expected ' +
        '— because sound contravariance broke too much existing JavaScript. `strictFunctionTypes` ' +
        'fixes it for function-typed properties and deliberately not for methods. That is a ' +
        'documented trade, not a bug, and it is the kind of thing worth checking in any ' +
        'language you rely on.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — decide subtyping, and hunt for the unsound pairs',
        markup: root.SubtypingTemplate.render()
      },
      diagram: diagram(),
      insight: '**"Arguments are contravariant" is a sentence everyone can recite and almost ' +
        'nobody applies at the moment it matters, which is when someone proposes narrowing a ' +
        'callback\'s parameter type.** A handler declared `(e: Event) => void` can be passed ' +
        'where `(e: ClickEvent) => void` is expected, because it copes with anything the caller ' +
        'sends. The reverse — passing a `(e: ClickEvent) => void` where `(e: Event) => void` is ' +
        'wanted — is the unsound direction, and it is the one people reach for because the ' +
        'narrower type looks "more precise". It is more precise about what it accepts, which is ' +
        'exactly the wrong direction for a parameter. The test that settles it every time: ask ' +
        'who supplies the value. If the caller supplies it, narrowing is unsafe; if the ' +
        'function returns it, narrowing is fine.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SubtypingTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const questionsFor = root.Helpers.memoise(function () {
    return pairs().map(function (pair) {
      const result = root.Subtyping.isSubtype(pair[0], pair[1]);

      return { left: root.Subtyping.showType(pair[0], false),
        right: root.Subtyping.showType(pair[1], false),
        ok: result.ok, rule: result.rule, why: result.why, node: result };
    });
  });

  const latticeFor = root.Helpers.memoise(function () {
    return latticePairs().map(function (pair) {
      return { left: root.Subtyping.showType(pair[0], false),
        right: root.Subtyping.showType(pair[1], false),
        join: root.Subtyping.showType(root.Subtyping.join(pair[0], pair[1]), false),
        meet: root.Subtyping.showType(root.Subtyping.meet(pair[0], pair[1]), false) };
    });
  });

  const unsoundFor = root.Helpers.memoise(function () {
    return root.Subtyping.unsoundWitnesses();
  });

  const varianceFor = root.Helpers.memoise(function () {
    return root.Subtyping.varianceTable();
  });

  function update() {
    const values = panel.values();
    const index = Number(values['var-pair']);
    const question = questionsFor('all')[index];
    const lattice = latticeFor('all')[Number(values['var-lattice'])];

    paintMetrics(question, lattice);
    paintVariance();
    paintDerivation(question);
    paintQuestions(index);
    paintUnsound();
    paintLattice(Number(values['var-lattice']));
  }

  function paintMetrics(question, lattice) {
    const holes = unsoundFor('all');

    root.MetricGrid.update({
      'var-verdict': { value: question.ok ? 'yes' : 'no',
        note: question.ok ? 'every premise the rule needed was derivable'
          : question.why },
      'var-rule': { value: question.rule,
        note: 'the outermost rule applied; its premises appear in the derivation below' },
      'var-join': { value: lattice.join,
        note: 'the meet is ' + lattice.meet + ' — the greatest type below both' },
      'var-holes': { value: root.Format.exact(holes.length),
        note: holes.length > 0
          ? 'each one comes with a value that breaks it, found by search'
          : 'no covariant mutable pair in this hierarchy admits a bad store' }
    });
  }

  function paintVariance() {
    root.jQuery('#var-table tbody').html(varianceFor('rows').map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.variance +
        '</td><td>' + (row.widening ? 'yes' : 'no') + '</td><td>' +
        (row.narrowing ? 'yes' : 'no') + '</td><td>' +
        (row.sound ? 'yes' : 'NO — see the witness below') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('var-table-caption',
      'Read the two middle columns as "which direction may I substitute". A covariant ' +
      'container widens: a List<Integer> is usable as a List<Number>, because you can only ' +
      'read from it. A contravariant one narrows: a Sink<Number> is usable as a Sink<Integer>, ' +
      'because you can only write to it and it copes with anything an Integer sink would ' +
      'accept. An invariant one does neither, because it can be read AND written. The last row ' +
      'pair is the same container declared two ways, and only one of them is sound.');
  }

  function paintDerivation(question) {
    root.jQuery('#var-derivation').html(root.DerivationView.markup(question.node, {
      read: function (node) {
        return { rule: node.rule, ok: node.ok,
          statement: (node.label ? node.label + ': ' : '') + node.left + ' ≤ ' + node.right,
          note: node.ok ? '' : node.why, children: node.children || [] };
      }, maxDepth: 6 }));

    root.Helpers.setText('var-derivation-caption',
      'On a function question, look at the premise labelled "argument (flipped)": the two ' +
      'types have swapped sides. That single swap is the contravariance rule, and it is why ' +
      '`Integer → Integer ≤ Number → Number` fails — the premise it needs is `Number ≤ ' +
      'Integer`, which is false. Everything else in the tree is ordinary structural recursion.');
  }

  function paintQuestions(selected) {
    root.jQuery('#var-questions tbody').html(questionsFor('all').map(function (row, index) {
      return '<tr' + (index === selected ? ' style="font-weight:600"' : '') +
        '><td class="mono">' + root.Helpers.escapeHtml(row.left) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.right) + '</td><td>' + (row.ok ? 'yes' : 'no') +
        '</td><td class="mono">' + row.rule + '</td><td>' +
        root.Helpers.escapeHtml(row.why) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('var-questions-caption',
      'Ten questions covering width, depth, permutation, both directions of the function rule, ' +
      'and all four variance behaviours. The Map row is the one that shows variance is ' +
      'per-parameter rather than per-type: `Map<String, Integer> ≤ Map<String, Number>` holds ' +
      'because the value is covariant, and `Map<Integer, Integer> ≤ Map<Number, Number>` fails ' +
      'because the key is invariant. A container is not "covariant"; each of its parameters is.');
  }

  function paintUnsound() {
    const rows = unsoundFor('all');

    root.jQuery('#var-unsound tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.allowed) +
        '</td><td class="mono">' + row.stored + '</td><td>' +
        root.Helpers.escapeHtml(row.breaks) + '</td><td>' +
        (row.invariantRejects ? 'yes' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('var-unsound-caption',
      'Nothing here was written down as a known bug. The search takes every pair the covariant ' +
      'rule admits and asks whether some value the SUPERTYPE accepts is not accepted by the ' +
      'narrower element type; when the answer is yes, that value is a store that must fail at ' +
      'run time. Two pairs come back with a witness, and the last column confirms the ' +
      'invariant declaration rejects both — which is the check that the fix actually fixes it, ' +
      'rather than merely sounding stricter. This is `ArrayStoreException`, derived rather ' +
      'than recalled.');
  }

  function paintLattice(selected) {
    root.jQuery('#var-lattice-table tbody').html(latticeFor('all').map(function (row, index) {
      return '<tr' + (index === selected ? ' style="font-weight:600"' : '') +
        '><td class="mono">' + root.Helpers.escapeHtml(row.left) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.right) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.join) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.meet) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('var-lattice-caption',
      'A join is what a language must infer for a conditional whose branches have different ' +
      'types, and the record row shows what that costs: the join of two records is the fields ' +
      'they share, so information is lost the moment two shapes differ. The meet of two ' +
      'records with a conflicting field is ⊥ — no value can be both an Integer and a Double ' +
      'there — which is why an intersection type in a real language is either rejected or ' +
      'quietly uninhabited. When a compiler infers a surprisingly wide type for a ternary, ' +
      'this table is the reason.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
