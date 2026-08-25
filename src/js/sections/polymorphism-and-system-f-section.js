/**
 * Section: Polymorphism and System F.
 *
 * The measurement is the inhabitant count. `∀α. α → α` has exactly one closed
 * normal form and it is the identity; `∀α. α → α → α` has exactly two;
 * `∀α. α` and `∀α β. α → β` have none. Those counts are produced by
 * enumeration, and the enumeration is only claimed where it is complete —
 * every argument position of those types is a bare type variable, so no
 * application can be built and abstractions plus variables are all there is.
 *
 * The second is the rank contrast: the term Hindley–Milner rejects, accepted
 * here because the ∀ is written down.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'polymorphism-and-system-f';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an existential type packing a representation with its operations',
      caption: 'An interface is an existential type. "There exists some representation τ, ' +
        'together with these operations over it" is exactly what a module signature, a Java ' +
        'interface and a Rust `dyn Trait` all say. System F does not need a new construct for ' +
        'it: `∃α. τ` is definable as `∀β. (∀α. τ → β) → β` — a package is a function that ' +
        'takes a consumer, and the consumer is polymorphic in the representation, so it cannot ' +
        'inspect it. That is where information hiding comes from. It is not enforced by a ' +
        'visibility keyword; it is enforced by parametricity, which says the consumer has no ' +
        'operation on α except the ones the package handed it.',
      definition: [
        'graph TD',
        'A["a package: a concrete type τ plus operations over τ"] --> B["pack as ∃α. Ops α"]',
        'B --> C["encoded as ∀β. (∀α. Ops α → β) → β"]',
        'C --> D["a client supplies a consumer polymorphic in α"]',
        'D --> E["parametricity: the consumer cannot inspect α"]',
        'E --> F["so the representation is hidden — by the type, not by a keyword"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**System F adds two constructs and nothing else: `Λα. e` and `e [T]`.** Hindley–Milner ' +
        'hides both — it inserts the quantifier at let and the instantiation at every use. ' +
        'Writing them down is what buys everything in this section, and what costs decidable ' +
        'inference.',
      '**Type inference for System F is undecidable, which is a theorem, not an engineering ' +
        'gap.** Wells proved it in 1994. That is why `Collections.<String>emptyList()` exists ' +
        'in Java, why Rust has the turbofish, and why Haskell requires an annotation the moment ' +
        'you turn on higher-rank types. Every one of those is a type application that the ' +
        'compiler could not recover.',
      '**Rank is about where the ∀ appears, and rank 2 is where HM stops.** `∀α. α → α` is ' +
        'rank 1: the quantifier is outermost. `(∀α. α → α) → Nat` is rank 2: a quantifier to ' +
        'the left of an arrow, so the ARGUMENT is polymorphic and the function may use it at ' +
        'several types. HM cannot express that, which is why `λid. pair (id 3) (id true)` is ' +
        'rejected there and accepted here.',
      '**Parametricity is the payoff, and it is a theorem about what a type forbids.** A closed ' +
        'term of type `∀α. α → α` has no operation available on its argument — it cannot ' +
        'compare it, print it or branch on it, because α could be anything. So it can only ' +
        'return it. The demo counts the closed normal forms and finds exactly one.',
      '**A free theorem is what you get for nothing from a signature.** `∀α. List α → List α` ' +
        'can only permute, drop and duplicate elements; it cannot invent one or inspect one. ' +
        '`<T>(items: T[]) => T[]` in TypeScript says the same, and that is a genuinely useful ' +
        'thing to know in review — the function\'s behaviour cannot depend on the element ' +
        'values, only on their positions.',
      '**Existential types are interfaces, and abstraction is enforced by parametricity.** ' +
        '`∃α. { make: α, use: α → Nat }` says a representation exists and you may not look at ' +
        'it. The consumer is polymorphic in α, so it has no way to. That is exactly why a ' +
        'module boundary hides its representation, and why casting past it is a hole in the ' +
        'system rather than a feature of it.',
      '**Types erase, and the erased term is the one that runs.** `Λα. λx: α. x` erases to ' +
        '`λx. x`, and every type application vanishes. That is what "types have no runtime ' +
        'cost" means precisely, and what generic erasure in Java is. It is also why runtime ' +
        'reflection over a generic type cannot work without adding something back.',
      '**Ad-hoc polymorphism is the contrast, and it is a different mechanism.** Parametric ' +
        'polymorphism works uniformly on every type BECAUSE it cannot inspect them. Ad-hoc ' +
        'polymorphism — overloading, type classes, traits — picks a different implementation ' +
        'per type, which means it must know the type. The next section shows what that costs: ' +
        'a dictionary passed at runtime.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — type a polymorphic term, and count what a type can contain',
        markup: root.SystemFTemplate.render()
      },
      diagram: diagram(),
      insight: '**Parametricity is a reasoning tool you can use in code review this afternoon, ' +
        'and it is a theorem rather than a convention.** When you read ' +
        '`function pick<T>(items: T[], n: number): T[]`, you know without opening the body that ' +
        'it cannot sort by value, cannot filter on content, and cannot fabricate an element — ' +
        'its behaviour depends on the array\'s length and on `n`, and on nothing else. That ' +
        'narrows a review from "read every line" to "check the index arithmetic". The corollary ' +
        'is the useful design rule: the more polymorphic a signature, the fewer things it can ' +
        'do, and the less of it you have to read. Making a helper generic when it does not need ' +
        'to inspect its argument is not an abstraction for its own sake — it is a way of ' +
        'writing down, in a form the compiler checks, that the helper does not care.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SystemFTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const analyseFor = root.Helpers.memoise(function (source) {
    return root.SystemFLab.analyse(source);
  });

  const sweepFor = root.Helpers.memoise(function () { return root.SystemFLab.sweep(); });
  const freeFor = root.Helpers.memoise(function () { return root.SystemF.freeTheorems(); });
  const erasureFor = root.Helpers.memoise(function () { return root.SystemFLab.erasureTable(); });
  const rankFor = root.Helpers.memoise(function () { return root.SystemFLab.rankContrast(); });

  function update() {
    const values = panel.values();
    const state = analyseFor(values['syf-term']);
    const chosen = freeFor('all')[Number(values['syf-type'])] || freeFor('all')[0];

    paintMetrics(state, chosen);
    paintFree(Number(values['syf-type']));
    paintDerivation(state);
    paintFixtures();
    paintErasure();
    paintRank();
  }

  function paintMetrics(state, chosen) {
    root.MetricGrid.update({
      'syf-type-of': { value: state.ok ? state.type : 'rejected',
        note: state.ok ? 'every quantifier and every instantiation is written in the term'
          : state.why },
      'syf-nodes': { value: root.Format.exact(state.nodes),
        note: 'height ' + state.height + ' — T-TAbs and T-TApp are two of the five rules' },
      'syf-erased': { value: state.erased.length + ' characters',
        note: 'from ' + state.source.length + ': ' + state.erased },
      'syf-inhabitants': { value: root.Format.exact(chosen.count),
        note: chosen.complete
          ? 'closed normal forms of ' + chosen.name + ', enumerated exhaustively'
          : 'enumeration is incomplete for this type — applications are possible' }
    });
  }

  function paintFree(selected) {
    const rows = freeFor('all');

    root.jQuery('#syf-free tbody').html(rows.map(function (row, index) {
      return '<tr' + (index === selected ? ' style="font-weight:600"' : '') +
        '><td class="mono">' + root.Helpers.escapeHtml(row.name) + '</td><td class="mono">' +
        row.count + (row.matches ? '' : ' ← unexpected') + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.terms.join('  ,  ') || 'none exist') + '</td><td>' +
        root.Helpers.escapeHtml(row.claim) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('syf-free-caption',
      'These are counts, not assertions: the enumerator builds every closed normal form of the ' +
      'type up to a depth bound and prints them. `∀α. α → α` has exactly one and it is the ' +
      'identity — that is parametricity, arrived at by exhaustion. `∀α. α` has none, which is ' +
      'why it is the empty type and why a function claiming to return one can only diverge or ' +
      'throw. The enumeration is only complete when every argument position of the type is a ' +
      'bare type variable, because then nothing in scope can be applied to anything; the ' +
      'metric says so rather than leaving it implied.');
  }

  function paintDerivation(state) {
    root.jQuery('#syf-derivation').html(root.DerivationView.markup(state.derivation,
      { maxDepth: 8 }));

    root.Helpers.setText('syf-derivation-caption',
      'Five rules: the three from the simply typed calculus, plus T-TAbs which adds a type ' +
      'variable to the context, and T-TApp which substitutes a type into a ∀. Watch the ' +
      'context on the left of the turnstile on a Λ term — the type variable appears there ' +
      'exactly as a term variable would, and that is all a type abstraction is.');
  }

  function paintFixtures() {
    const rows = sweepFor('all');
    const agreeing = rows.filter(function (row) { return row.matches; }).length;

    root.jQuery('#syf-fixtures tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.source) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.ok ? row.type
          : 'rejected: ' + row.why.slice(0, 48)) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.expected.slice(0, 46)) +
        '</td><td>' + (row.matches ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('syf-fixtures-caption',
      agreeing + ' of ' + rows.length + ' fixtures behave as predicted, and the last row is ' +
      'the one to read twice. `Λa. λx: a. succ x` is rejected because inside the type ' +
      'abstraction, `a` is an opaque variable — `succ` wants a Nat and there is no way to know ' +
      'that `a` is one. That is not a limitation of the checker; it is parametricity being ' +
      'enforced. A body that could inspect its type parameter would break every free theorem ' +
      'in the table above.');
  }

  function paintErasure() {
    const rows = erasureFor('all');
    const removed = rows.reduce(function (sum, row) { return sum + row.removed; }, 0);

    root.jQuery('#syf-erasure tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.source) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.erased) +
        '</td><td class="mono">' + row.typed + ' → ' + row.erasedLength +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.type) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('syf-erasure-caption',
      'Erasure deletes every annotation, every Λ and every type application, leaving an ' +
      'ordinary untyped lambda term — ' + root.Format.exact(removed) + ' characters removed ' +
      'across these ' + rows.length + ' rows. Two of the erased terms are identical even ' +
      'though their typed forms differ, which is the point: the types were there for the ' +
      'checker and are gone by run time. That is exactly Java\'s generic erasure, and exactly ' +
      'why `List<String>` and `List<Integer>` are the same class at run time.');
  }

  function paintRank() {
    const contrast = rankFor('pair');

    root.jQuery('#syf-rank tbody').html(
      '<tr><td>System F</td><td class="mono">' +
      root.Helpers.escapeHtml(contrast.written.source) + '</td><td class="mono">' +
      root.Helpers.escapeHtml(contrast.written.ok ? contrast.written.type
        : contrast.written.why) + '</td></tr>' +
      '<tr><td>Hindley–Milner</td><td class="mono">' +
      root.Helpers.escapeHtml(contrast.inferred.source) + '</td><td class="mono">' +
      root.Helpers.escapeHtml(contrast.inferred.ok ? contrast.inferred.scheme
        : 'rejected: ' + contrast.inferred.why) + '</td></tr>');

    root.Helpers.setText('syf-rank-caption', contrast.reason +
      '. The two rows are the same program, and the difference is entirely in what the type ' +
      'language can say. This is the trade every language with generics has had to make: keep ' +
      'inference and stay at rank 1, or admit higher rank and require annotations exactly ' +
      'where inference gives out. Haskell picked the second and gates it behind a language ' +
      'extension; Java and C# picked the first and offer explicit type arguments as the escape.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
