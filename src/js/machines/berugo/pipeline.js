/**
 * The stage runner: every intermediate artefact, kept.
 *
 * Each stage is a pure function of the previous stage's output, and this file
 * is where that claim is made checkable rather than asserted. `run` executes
 * any prefix of the pipeline and hands back everything it produced, so a
 * section can show the tokens, the tree, the binding table, the type table and
 * the core side by side, and `purity` runs the whole thing twice and compares.
 *
 * Comparison is by FINGERPRINT, not by deep equality, and the distinction
 * matters. The artefacts are cyclic — a binding points at its scope, a scope
 * at its bindings, a reference at the node it came from — so a structural
 * comparison either loops forever or has to be taught which edges to ignore,
 * and a comparison that ignores edges can miss the change it was written to
 * find. A fingerprint is the observable content of an artefact rendered as
 * text: the token kinds and spans, the printed tree, the scope rows, the
 * type of every node in visit order. Two runs agreeing on all five means the
 * stages saw the same inputs and produced the same outputs, which is what the
 * acceptance criterion is about.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Pipeline = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Spec = berugo && berugo.Spec ? berugo.Spec : require('./spec.js');
  const Lexer = berugo && berugo.Lexer ? berugo.Lexer : require('./lexer.js');
  const Ast = berugo && berugo.Ast ? berugo.Ast : require('./ast.js');
  const Parser = berugo && berugo.Parser ? berugo.Parser : require('./parser.js');
  const Resolve = berugo && berugo.Resolve ? berugo.Resolve : require('./resolve.js');
  const Typecheck = berugo && berugo.Typecheck ? berugo.Typecheck : require('./typecheck.js');
  const Desugar = berugo && berugo.Desugar ? berugo.Desugar : require('./desugar.js');
  const Diagnostics = berugo && berugo.Diagnostics
    ? berugo.Diagnostics : require('./diagnostics.js');
  const Interp = berugo && berugo.Interp ? berugo.Interp : require('./interp.js');

  const ORDER = ['lex', 'parse', 'resolve', 'typecheck', 'desugar'];

  const LABELS = {
    lex: 'characters become tokens, with spans and trivia',
    parse: 'tokens become a tree that always exists',
    resolve: 'names become a binding table',
    typecheck: 'the tree becomes a type table',
    desugar: 'the tree becomes a smaller core'
  };

  /* ---------------------------------------------------------------- running */

  function run(source, options) {
    const settings = options || {};
    const upTo = ORDER.indexOf(settings.upTo || 'desugar');
    const state = { source: source, stages: [], artefacts: {} };

    for (let i = 0; i <= (upTo === -1 ? ORDER.length - 1 : upTo); i += 1) {
      runStage(state, ORDER[i], settings);
    }
    return finish(state);
  }

  const RUNNERS = {
    lex: function (state) { return Lexer.lex(state.source); },
    parse: function (state) { return Parser.parse(state.source); },
    resolve: function (state) { return Resolve.resolve(state.artefacts.parse.tree); },
    typecheck: function (state) { return Typecheck.typecheck(state.artefacts.parse.tree); },
    desugar: function (state, settings) {
      return Desugar.desugar(state.artefacts.parse.tree, settings.passes);
    }
  };

  const ERRORS = {
    lex: function (out) { return out.errors; },
    parse: function (out) { return out.errors; },
    resolve: function (out) { return out.errors; },
    typecheck: function (out) { return out.errors; },
    desugar: function () { return []; }
  };

  /**
   * The stage boundary, and the reason it is a boundary rather than a guard.
   *
   * Every stage after `parse` is handed a tree that may carry syntax errors,
   * because the point of error recovery is that later stages go on to produce
   * diagnostics of their own. A recovered tree has holes in it, and a
   * consumer that reads a field off a hole raises a TypeError out of an entry
   * point whose whole contract is to REPORT errors rather than raise them.
   *
   * M32's fuzzer found two of those in four characters (`let:` and `{=`), and
   * guarding the two nodes it happened to reach just moved the failure one
   * node along. The fix that holds is here: a stage that throws is recorded as
   * a stage that failed, with the exception as its diagnostic, and the
   * pipeline carries on with whatever it has. `crashed` is a reported field so
   * that a stage falling over can never be mistaken for a stage that found
   * nothing.
   */
  function runStage(state, id, settings) {
    try {
      const out = RUNNERS[id](state, settings);

      state.artefacts[id] = out;
      state.stages.push({ id: id, label: LABELS[id], errors: ERRORS[id](out).length,
        size: sizeOf(id, out) });
    } catch (problem) {
      state.artefacts[id] = state.artefacts[id] || null;
      state.stages.push({ id: id, label: LABELS[id], errors: 1, size: 0,
        crashed: String(problem && problem.message || problem) });
    }
  }

  function sizeOf(id, out) {
    if (id === 'lex') return out.tokens.length;
    if (id === 'parse') return Ast.countNodes(out.tree);
    if (id === 'resolve') return out.bindings.length + out.references.length;
    if (id === 'typecheck') return out.types.size;
    return Ast.countNodes(out.core);
  }

  /**
   * The parse stage already carries the lexer's errors forward, so collecting
   * from both would report every lexical problem twice. Diagnostics come from
   * `parse` onward and the lexer's own list is left to the lex stage's count.
   */
  function finish(state) {
    const raw = Diagnostics.collect({
      parse: state.artefacts.parse ? state.artefacts.parse.errors : [],
      resolve: state.artefacts.resolve ? state.artefacts.resolve.errors : [],
      typecheck: state.artefacts.typecheck ? state.artefacts.typecheck.errors : [] });
    const reported = Diagnostics.suppress(raw);

    return { source: state.source, stages: state.stages, artefacts: state.artefacts,
      diagnostics: reported, raw: raw, ok: reported.kept.length === 0 };
  }

  /* ----------------------------------------------------------- fingerprints */

  const FINGERPRINTS = {
    lex: function (out) {
      return out.tokens.map(function (token) {
        return token.kind + ':' + token.start + '-' + token.end + ':' + token.text;
      }).join('|');
    },
    parse: function (out) { return Ast.print(out.tree) + '#' + spanList(out.tree); },
    resolve: fingerprintResolve,
    typecheck: fingerprintTypes,
    desugar: function (out) { return Ast.print(out.core) + '#' + out.rewrites.length; }
  };

  function spanList(tree) {
    return Ast.collect(tree, function () { return true; }).map(function (node) {
      return node.kind + ':' + node.span.start + '-' + node.span.end;
    }).join(',');
  }

  function fingerprintResolve(out) {
    return Resolve.scopeRows(out).map(function (row) {
      return row.id + '/' + row.kind + '/' + row.depth + '['
        + row.bindings.map(function (entry) {
          return entry.name + ':' + entry.kind + ':' + entry.uses + ':' + entry.captured;
        }).join(' ') + ']';
    }).join('|');
  }

  function fingerprintTypes(out) {
    const parts = [];

    out.types.forEach(function (type, node) {
      parts.push(node.kind + ':' + node.span.start + '=' + Typecheck.show(type));
    });
    return parts.sort().join('|');
  }

  function fingerprint(result) {
    const parts = {};

    Object.keys(result.artefacts).forEach(function (id) {
      parts[id] = FINGERPRINTS[id](result.artefacts[id]);
    });
    return parts;
  }

  /**
   * Run twice, compare every stage. A stage that carried state between runs —
   * a module-level counter for fresh type variables is the classic one —
   * produces a different fingerprint the second time, and the section reports
   * which stage rather than just "not pure".
   */
  function purity(source, options) {
    const first = fingerprint(run(source, options));
    const second = fingerprint(run(source, options));
    const differing = Object.keys(first).filter(function (id) {
      return first[id] !== second[id];
    });

    return { ok: differing.length === 0, differing: differing,
      stages: Object.keys(first).length, first: first, second: second };
  }

  /* ------------------------------------------------------------- span audit */

  /**
   * Every node's span must lie inside the source, and every synthesised node
   * must name the surface construct it stands for. The second half is what
   * keeps a diagnostic about desugared code pointing at something the
   * developer typed.
   */
  function spanAudit(source, options) {
    const result = run(source, options);
    const problems = [];

    auditTree(result.artefacts.parse.tree, source.length, problems, 'tree');
    if (result.artefacts.desugar) {
      auditTree(result.artefacts.desugar.core, source.length, problems, 'core');
    }
    return { ok: problems.length === 0, problems: problems,
      nodes: Ast.countNodes(result.artefacts.parse.tree) };
  }

  function auditTree(tree, length, problems, where) {
    Ast.visit(tree, { enter: function (node) {
      const span = node.span;

      if (!span || typeof span.start !== 'number' || typeof span.end !== 'number') {
        problems.push({ where: where, kind: node.kind, why: 'no usable span' });
        return;
      }
      if (span.start < 0 || span.end > length || span.end < span.start) {
        problems.push({ where: where, kind: node.kind, why: 'span outside the source' });
      }
      if (node.origin !== undefined && !node.origin) {
        problems.push({ where: where, kind: node.kind, why: 'synthesised with no origin' });
      }
    } });
  }

  /* ------------------------------------------------------------- the suites */

  function conformance(options) {
    const rows = Spec.CONFORMANCE.map(function (entry) {
      return conformanceRow(entry, options);
    });

    return { rows: rows, passed: rows.filter(function (row) { return row.ok; }).length,
      total: rows.length, ok: rows.every(function (row) { return row.ok; }) };
  }

  function conformanceRow(entry, options) {
    const result = run(entry.source, options);
    const behaviour = Interp.compareWithCore(entry.source);
    const spans = spanAudit(entry.source, options);
    const pure = purity(entry.source, options);

    return { id: entry.id, source: entry.source, expect: entry.expect,
      inferred: result.artefacts.typecheck.last,
      diagnostics: result.diagnostics.kept.length,
      typeOk: result.artefacts.typecheck.last === entry.expect,
      agrees: behaviour.agree, spansOk: spans.ok, pure: pure.ok,
      nodes: Ast.countNodes(result.artefacts.parse.tree),
      core: Ast.countNodes(result.artefacts.desugar.core),
      ok: result.diagnostics.kept.length === 0 && behaviour.agree && spans.ok && pure.ok
        && result.artefacts.typecheck.last === entry.expect };
  }

  /**
   * The error suite's whole claim is "exactly one diagnostic, and this code".
   * Reporting the count as well as the code is what makes a cascade a failure
   * rather than a footnote.
   */
  function errorSuite(options) {
    const rows = Spec.ERROR_SUITE.map(function (entry) {
      const result = run(entry.source, options);
      const kept = result.diagnostics.kept;

      return { id: entry.id, source: entry.source, expected: entry.code,
        got: kept.map(function (item) { return item.code; }).join(','),
        reported: kept.length, raw: result.raw.length,
        suppressed: result.diagnostics.dropped.length,
        stage: entry.stage, about: entry.about,
        ok: kept.length === 1 && kept[0].code === entry.code };
    });

    return { rows: rows, passed: rows.filter(function (row) { return row.ok; }).length,
      total: rows.length, ok: rows.every(function (row) { return row.ok; }),
      raw: rows.reduce(function (sum, row) { return sum + row.raw; }, 0),
      reported: rows.reduce(function (sum, row) { return sum + row.reported; }, 0) };
  }

  /**
   * A fix is only machine-applicable if applying it removes the diagnostic it
   * was offered for. Whether it leaves the file entirely clean is a separate
   * and weaker question — a source can hold two mistakes — so both are
   * reported rather than conflated.
   */
  function fixSuite(options) {
    const rows = Spec.ERROR_SUITE.map(function (entry) {
      return fixRow(entry, options);
    }).filter(function (row) { return row !== null; });

    return { rows: rows, offered: rows.length,
      removed: rows.filter(function (row) { return row.removed; }).length,
      clean: rows.filter(function (row) { return row.clean; }).length,
      ok: rows.every(function (row) { return row.removed; }) };
  }

  function fixRow(entry, options) {
    const before = run(entry.source, options);
    const primary = before.diagnostics.primary;
    const fix = primary ? Diagnostics.fixFor(primary, entry.source) : null;

    if (!fix) return null;
    const source = Diagnostics.applyFix(entry.source, fix);
    const after = run(source, options);

    return { id: entry.id, title: fix.title, source: entry.source, fixed: source,
      code: primary.code, remaining: after.diagnostics.kept.length,
      removed: !after.diagnostics.kept.some(function (item) {
        return item.code === primary.code;
      }),
      clean: after.diagnostics.kept.length === 0 };
  }

  function summary(options) {
    const suite = conformance(options);
    const errors = errorSuite(options);
    const fixes = fixSuite(options);

    return { conformance: suite.passed + '/' + suite.total,
      errors: errors.passed + '/' + errors.total,
      cascade: errors.raw - errors.reported,
      fixes: fixes.removed + '/' + fixes.offered,
      ok: suite.ok && errors.ok && fixes.ok };
  }

  return {
    ORDER: ORDER, LABELS: LABELS,
    run: run, fingerprint: fingerprint, purity: purity, spanAudit: spanAudit,
    conformance: conformance, errorSuite: errorSuite, fixSuite: fixSuite,
    summary: summary
  };
}));
