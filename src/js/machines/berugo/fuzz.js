/**
 * A generator built from the grammar, and the properties to point it at.
 *
 * A random program generator is the cheapest fuzzer a language will ever get,
 * because the grammar is already written down and the generator is that
 * grammar read in the other direction. What makes it worth having is not the
 * programs — most of them are dull — but the properties, which are statements
 * that must hold for EVERY program rather than for the fifteen somebody
 * thought of.
 *
 * Three properties live here, and they test different components:
 *
 * - **Round trip.** Parse, print, reparse; the two trees must be equal modulo
 *   spans. This tests the parser and the printer against each other, and it
 *   fails when they disagree about precedence — which is the one thing they
 *   share a table for and therefore the one thing that should be impossible.
 * - **Totality under mutation.** Take a valid program, corrupt one character,
 *   and require the parser to return a tree with an error node rather than
 *   throw or hang. This is what makes an editor possible; a file being typed
 *   is malformed most of the time.
 * - **Surface against core.** Run the generated program and its desugaring and
 *   compare. This tests every lowering at once, and it is the property that
 *   found four name captures and an off-by-one in the `for` loop.
 *
 * A property that has never failed is a property you cannot trust, so
 * `brokenPrinter` deliberately breaks precedence and `sabotage()` reports how
 * many programs the round-trip property then rejects. A suite that reports
 * zero failures against a broken printer is measuring nothing.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Fuzz = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ast = berugo && berugo.Ast ? berugo.Ast : require('./ast.js');
  const Parser = berugo && berugo.Parser ? berugo.Parser : require('./parser.js');
  const Interp = berugo && berugo.Interp ? berugo.Interp : require('./interp.js');
  const Random = root && root.Random ? root.Random : require('../../utils/random.js');

  const NAMES = ['a', 'b', 'c', 'n', 'x', 'y', 'total', 'value'];
  const BINARY = ['+', '-', '*', '<', '<=', '==', '!='];
  const BOOLEAN = ['&&', '||'];

  /* ------------------------------------------------------------ generation */

  function makeGen(seed, options) {
    const settings = options || {};

    return { rng: Random.seeded(seed), depth: 0,
      maxDepth: settings.maxDepth || 4, scope: [], nextName: 0,
      allowLoops: settings.allowLoops !== false };
  }

  function pick(gen, list) { return list[gen.rng.int(list.length)]; }

  function freshName(gen) {
    const name = NAMES[gen.nextName % NAMES.length]
      + (gen.nextName >= NAMES.length ? String(Math.floor(gen.nextName / NAMES.length)) : '');

    gen.nextName += 1;
    gen.scope.push(name);
    return name;
  }

  /**
   * A generated expression is typed by construction — `numberExpr` only ever
   * produces a Number and `boolExpr` only a Bool — because a generator that
   * emits well-formed nonsense produces programs the type checker rejects, and
   * a suite of rejected programs exercises the checker's error path and
   * nothing else. Generating well-typed programs is what gets the run,
   * desugar and round-trip properties any coverage at all.
   */
  function numberExpr(gen) {
    if (gen.depth >= gen.maxDepth || gen.rng.next() < 0.35) return numberAtom(gen);
    gen.depth += 1;
    const built = numberCompound(gen);

    gen.depth -= 1;
    return built;
  }

  function numberAtom(gen) {
    const inScope = gen.scope.length && gen.rng.next() < 0.5;

    if (inScope) return pick(gen, gen.scope);
    return String(gen.rng.int(20));
  }

  function numberCompound(gen) {
    const roll = gen.rng.next();

    if (roll < 0.6) {
      return numberExpr(gen) + ' ' + pick(gen, ['+', '-', '*']) + ' ' + numberExpr(gen);
    }
    if (roll < 0.75) return '-' + numberAtom(gen);
    if (roll < 0.9) {
      return 'if ' + boolExpr(gen) + ' { ' + numberExpr(gen) + ' } else { '
        + numberExpr(gen) + ' }';
    }
    return '(' + numberExpr(gen) + ')';
  }

  function boolExpr(gen) {
    if (gen.depth >= gen.maxDepth || gen.rng.next() < 0.5) {
      return numberExpr(gen) + ' ' + pick(gen, BINARY.slice(3)) + ' ' + numberExpr(gen);
    }
    gen.depth += 1;
    const built = boolCompound(gen);

    gen.depth -= 1;
    return built;
  }

  function boolCompound(gen) {
    const roll = gen.rng.next();

    if (roll < 0.5) return boolExpr(gen) + ' ' + pick(gen, BOOLEAN) + ' ' + boolExpr(gen);
    if (roll < 0.7) return '!(' + boolExpr(gen) + ')';
    if (roll < 0.85) return pick(gen, ['true', 'false']);
    return '(' + boolExpr(gen) + ')';
  }

  const STATEMENTS = [letStatement, letStatement, ifStatement, whileStatement, forStatement];

  /**
   * The value is generated BEFORE the name enters scope. Written the other way
   * round — which is how it reads and how it was first written — the generator
   * emits `let a = a + 1;`, a name used inside its own initialiser. Those
   * programs do not resolve, so they exercise the error path and nothing else,
   * and they made two of five hundred differential runs fail for a reason that
   * had nothing to do with the desugaring under test.
   */
  function letStatement(gen) {
    const value = numberExpr(gen);

    return 'let ' + freshName(gen) + ' = ' + value + ';';
  }

  function ifStatement(gen) {
    const parts = [boolExpr(gen), numberExpr(gen), numberExpr(gen)];

    return 'let ' + freshName(gen) + ' = if ' + parts[0] + ' { ' + parts[1]
      + ' } else { ' + parts[2] + ' };';
  }

  /**
   * A generated loop must terminate, so its counter is generated rather than
   * chosen: a fresh name, a literal bound and a `+ 1` step. Letting the
   * generator write the guard produces programs that hit the step budget, and
   * a suite whose failures are all "did not finish" tests the budget.
   */
  function whileStatement(gen) {
    const counter = freshName(gen);
    const bound = 1 + gen.rng.int(5);

    return 'let ' + counter + ' = 0; while ' + counter + ' < ' + bound + ' { '
      + counter + ' = ' + counter + ' + 1; }';
  }

  function forStatement(gen) {
    const total = freshName(gen);
    const item = freshName(gen);
    const items = [gen.rng.int(9), gen.rng.int(9), gen.rng.int(9)].join(', ');

    return 'let ' + total + ' = 0; for ' + item + ' in [' + items + '] { '
      + total + ' = ' + total + ' + ' + item + '; }';
  }

  function generate(seed, options) {
    const gen = makeGen(seed, options);
    const settings = options || {};
    const count = settings.statements || (1 + gen.rng.int(4));
    const parts = [];

    for (let i = 0; i < count; i += 1) {
      parts.push(pick(gen, gen.allowLoops ? STATEMENTS : STATEMENTS.slice(0, 3))(gen));
    }
    return parts.join('\n');
  }

  /* ------------------------------------------------------------ properties */

  /**
   * `printer` is injectable so a deliberately broken one can be measured
   * against the same programs. Without that, "the round-trip property passed"
   * is a claim about the generator's reach rather than about the parser.
   */
  function roundTripOnce(source, printer) {
    const first = Parser.parse(source);

    if (first.errors.length) {
      return { ok: false, why: 'generated program does not parse', source: source };
    }
    return reparse(source, first, printer);
  }

  function reparse(source, first, printer) {
    const printed = (printer || Ast.print)(first.tree);
    const second = Parser.parse(printed);

    if (second.errors.length) {
      return { ok: false, why: 'the printed form does not parse', source: source,
        printed: printed };
    }
    if (!Ast.equalIgnoringSpans(first.tree, second.tree)) {
      return { ok: false, why: 'the two trees differ', source: source, printed: printed,
        difference: Ast.firstDifference(first.tree, second.tree, 'root') };
    }
    return { ok: true, source: source, printed: printed };
  }

  function roundTripSweep(options) {
    const settings = options || {};
    const count = settings.count || 500;
    const failures = [];

    for (let i = 0; i < count; i += 1) {
      const source = generate((settings.seed || 1) + i, settings);
      const outcome = roundTripOnce(source, settings.printer);

      if (!outcome.ok) failures.push(outcome);
    }
    return { checked: count, failures: failures, passed: count - failures.length,
      ok: failures.length === 0 };
  }

  /**
   * A printer that ignores precedence on the right of a binary operator. It is
   * a one-line change and it makes `1 - (2 - 3)` print as `1 - 2 - 3`, which
   * reparses to a different tree. If the sweep does not notice, the sweep is
   * not testing the printer.
   */
  function brokenPrinter(tree) {
    return Ast.print(tree, { noRightParens: true });
  }

  function sabotage(options) {
    const settings = Object.assign({}, options || {});
    const honest = roundTripSweep(settings);
    const broken = roundTripSweep(Object.assign({}, settings, { printer: brokenPrinter }));

    return { honest: honest, broken: broken,
      caught: broken.failures.length,
      detects: broken.failures.length > 0 && honest.failures.length === 0,
      rate: broken.checked ? broken.failures.length / broken.checked : 0 };
  }

  /* -------------------------------------------------------------- mutation */

  const MUTATIONS = ['delete', 'insert', 'truncate', 'swap'];
  const INSERTABLE = ['(', ')', '{', '}', '[', ']', '"', ';', '+', '=', 'let', 'fn'];

  function mutate(source, rng) {
    const kind = MUTATIONS[rng.int(MUTATIONS.length)];
    const at = rng.int(Math.max(1, source.length));

    if (kind === 'delete') return { kind: kind, text: source.slice(0, at) + source.slice(at + 1) };
    if (kind === 'truncate') return { kind: kind, text: source.slice(0, at) };
    if (kind === 'swap') return { kind: kind, text: swapAt(source, at) };
    return { kind: kind, text: source.slice(0, at)
      + INSERTABLE[rng.int(INSERTABLE.length)] + source.slice(at) };
  }

  function swapAt(source, at) {
    if (at + 1 >= source.length) return source;
    return source.slice(0, at) + source[at + 1] + source[at] + source.slice(at + 2);
  }

  /**
   * The parser must be total: a tree comes back, nothing throws, and every
   * node in it carries a span inside the source. A crash is obvious; a span
   * that points outside the file is the quiet failure, because it produces a
   * diagnostic that underlines nothing and nobody notices until an editor
   * tries to use it.
   */
  function fuzzParser(options) {
    const settings = options || {};
    const count = settings.count || 500;
    const rng = Random.seeded(settings.seed || 7);
    const state = { crashes: [], lostSpans: [], parsed: 0, withErrors: 0, kinds: {} };

    for (let i = 0; i < count; i += 1) {
      const base = generate((settings.seed || 7) + i, settings);
      const broken = mutate(base, rng);

      state.kinds[broken.kind] = (state.kinds[broken.kind] || 0) + 1;
      attempt(state, broken);
    }
    return finishFuzz(state, count);
  }

  function attempt(state, broken) {
    try {
      const parsed = Parser.parse(broken.text);

      state.parsed += 1;
      if (parsed.errors.length) state.withErrors += 1;
      checkSpans(state, parsed.tree, broken);
    } catch (error) {
      state.crashes.push({ kind: broken.kind, text: broken.text, error: error.message });
    }
  }

  function checkSpans(state, tree, broken) {
    Ast.visit(tree, { enter: function (node) {
      if (!node.span || typeof node.span.start !== 'number'
        || typeof node.span.end !== 'number'
        || node.span.start < 0 || node.span.end > broken.text.length
        || node.span.end < node.span.start) {
        state.lostSpans.push({ kind: node.kind, span: node.span, text: broken.text });
      }
    } });
  }

  function finishFuzz(state, count) {
    return { checked: count, parsed: state.parsed, withErrors: state.withErrors,
      crashes: state.crashes, lostSpans: state.lostSpans, kinds: state.kinds,
      ok: state.crashes.length === 0 && state.lostSpans.length === 0 };
  }

  /* ---------------------------------------------------------- differential */

  function differential(options) {
    const settings = options || {};
    const count = settings.count || 200;
    const state = { failures: [], ran: 0, budget: 0 };

    for (let i = 0; i < count; i += 1) {
      recordComparison(state, generate((settings.seed || 11) + i, settings), settings);
    }
    return { checked: count, ran: state.ran, budget: state.budget,
      failures: state.failures, ok: state.failures.length === 0 };
  }

  function recordComparison(state, source, settings) {
    const outcome = Interp.compareWithCore(source, { budget: settings.budget || 50000 });

    if (!outcome.ok) return;
    if (outcome.surface.outcome === 'budget') { state.budget += 1; return; }
    state.ran += 1;
    if (!outcome.agree) state.failures.push({ source: source, why: outcome.why });
  }

  function corpus(options) {
    const settings = options || {};
    const count = settings.count || 8;
    const rows = [];

    for (let i = 0; i < count; i += 1) {
      rows.push(generate((settings.seed || 1) + i, settings));
    }
    return rows;
  }

  return {
    NAMES: NAMES, BINARY: BINARY, MUTATIONS: MUTATIONS,
    generate: generate, corpus: corpus,
    roundTripOnce: roundTripOnce, roundTripSweep: roundTripSweep,
    brokenPrinter: brokenPrinter, sabotage: sabotage,
    mutate: mutate, fuzzParser: fuzzParser, differential: differential
  };
}));
