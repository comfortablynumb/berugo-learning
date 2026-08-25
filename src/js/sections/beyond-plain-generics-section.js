/**
 * Section: Beyond plain generics.
 *
 * The measurement is the dictionary expression. `Eq (List (List Int))`
 * resolves to `dEqLista(dEqLista(dEqInt))` — three dictionaries, built at
 * compile time, three levels deep — and the runtime cost of `==` on a nested
 * list is a record field lookup, not a search. Turn superclasses on and
 * `Ord (List Int)` grows to five dictionaries, because Ord carries Eq.
 *
 * The second is coherence. With the two overlapping instances in scope,
 * `Show (List Int)` either fails to resolve or resolves to a DIFFERENT
 * dictionary than it did without them — same program, different meaning, which
 * is why coherence is a rule and not an optimisation.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'beyond-plain-generics';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — elaborating a constraint into an explicit dictionary argument',
      caption: 'A constrained signature is not a new kind of function; it is an ordinary ' +
        'function with an argument you did not write. `Eq a => a → a → Bool` elaborates to ' +
        '`EqDict a → a → a → Bool`, and every call site is rewritten to pass the dictionary the ' +
        'compiler found for the type that turned up there. An instance with its own context — ' +
        '`Eq a => Eq [a]` — elaborates to a FUNCTION from a dictionary to a dictionary, which ' +
        'is why a nested type builds a nested expression. All of this happens at compile time; ' +
        'what survives to run time is a record and a field access.',
      definition: [
        'graph TD',
        'A["equals :: Eq a => a → a → Bool"] --> B["elaborates to equals :: EqDict a → a → a → Bool"]',
        'C["instance Eq Int"] --> D["a constant dictionary dEqInt"]',
        'E["instance Eq a => Eq [a]"] --> F["a function dEqList : EqDict a → EqDict [a]"]',
        'G["call site: equals xs ys where xs :: [[Int]]"] --> H["resolve Eq [[Int]]"]',
        'H --> I["dEqList (dEqList dEqInt)"]',
        'I --> J["equals (dEqList (dEqList dEqInt)) xs ys"]',
        'D --> I',
        'F --> I'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A constraint is an argument, and dictionary passing is the whole translation.** ' +
        '`Eq a =>` becomes a record of method implementations passed at every call site. Once ' +
        'you see that, "what does a type class cost at run time" has a concrete answer: one ' +
        'extra argument and one field lookup, unless the compiler specialises it away.',
      '**An instance with a context is a function from dictionaries to dictionaries.** ' +
        '`instance Eq a => Eq [a]` is not a value; it is `EqDict a → EqDict [a]`. Resolving ' +
        '`Eq [[Int]]` therefore builds `dEqList (dEqList dEqInt)` — a structure whose shape ' +
        'mirrors the type\'s shape, assembled entirely before the program runs.',
      '**Superclasses are dictionaries stored inside dictionaries.** `class Eq a => Ord a` ' +
        'means an Ord dictionary carries an Eq dictionary in a field, so a function with only ' +
        'an `Ord a` constraint can still call `==`. The demo shows the count jumping when you ' +
        'turn superclasses on, which is exactly the extra structure being built.',
      '**Coherence is the rule that a constraint resolves the same way everywhere, and it is ' +
        'not free.** If two instances match, the program\'s meaning depends on which one the ' +
        'compiler picked, and the same expression in two modules could mean two things. The ' +
        'demo turns the overlapping instances on and shows the dictionary changing — that is ' +
        'the failure coherence exists to prevent.',
      '**Orphan instances are the practical way coherence breaks.** An instance defined where ' +
        'neither the class nor the type lives can be imported by one module and not another. ' +
        'Two libraries can each define one, and a program depending on both has two answers for ' +
        'the same question. This is why Rust\'s orphan rule is a hard error and why Haskell ' +
        'warns.',
      '**Ambiguity is a different failure: a variable no call site can determine.** ' +
        '`show (read s)` names a type nothing constrains — the string is parsed to something ' +
        'and immediately printed, and nothing says what. No dictionary can be chosen because ' +
        'there is no type to choose one for. The fix is always an annotation, because the ' +
        'information genuinely is not in the program.',
      '**Traits, interfaces and type classes differ mainly in who chooses and when.** A Java ' +
        'interface: the object carries its own method table, chosen when it was constructed. A ' +
        'type class: the call site chooses, at compile time, from the type. A Rust `dyn Trait`: ' +
        'a vtable, chosen at construction, exactly like the interface. The dictionary ' +
        'translation makes all three the same picture with a different arrow.',
      '**Higher-kinded types, associated types, GADTs and dependent types are all "let the ' +
        'type language say more".** A higher-kinded parameter abstracts over a type ' +
        'constructor rather than a type, which is what makes `Functor f` expressible. An ' +
        'associated type lets an instance choose a type, not just a method. A GADT lets a ' +
        'pattern match REFINE a type. Each buys expressiveness and each costs inference, ' +
        'which is the same trade System F made.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — elaborate a constraint into the dictionary the compiler passes',
        markup: root.TypeClassTemplate.render()
      },
      diagram: diagram(),
      insight: '**Once you can see the dictionary, every "which one is faster" argument about ' +
        'interfaces, traits and type classes becomes answerable instead of tribal.** A type ' +
        'class resolved at compile time can be specialised: the compiler knows the dictionary, ' +
        'inlines the method, and the abstraction costs nothing. A `dyn Trait` or a Java ' +
        'interface carries its table at run time, so the call is indirect and the body cannot ' +
        'be inlined across it — which is exactly the cost, and exactly why Rust makes you write ' +
        '`dyn` to opt into it. The dictionary picture also predicts the failure modes: a ' +
        'deeply nested constraint builds a deep structure, a constraint on a type variable ' +
        'that is only known at run time cannot be built at all, and a library that exposes a ' +
        'constrained signature has committed to an argument its callers must supply forever.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TypeClassTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function optionsFrom(values) {
    return { superclasses: values['tcl-superclasses'] === 'on',
      risky: values['tcl-risky'] !== 'off',
      allowOverlap: values['tcl-risky'] === 'allow' };
  }

  const analyseFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.TypeClasses.analyse(parts[0], { superclasses: parts[1] === 'on',
      risky: parts[2] !== 'off', allowOverlap: parts[2] === 'allow' });
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.TypeClasses.sweep({ superclasses: parts[0] === 'on',
      risky: parts[1] !== 'off', allowOverlap: parts[1] === 'allow' });
  });

  const coherenceFor = root.Helpers.memoise(function () {
    return root.TypeClasses.coherenceContrast();
  });

  function update() {
    const values = panel.values();
    const key = values['tcl-goal'] + '\n' + values['tcl-superclasses'] + '\n' +
      values['tcl-risky'];
    const state = analyseFor(key);

    paintMetrics(state);
    paintDictionary(state);
    paintTree(state);
    paintGoals(values['tcl-superclasses'] + '\n' + values['tcl-risky']);
    paintCoherence();
    paintInstances(optionsFrom(values));
  }

  function verdictOf(state) {
    if (state.ok) return 'resolved';
    if (state.ambiguous) return 'ambiguous';
    if (state.overlap) return 'overlapping';
    return 'no instance';
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'tcl-dictionaries': { value: root.Format.exact(state.dictionaries),
        note: state.ok ? 'every one of them constructed before the program runs'
          : 'resolution did not finish, so nothing was built' },
      'tcl-depth': { value: root.Format.exact(state.depth),
        note: 'each level is one instance whose context had to be solved first' },
      'tcl-methods': { value: state.methods.length > 0 ? state.methods.join(', ') : '—',
        note: state.methods.length > 0
          ? 'the class methods plus everything its superclasses contribute'
          : 'no dictionary, so no methods are available' },
      'tcl-verdict': { value: verdictOf(state), note: state.why || 'the constraint was solved' }
    });
  }

  function paintDictionary(state) {
    root.jQuery('#tcl-dictionary').html(
      '<div>constraint &nbsp; ' + root.Helpers.escapeHtml(state.constraint) + '</div>' +
      '<div style="margin-top:.4rem">elaborates to &nbsp; ' +
      root.Helpers.escapeHtml(state.dictionary) + '</div>' +
      (state.ok ? '' : '<div style="margin-top:.4rem">' +
        root.Helpers.escapeHtml(state.why) + '</div>'));

    root.Helpers.setText('tcl-dictionary-caption',
      'That expression is what the compiler inserts at the call site. Read it inside out: the ' +
      'innermost dictionary is for the base type, and each layer is an instance whose context ' +
      'had to be satisfied first. Nothing here is a run-time search — the whole structure is ' +
      'decided during type checking, which is why a type class can be specialised away ' +
      'entirely and an interface\'s vtable cannot.');
  }

  function paintTree(state) {
    root.jQuery('#tcl-tree').html(root.DerivationView.markup(state.tree, {
      read: function (node) {
        return { rule: node.instance || (node.ok ? 'solved' : 'unsolved'), ok: node.ok !== false,
          statement: node.goal, note: node.ok === false ? node.why : '',
          children: node.children || [] };
      }, maxDepth: 7 }));

    root.Helpers.setText('tcl-tree-caption',
      'Premises above the bar are the context of the instance below it — the constraints that ' +
      'had to be solved before this dictionary could be built. The rule name on the right is ' +
      'the instance chosen. Turn superclasses on and extra premises appear that the instance ' +
      'itself did not ask for: those are the superclass dictionaries being packed in.');
  }

  function paintGoals(key) {
    const rows = sweepFor(key);
    const solved = rows.filter(function (row) { return row.ok; }).length;

    root.jQuery('#tcl-goals tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.constraint) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.dictionary.slice(0, 44)) +
        '</td><td class="mono">' + row.dictionaries + '</td><td class="mono">' + row.depth +
        '</td><td>' + root.Helpers.escapeHtml(row.ok ? row.note : row.why) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tcl-goals-caption',
      solved + ' of ' + rows.length + ' goals resolve. The three that do not fail for three ' +
      'different reasons, and a compiler has to say which: `Eq (List Double)` has an instance ' +
      'for the shape but not for the element, `Num (List Int)` has none for the shape at all, ' +
      'and `Show a` cannot be solved by any instance because nothing determines what `a` is. ' +
      'The last is the one that surprises people, because the code looks complete — it is ' +
      'complete, and still underdetermined.');
  }

  function paintCoherence() {
    const contrast = coherenceFor('pair');

    root.jQuery('#tcl-coherence tbody').html(
      '<tr><td>base only</td><td>' + (contrast.plain.ok ? 'resolved' : 'refused') +
      '</td><td class="mono">' + root.Helpers.escapeHtml(contrast.plain.dictionary) +
      '</td></tr>' +
      '<tr><td>plus the overlapping instance, coherence enforced</td><td>' +
      (contrast.strict.ok ? 'resolved' : 'refused') + '</td><td class="mono">' +
      root.Helpers.escapeHtml(contrast.strict.ok ? contrast.strict.dictionary
        : contrast.strict.why.slice(0, 60)) + '</td></tr>' +
      '<tr><td>plus the overlapping instance, most specific wins</td><td>' +
      (contrast.permissive.ok ? 'resolved' : 'refused') + '</td><td class="mono">' +
      root.Helpers.escapeHtml(contrast.permissive.dictionary) + '</td></tr>');

    root.Helpers.setText('tcl-coherence-caption',
      'One goal — `Show (List Int)` — and three answers. Without the extra instance it builds ' +
      '`dShowLista(dShowInt)`. With the extra instance and coherence enforced, it refuses and ' +
      'names both candidates. With overlap allowed, it silently builds a DIFFERENT dictionary. ' +
      'That third row is the danger: the program still compiles, still runs, and now prints ' +
      'lists differently depending on which modules happened to be imported. This is why ' +
      'overlapping instances are a language extension you have to ask for and why the orphan ' +
      'rule exists.');
  }

  function paintInstances(options) {
    const pool = root.TypeClasses.INSTANCES.concat(options.risky ? root.TypeClasses.RISKY : []);

    root.jQuery('#tcl-instances tbody').html(pool.map(function (instance) {
      return '<tr><td class="mono">' + instance.className + '</td><td class="mono">' +
        root.Helpers.escapeHtml(instance.head) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(instance.context.join(', ') || '—') + '</td><td>' +
        instance.home + (instance.risk ? ' — ' + instance.risk : '') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tcl-instances-caption',
      'The context column is the whole difference between a constant dictionary and a ' +
      'function. `Eq Int` has none, so it is a value. `Eq (List a)` requires `Eq a`, so it is a ' +
      'function waiting for one. The "defined in" column is where the orphan problem lives: an ' +
      'instance whose home is neither the class\'s module nor the type\'s module can be in ' +
      'scope in one file and not another, which is exactly how two parts of one program end up ' +
      'disagreeing about what equality means.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
