/**
 * Diagnostics as a product, not a byproduct.
 *
 * A compiler that reports every consequence of one mistake is worse than one
 * that reports nothing, because the reader has to work out which of eleven
 * messages is the cause. Berugo's error suite makes that testable: every
 * program in it contains exactly one mistake and must produce exactly one
 * diagnostic. Two of the twelve produced three and two before this file
 * existed, and both extra messages were true — a string with no closing quote
 * really does leave an expression the parser cannot read.
 *
 * The three rules that reduce them, in the order they apply:
 *
 * 1. **Stage gating.** A later stage's diagnostics are dropped when an earlier
 *    stage reported anything. Names resolved against a tree with an error node
 *    in it, and types inferred from those names, are guesses about a program
 *    that was never read correctly.
 * 2. **Containment.** Within a stage, a diagnostic whose span sits inside an
 *    earlier one's is the same mistake seen from further in.
 * 3. **Duplication.** The same code at the same span, once.
 *
 * Every drop is counted and every dropped diagnostic is kept with the rule
 * that removed it, because suppression that cannot be inspected is
 * indistinguishable from a compiler that failed to notice.
 *
 * A diagnostic also carries what it takes to act: two spans (the thing, and
 * whatever imposed the expectation on it), a note explaining the rule, and —
 * where the fix is unambiguous — a machine-applicable edit.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Diagnostics = api;
  }
}(this, function (root) {
  'use strict';

  const Lexer = root && root.Berugo && root.Berugo.Lexer
    ? root.Berugo.Lexer : require('./lexer.js');

  const STAGE_ORDER = ['lex', 'parse', 'resolve', 'typecheck'];

  /**
   * The catalogue. A code without an entry still reports — an unknown code is
   * a gap in this table, not a reason to lose the message — but it gets the
   * default severity and no note, and `unknownCodes()` lists them so the gap
   * is visible rather than silent.
   */
  const CATALOGUE = {
    'E-LEX-STRING': { title: 'unterminated string',
      note: 'a string literal runs to the end of the line without a closing quote.',
      fix: 'insert the closing quote' },
    'E-LEX-NUMBER': { title: 'malformed number',
      note: 'a numeric literal may have at most one decimal point and one exponent.' },
    'E-LEX-CHAR': { title: 'unexpected character',
      note: 'this character is not part of any Berugo token.' },
    'E-PARSE-EXPECTED': { title: 'missing token',
      note: 'the grammar requires a specific token here and something else was found.',
      fix: 'insert the token the grammar requires' },
    'E-PARSE-EXPR': { title: 'expected an expression',
      note: 'a position that must hold an expression holds something that cannot start one.' },
    'E-PARSE-PATTERN': { title: 'expected a pattern',
      note: 'match arms are introduced by a pattern, not by an arbitrary expression.' },
    'E-PARSE-ASSIGN': { title: 'cannot assign here',
      note: 'only a name, a field or an index may appear on the left of an assignment.' },
    'E-RESOLVE-UNBOUND': { title: 'name not in scope',
      note: 'nothing in any enclosing scope binds this name.',
      fix: 'replace it with the nearest name that is in scope' },
    'E-RESOLVE-SHADOW-SAME': { title: 'already bound in this scope',
      note: 'shadowing across scopes is allowed; rebinding within one is not.',
      fix: 'rename this binding' },
    'E-RESOLVE-MODULE': { title: 'no such module',
      note: 'the import names a module the compiler does not know.' },
    'E-TYPE-MISMATCH': { title: 'type mismatch',
      note: 'the type required at this position and the type found do not unify.' },
    'E-TYPE-BRANCHES': { title: 'branches disagree',
      note: 'an if is an expression, so both arms must produce the same type.' },
    'E-TYPE-CONDITION': { title: 'condition is not a Bool',
      note: 'if and while test a Bool; there is no coercion from Number.' },
    'E-TYPE-FIELD': { title: 'no such field',
      note: 'records are structural, so the field set is part of the type.' },
    'E-TYPE-ANNOTATION': { title: 'value contradicts its annotation',
      note: 'the annotation switched the checker into check mode and the value did not fit.' },
    'E-TYPE-EXHAUSTIVE': { title: 'match is not exhaustive',
      note: 'some value of the subject type would reach the end with no arm taken.',
      fix: 'add the missing arm' },
    'E-TYPE-ASSIGN': { title: 'assignment changes a type',
      note: 'a binding has one type for its whole life; assigning another is rejected.' },
    'E-TYPE-CALL': { title: 'not callable, or called wrongly',
      note: 'the callee is not a function, or its arity or argument types do not match.' }
  };

  function stageOf(code) {
    if (code.indexOf('E-LEX-') === 0) return 'lex';
    if (code.indexOf('E-PARSE-') === 0) return 'parse';
    if (code.indexOf('E-RESOLVE-') === 0) return 'resolve';
    return 'typecheck';
  }

  /* ------------------------------------------------------------ building */

  /**
   * One shape, whatever stage produced it. `related` is the second span — what
   * imposed the expectation — and keeping it is the whole difference between
   * "cannot unify Number with Bool" and a message that points at both ends of
   * the disagreement.
   */
  function normalise(entry) {
    const code = entry.code || 'E-UNKNOWN';
    const known = CATALOGUE[code] || null;

    return { code: code, stage: stageOf(code), severity: 'error',
      message: entry.message || '', span: spanOf(entry.span),
      related: entry.related ? spanOf(entry.related) : null,
      expected: entry.expected || '', actual: entry.actual || '',
      suggestion: entry.suggestion || null,
      title: known ? known.title : code, note: known ? known.note : '',
      known: Boolean(known) };
  }

  function spanOf(span) {
    if (!span) return { start: 0, end: 0 };
    return { start: span.start || 0,
      end: typeof span.end === 'number' ? span.end : span.start || 0 };
  }

  function collect(stages) {
    const all = [];

    STAGE_ORDER.forEach(function (name) {
      (stages[name] || []).forEach(function (entry) { all.push(normalise(entry)); });
    });
    return sorted(all);
  }

  /** Source order, then stage, so a stable list survives a re-run. */
  function sorted(list) {
    return list.slice().sort(function (a, b) {
      if (a.span.start !== b.span.start) return a.span.start - b.span.start;
      if (a.span.end !== b.span.end) return a.span.end - b.span.end;
      return STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
    });
  }

  /* -------------------------------------------------------- suppression */

  function earliestStage(list) {
    return list.reduce(function (best, entry) {
      const rank = STAGE_ORDER.indexOf(entry.stage);

      return rank < best ? rank : best;
    }, STAGE_ORDER.length);
  }

  /**
   * Apply the three rules and report what each one removed. `options.gate`,
   * `.contain` and `.dedupe` each default to on; the demo turns them off one
   * at a time, which is the only way to see what a rule is worth.
   */
  function suppress(list, options) {
    const settings = options || {};
    const gate = settings.gate === false ? STAGE_ORDER.length - 1 : earliestStage(list);
    const state = { kept: [], dropped: [] };

    sorted(list).forEach(function (entry) {
      const rule = ruleAgainst(entry, state.kept, gate, settings);

      if (rule) state.dropped.push(Object.assign({ droppedBy: rule }, entry));
      else state.kept.push(entry);
    });
    return report(state);
  }

  function ruleAgainst(entry, kept, gate, settings) {
    if (STAGE_ORDER.indexOf(entry.stage) > gate) return 'stage';
    if (settings.dedupe !== false && kept.some(function (other) {
      return other.code === entry.code && sameSpan(other.span, entry.span);
    })) return 'duplicate';
    if (settings.contain !== false && kept.some(function (other) {
      return other.stage === entry.stage && contains(other.span, entry.span);
    })) return 'contained';
    return '';
  }

  function sameSpan(a, b) { return a.start === b.start && a.end === b.end; }

  function contains(outer, inner) {
    return outer.start <= inner.start && outer.end >= inner.end;
  }

  function report(state) {
    const counts = { stage: 0, duplicate: 0, contained: 0 };

    state.dropped.forEach(function (entry) { counts[entry.droppedBy] += 1; });
    return { kept: state.kept, dropped: state.dropped, counts: counts,
      total: state.kept.length + state.dropped.length,
      primary: state.kept.length ? state.kept[0] : null };
  }

  /* ---------------------------------------------------------------- fixes */

  /**
   * A machine-applicable fix is an edit the compiler is willing to apply
   * without asking. That bar is higher than "a plausible repair": every fix
   * here is derived from a table the compiler already has — the binding table
   * for a misspelled name, the grammar for a missing token, the constructor
   * list for a missing arm — and where no such table answers, there is no fix
   * rather than a guess.
   */
  function fixFor(entry, source) {
    if (entry.code === 'E-RESOLVE-UNBOUND') return renameFix(entry);
    if (entry.code === 'E-PARSE-EXPECTED') return insertFix(entry);
    if (entry.code === 'E-LEX-STRING') return quoteFix(entry, source);
    return null;
  }

  function renameFix(entry) {
    if (!entry.suggestion) return null;
    return { title: 'change it to ' + entry.suggestion, confident: true,
      edit: { start: entry.span.start, end: entry.span.end, text: entry.suggestion } };
  }

  /** The message names the token the grammar wanted; the fix inserts it. */
  function insertFix(entry) {
    const wanted = /expected "(.+?)"/.exec(entry.message);

    if (!wanted) return null;
    return { title: 'insert ' + wanted[1], confident: true,
      edit: { start: entry.span.start, end: entry.span.start, text: wanted[1] } };
  }

  function quoteFix(entry, source) {
    const line = source.indexOf('\n', entry.span.start);
    const at = line === -1 ? source.length : line;

    return { title: 'close the string', confident: true,
      edit: { start: at, end: at, text: '"' } };
  }

  function applyFix(source, fix) {
    return source.slice(0, fix.edit.start) + fix.edit.text + source.slice(fix.edit.end);
  }

  /* -------------------------------------------------------------- display */

  /**
   * The rendered form: a line, a column, and a caret run under exactly the
   * characters at fault. That last part is what the span was for, and it is
   * why a span with no end — which this parser produced for ten nodes per run
   * until `spanFrom` was fixed — is a bug rather than an untidiness.
   */
  function format(entry, source) {
    const at = Lexer.position(source, entry.span.start);
    const text = lineText(source, entry.span.start);
    const width = Math.max(1, Math.min(entry.span.end - entry.span.start,
      text.length - (at.column - 1)));

    return { line: at.line, column: at.column, text: text,
      caret: new Array(at.column).join(' ') + new Array(width + 1).join('^'),
      heading: entry.code + ': ' + entry.title, message: entry.message,
      note: entry.note };
  }

  function lineText(source, offset) {
    const start = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
    const end = source.indexOf('\n', offset);

    return source.slice(start, end === -1 ? source.length : end);
  }

  function oneLine(entry, source) {
    const at = Lexer.position(source, entry.span.start);

    return at.line + ':' + at.column + ' ' + entry.code + ' ' + entry.message;
  }

  /** Codes a stage emitted that the catalogue has no entry for. */
  function unknownCodes(list) {
    return list.filter(function (entry) { return !entry.known; })
      .map(function (entry) { return entry.code; })
      .filter(function (code, index, all) { return all.indexOf(code) === index; });
  }

  function summary(result) {
    return { reported: result.kept.length, suppressed: result.dropped.length,
      byStage: countStages(result.kept), counts: result.counts,
      code: result.primary ? result.primary.code : '' };
  }

  function countStages(list) {
    const counts = {};

    STAGE_ORDER.forEach(function (name) { counts[name] = 0; });
    list.forEach(function (entry) { counts[entry.stage] += 1; });
    return counts;
  }

  return {
    STAGE_ORDER: STAGE_ORDER, CATALOGUE: CATALOGUE,
    normalise: normalise, collect: collect, sorted: sorted, stageOf: stageOf,
    suppress: suppress, fixFor: fixFor, applyFix: applyFix,
    format: format, oneLine: oneLine, summary: summary, unknownCodes: unknownCodes
  };
}));
