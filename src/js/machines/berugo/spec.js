/**
 * The Berugo language specification, machine-readable.
 *
 * This file is the deliverable the rest of the milestone is checked against.
 * Every feature carries four things — its grammar production, its typing rule,
 * its evaluation rule and a runnable example — and each is cross-referenced to
 * the compiler stage that implements it. That is not documentation: the spec
 * browser renders it, the conformance suite runs the examples, and a test
 * asserts that every stage the spec names actually exists.
 *
 * The non-goals are part of the spec and are listed here rather than left
 * implicit. A language with no stated non-goals grows one feature at a time
 * until nobody can say what it is, and the two deferred here — exceptions and
 * mutation of captured variables — are deferred because each creates specific
 * work in a later milestone (stack unwinding in M30, SSA and escape analysis
 * in M29) that is worth meeting on its own.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Spec = api;
  }
}(this, function () {
  'use strict';

  const VERSION = 'Berugo v1 (M28)';

  /**
   * The constructors of the one sum type v1 has. The parser needs this list:
   * without it, `none` in a pattern is an ordinary variable binding, which
   * matches everything — so a match that looks exhaustive tests nothing and
   * the checker approves it for the wrong reason. Languages that use case to
   * distinguish the two (Rust, Haskell) are avoiding exactly this list.
   */
  const SUM_CONSTRUCTORS = { some: 1, none: 0 };

  /** The pipeline, and which milestone builds each stage. */
  const STAGES = [
    { id: 'lex', name: 'lex', milestone: 'M28', section: '28.2',
      takes: 'source text', gives: 'a token stream with spans and trivia' },
    { id: 'parse', name: 'parse', milestone: 'M28', section: '28.3',
      takes: 'tokens', gives: 'an AST with a span on every node' },
    { id: 'resolve', name: 'resolve', milestone: 'M28', section: '28.5',
      takes: 'an AST', gives: 'a binding table and a scope tree' },
    { id: 'typecheck', name: 'typecheck', milestone: 'M28', section: '28.6',
      takes: 'an AST and a binding table', gives: 'a type per node' },
    { id: 'desugar', name: 'desugar', milestone: 'M28', section: '28.7',
      takes: 'a checked AST', gives: 'core-language nodes, spans preserved' },
    { id: 'ir', name: 'lower to IR', milestone: 'M29', section: '—',
      takes: 'core', gives: 'SSA' },
    { id: 'optimise', name: 'optimise', milestone: 'M29', section: '—',
      takes: 'SSA', gives: 'better SSA' },
    { id: 'codegen', name: 'emit bytecode', milestone: 'M30', section: '—',
      takes: 'SSA', gives: 'bytecode' },
    { id: 'run', name: 'run', milestone: 'M30', section: '—',
      takes: 'bytecode', gives: 'a value' },
    { id: 'collect', name: 'collect garbage', milestone: 'M31', section: '—',
      takes: 'a heap', gives: 'a smaller heap' }
  ];

  /**
   * Every feature of the language. `grammar` is the production, `typing` the
   * rule, `evaluation` the dynamic rule, and `example` a program the
   * conformance suite runs. `stage` names the pass that first has to care.
   */
  const FEATURES = [
    { id: 'literals', name: 'Literals', stage: 'lex',
      grammar: 'literal → NUMBER | STRING | "true" | "false"',
      typing: 'a numeral is Number, a string literal is String, true and false are Bool',
      evaluation: 'a literal is already a value',
      example: 'let x = 42;',
      note: 'Numeric forms, escapes and interpolation all live in the lexer.' },

    { id: 'names', name: 'Names and let bindings', stage: 'resolve',
      grammar: 'letDecl → "let" NAME (":" type)? "=" expr ";"',
      typing: 'the body is checked, generalised, and bound — this is the generalisation point',
      evaluation: 'evaluate the right-hand side, extend the environment, continue',
      example: 'let n = 3; let m = n + 1;',
      note: 'Resolution is a separate pass producing a binding table, so the ' +
        'checker and the editor agree about what a name means.' },

    { id: 'operators', name: 'Operators and precedence', stage: 'parse',
      grammar: 'binary → expr OP expr, with binding powers from the precedence table',
      typing: 'arithmetic takes two Numbers, comparison gives Bool, && and || take Bools',
      evaluation: 'left to right, and && and || short-circuit',
      example: 'let ok = 1 + 2 * 3 == 7 && true;',
      note: 'Pratt parsing from M25; the same table drives the pretty printer, ' +
        'which is why a disagreement between them is a real bug.' },

    { id: 'functions', name: 'Functions and closures', stage: 'resolve',
      grammar: 'fnDecl → "fn" NAME "(" params ")" block;  lambda → "fn" "(" params ")" "=>" expr',
      typing: 'parameters may be annotated; the arrow type is inferred otherwise',
      evaluation: 'a function value captures the environment it was created in',
      example: 'fn add(a, b) { return a + b; } let inc = fn(x) => add(x, 1);',
      note: 'Capture analysis in the resolver is what M29 needs for escape analysis.' },

    { id: 'records', name: 'Records', stage: 'typecheck',
      grammar: 'record → "{" (NAME ":" expr ("," NAME ":" expr)*)? "}";  access → expr "." NAME',
      typing: 'a record literal has the record type of its fields; access requires the field',
      evaluation: 'a record is a value; access selects a field',
      example: 'let p = { x: 1, y: 2 }; let a = p.x;',
      note: 'Structural, not nominal — two records with the same fields have the same type.' },

    { id: 'arrays', name: 'Arrays', stage: 'typecheck',
      grammar: 'array → "[" (expr ("," expr)*)? "]";  index → expr "[" expr "]"',
      typing: 'every element must have the same type; indexing takes a Number',
      evaluation: 'an array is a value; indexing selects an element',
      example: 'let xs = [1, 2, 3]; let first = xs[0];',
      note: 'Homogeneous by design: a heterogeneous array would need a sum type.' },

    { id: 'conditionals', name: 'Conditionals', stage: 'parse',
      grammar: 'if → "if" expr block "else" block',
      typing: 'the condition is Bool and both branches have the same type',
      evaluation: 'evaluate the condition, then exactly one branch',
      example: 'let s = if 1 < 2 { 10 } else { 20 };',
      note: 'An expression, not a statement, so it has a type and both arms must agree.' },

    { id: 'match', name: 'Sum types and pattern matching', stage: 'typecheck',
      grammar: 'match → "match" expr "{" (pattern "=>" expr ",")* "}"',
      typing: 'every arm produces the same type, and the arms must be exhaustive',
      evaluation: 'the first arm whose pattern matches',
      example: 'let d = match some(1) { some(v) => v, none => 0, };',
      note: 'Exhaustiveness comes from M27; a missing case is a compile error ' +
        'with a witness value.' },

    { id: 'loops', name: 'while and for', stage: 'desugar',
      grammar: 'while → "while" expr block;  for → "for" NAME "in" expr block',
      typing: 'the condition is Bool; a for iterates an array and binds the element type',
      evaluation: 'while repeats; for is defined by its desugaring',
      example: 'let total = 0; for v in [1, 2, 3] { total = total + v; }',
      note: 'for desugars to while, which is why the desugaring must preserve ' +
        'break and continue and the original spans.' },

    { id: 'modules', name: 'Modules and imports', stage: 'resolve',
      grammar: 'import → "import" NAME ";"',
      typing: 'an imported module contributes its exported bindings to the scope',
      evaluation: 'a module is evaluated once; imports name its bindings',
      example: 'import math; let r = math.square(4);',
      note: 'Import resolution is part of name resolution, not a preprocessor step.' },

    { id: 'annotations', name: 'Type annotations', stage: 'typecheck',
      grammar: 'type → NAME | type "->" type | "[" type "]" | "{" NAME ":" type "}"',
      typing: 'an annotation switches the checker from infer mode to check mode',
      evaluation: 'annotations are erased and have no runtime meaning',
      example: 'let id: a -> a = fn(x) => x;',
      note: 'Bidirectional checking: annotations are for the error message as ' +
        'much as for the checker.' }
  ];

  /** What v1 deliberately does not have, and where each one is met instead. */
  const NON_GOALS = [
    { id: 'exceptions', name: 'Exceptions',
      why: 'They need stack unwinding, which is worth building on its own.',
      deferredTo: 'M30, where the VM has a call stack to unwind' },
    { id: 'mutable-capture', name: 'Mutating a captured variable',
      why: 'It forces boxing or escape analysis, and both deserve the space.',
      deferredTo: 'M29, alongside SSA' },
    { id: 'generics-syntax', name: 'Explicit type parameters',
      why: 'Inference covers the v1 programs, and rank-1 is decidable.',
      deferredTo: 'never in v1 — M27 shows what writing them would buy' },
    { id: 'traits', name: 'Type classes or traits',
      why: 'Dictionary passing is a whole elaboration pass.',
      deferredTo: 'not planned; M27 shows the mechanism' },
    { id: 'gc-semantics', name: 'Finalisers and weak references',
      why: 'They constrain the collector before it exists.',
      deferredTo: 'M31, with the collector' }
  ];

  /**
   * Where a feature's cost lands. The point of the table is that the two
   * columns are not the same: a construct can be trivial to parse and
   * expensive everywhere after, which is the decision a language designer is
   * actually making.
   */
  const COSTS = [
    { feature: 'operators', parse: 3, later: 1,
      lands: 'the precedence table, and the pretty printer that must agree with it' },
    { feature: 'literals', parse: 3, later: 1, lands: 'lexer modes for interpolation' },
    { feature: 'conditionals', parse: 1, later: 1, lands: 'nothing much' },
    { feature: 'functions', parse: 2, later: 4,
      lands: 'capture analysis, closure conversion, and escape analysis in M29' },
    { feature: 'records', parse: 2, later: 3,
      lands: 'structural unification, field ordering, and layout in M30' },
    { feature: 'arrays', parse: 1, later: 3, lands: 'bounds checks and a heap object in M31' },
    { feature: 'match', parse: 4, later: 5,
      lands: 'exhaustiveness, decision-tree compilation, and every later stage that ' +
        'has to preserve the tree' },
    { feature: 'loops', parse: 2, later: 2,
      lands: 'desugaring, and break/continue surviving it' },
    { feature: 'modules', parse: 1, later: 3,
      lands: 'resolution order, cycles, and separate compilation' },
    { feature: 'annotations', parse: 2, later: 2,
      lands: 'bidirectional checking and the error messages' }
  ];

  /** The conformance programs: every one must lex, parse, resolve and check. */
  const CONFORMANCE = [
    { id: 'arithmetic', source: 'let x = 1 + 2 * 3;', expect: 'Number',
      covers: ['literals', 'names', 'operators'] },
    { id: 'precedence', source: 'let ok = 1 + 2 * 3 == 7;', expect: 'Bool',
      covers: ['operators'] },
    { id: 'let-chain', source: 'let a = 2; let b = a * a; let c = b + a;', expect: 'Number',
      covers: ['names'] },
    { id: 'function', source: 'fn add(a, b) { return a + b; } let s = add(1, 2);',
      expect: 'Number', covers: ['functions'] },
    { id: 'closure',
      source: 'fn adder(n) { return fn(x) => x + n; } let inc = adder(1); let r = inc(41);',
      expect: 'Number', covers: ['functions'] },
    /* A let INSIDE a function body. The other fourteen programs happen not to
       have one, and the type checker crashed on every such program for as long
       as that was true — fifteen green rows saying nothing about a construct
       nobody had written down. Coverage is only as good as the shapes in it. */
    { id: 'local-let',
      source: 'fn scaled(n) { let factor = 3; let out = n * factor; return out; } let s = scaled(4);',
      expect: 'Number', covers: ['functions', 'names'] },
    { id: 'record', source: 'let p = { x: 1, y: 2 }; let a = p.x + p.y;', expect: 'Number',
      covers: ['records'] },
    { id: 'array', source: 'let xs = [1, 2, 3]; let f = xs[0];', expect: 'Number',
      covers: ['arrays'] },
    { id: 'conditional', source: 'let s = if 1 < 2 { 10 } else { 20 };', expect: 'Number',
      covers: ['conditionals'] },
    { id: 'match', source: 'let d = match some(1) { some(v) => v, none => 0, };',
      expect: 'Number', covers: ['match'] },
    { id: 'while', source: 'let i = 0; while i < 3 { i = i + 1; }', expect: 'Unit',
      covers: ['loops'] },
    { id: 'for', source: 'let t = 0; for v in [1, 2, 3] { t = t + v; }', expect: 'Unit',
      covers: ['loops'] },
    { id: 'polymorphic', source: 'fn id(x) { return x; } let a = id(1); let b = id(true);',
      expect: 'Bool', covers: ['functions', 'annotations'] },
    { id: 'annotated', source: 'let n: Number = 1 + 1;', expect: 'Number',
      covers: ['annotations'] },
    { id: 'nested', source: 'let r = { p: { x: 1 }, q: [1, 2] }; let v = r.p.x + r.q[1];',
      expect: 'Number', covers: ['records', 'arrays'] },
    { id: 'string', source: 'let greeting = "hello";', expect: 'String',
      covers: ['literals'] },
    /* Modules had no conformance program at all, and the coverage table said
       so on the first page load — a feature the resolver and the checker both
       implement and nothing ran. That is exactly what the coverage column is
       for, and a `NO` in it is a build failure rather than a note. */
    { id: 'modules',
      source: 'import math; import text; let a = math.square(4); let b = text.upper("hi");',
      expect: 'String', covers: ['modules'] }
  ];

  /**
   * The error suite. Each program must produce exactly one diagnostic, with
   * the stated code — which is what makes "no cascade" a testable property
   * rather than an aspiration.
   */
  const ERROR_SUITE = [
    { id: 'unterminated-string', source: 'let s = "oops;', code: 'E-LEX-STRING',
      stage: 'lex', about: 'a string with no closing quote' },
    { id: 'bad-number', source: 'let n = 1.2.3;', code: 'E-LEX-NUMBER',
      stage: 'lex', about: 'two decimal points' },
    { id: 'missing-semicolon', source: 'let a = 1 let b = 2;', code: 'E-PARSE-EXPECTED',
      stage: 'parse', about: 'a statement that never ends' },
    { id: 'unclosed-paren', source: 'let a = (1 + 2;', code: 'E-PARSE-EXPECTED',
      stage: 'parse', about: 'a parenthesis with no partner' },
    { id: 'unbound', source: 'let a = b + 1;', code: 'E-RESOLVE-UNBOUND',
      stage: 'resolve', about: 'a name nothing binds' },
    { id: 'duplicate', source: 'let a = 1; let a = 2;', code: 'E-RESOLVE-SHADOW-SAME',
      stage: 'resolve', about: 'a rebinding in the same scope' },
    { id: 'type-mismatch', source: 'let a = 1 + true;', code: 'E-TYPE-MISMATCH',
      stage: 'typecheck', about: 'a Bool where a Number was required' },
    { id: 'branch-mismatch', source: 'let a = if true { 1 } else { false };',
      code: 'E-TYPE-BRANCHES', stage: 'typecheck', about: 'branches that disagree' },
    { id: 'no-field', source: 'let p = { x: 1 }; let y = p.y;', code: 'E-TYPE-FIELD',
      stage: 'typecheck', about: 'a field the record does not have' },
    { id: 'annotation-mismatch', source: 'let n: Number = true;', code: 'E-TYPE-ANNOTATION',
      stage: 'typecheck', about: 'a value that contradicts its annotation' },
    { id: 'inexhaustive', source: 'let d = match some(1) { some(v) => v, };',
      code: 'E-TYPE-EXHAUSTIVE', stage: 'typecheck', about: 'a match with a case missing' },
    { id: 'bad-condition', source: 'let a = if 1 { 2 } else { 3 };', code: 'E-TYPE-CONDITION',
      stage: 'typecheck', about: 'a Number used as a condition' }
  ];

  function feature(id) {
    return FEATURES.filter(function (entry) { return entry.id === id; })[0] || null;
  }

  function stage(id) {
    return STAGES.filter(function (entry) { return entry.id === id; })[0] || null;
  }

  /** Which features each stage first has to care about. */
  function featuresByStage() {
    const grouped = {};

    STAGES.forEach(function (entry) { grouped[entry.id] = []; });
    FEATURES.forEach(function (entry) {
      if (!grouped[entry.stage]) grouped[entry.stage] = [];
      grouped[entry.stage].push(entry.id);
    });
    return grouped;
  }

  /** The cost table with the totals a designer would actually compare. */
  function costTable() {
    return COSTS.map(function (row) {
      const entry = feature(row.feature);

      return { feature: row.feature, name: entry ? entry.name : row.feature,
        parse: row.parse, later: row.later, total: row.parse + row.later,
        ratio: row.parse === 0 ? 0 : row.later / row.parse, lands: row.lands };
    }).sort(function (a, b) { return b.later - a.later; });
  }

  function conformanceFor(featureId) {
    return CONFORMANCE.filter(function (row) {
      return row.covers.indexOf(featureId) !== -1;
    });
  }

  /** Every feature must be covered by at least one conformance program. */
  function coverage() {
    return FEATURES.map(function (entry) {
      const programs = conformanceFor(entry.id);

      return { feature: entry.id, name: entry.name, programs: programs.length,
        covered: programs.length > 0,
        ids: programs.map(function (row) { return row.id; }) };
    });
  }

  return {
    VERSION: VERSION, SUM_CONSTRUCTORS: SUM_CONSTRUCTORS, STAGES: STAGES, FEATURES: FEATURES, NON_GOALS: NON_GOALS,
    COSTS: COSTS, CONFORMANCE: CONFORMANCE, ERROR_SUITE: ERROR_SUITE,
    feature: feature, stage: stage, featuresByStage: featuresByStage,
    costTable: costTable, conformanceFor: conformanceFor, coverage: coverage
  };
}));
