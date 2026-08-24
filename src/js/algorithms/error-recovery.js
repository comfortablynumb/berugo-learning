/**
 * Error recovery: the difference between a parser and a language server.
 *
 * Detecting an error is easy — the table has no entry, stop. RECOVERING means
 * producing a second, third and fourth diagnostic that are each about a real
 * mistake, and a tree complete enough that everything downstream (completion,
 * go-to-definition, type checking of the parts that are fine) still works. A
 * parser that stops at the first error is unusable in an editor, and recovery
 * quality is the part that never appears in a parsing course.
 *
 * Three strategies are implemented here and measured against each other:
 *
 *   - **stop** — report the first error and give up. The baseline.
 *   - **panic** — discard tokens until one of a synchronising set appears, then
 *     resume. Cheap, robust, and it loses whatever was between.
 *   - **repair** — try inserting or deleting one token, scored by a cost model,
 *     and continue with the cheapest repair that gets the parser moving again.
 *     Better trees, more machinery, and it can cascade if the cost model is
 *     wrong.
 *
 * Cascade suppression is the other half: after a repair, a second error within
 * a short window is usually the first one echoing, so it is counted and not
 * reported. Without that rule a single missing brace produces a page of
 * diagnostics, which is the classic bad-compiler experience.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ErrorRecovery = api;
}(this, function () {
  'use strict';

  const STRATEGIES = ['stop', 'panic', 'repair'];

  /* ------------------------------------------------------ a tiny language */

  /**
   * A statement language small enough to read and big enough to break:
   *
   *   program   := statement*
   *   statement := 'let' name '=' expression ';'
   *              | 'print' expression ';'
   *   expression := name | number | expression '+' expression
   *
   * It is parsed by recursive descent, because recovery is a property of a
   * hand-written parser far more often than of a generated one.
   */
  const SYNC = [';', 'let', 'print'];

  function tokenise(source) {
    const out = [];
    const words = source.split(/\s+/).filter(function (part) { return part !== ''; });

    words.forEach(function (word) {
      splitPunctuation(word).forEach(function (piece) {
        out.push({ text: piece, type: typeOf(piece) });
      });
    });
    return out;
  }

  function splitPunctuation(word) {
    const pieces = [];
    let current = '';

    word.split('').forEach(function (ch) {
      if (';=+'.indexOf(ch) === -1) { current += ch; return; }
      if (current) pieces.push(current);
      pieces.push(ch);
      current = '';
    });
    if (current) pieces.push(current);
    return pieces;
  }

  function typeOf(text) {
    if (text === 'let' || text === 'print') return 'keyword';
    if (';=+'.indexOf(text) !== -1) return 'punct';
    if (/^[0-9]+$/.test(text)) return 'number';
    return 'name';
  }

  /* --------------------------------------------------------- the parser */

  /**
   * Parse a whole program, recovering by `strategy`. Returns the diagnostics,
   * the declarations that survived, and how many errors were suppressed as
   * cascades — the three numbers the section's tests assert.
   */
  function parse(source, strategy, options) {
    const settings = options || {};
    const state = {
      tokens: tokenise(source), at: 0, strategy: strategy,
      diagnostics: [], suppressed: 0, declarations: [], repairs: [],
      window: settings.window === undefined ? 2 : settings.window,
      lastErrorAt: -100, stopped: false
    };

    while (state.at < state.tokens.length && !state.stopped) {
      const before = state.at;

      statement(state);
      if (state.at === before) state.at += 1;
    }
    return report(state);
  }

  function report(state) {
    return {
      strategy: state.strategy,
      diagnostics: state.diagnostics,
      errors: state.diagnostics.length,
      suppressed: state.suppressed,
      declarations: state.declarations,
      survived: state.declarations.length,
      repairs: state.repairs,
      stopped: state.stopped
    };
  }

  function statement(state) {
    const token = state.tokens[state.at];

    if (!token) return;
    if (token.text === 'let') return letStatement(state);
    if (token.text === 'print') return printStatement(state);
    fail(state, 'expected a statement', ['let', 'print']);
  }

  function letStatement(state) {
    const start = state.at;

    state.at += 1;
    const name = expect(state, 'name', 'a name after let');

    if (name === null) return;
    if (expect(state, '=', "'=' after the name") === null) return;
    const value = expression(state);

    if (value === null) return;
    if (expect(state, ';', "';' at the end of the statement") === null) return;
    state.declarations.push({ kind: 'let', name: name, value: value, at: start });
  }

  function printStatement(state) {
    const start = state.at;

    state.at += 1;
    const value = expression(state);

    if (value === null) return;
    if (expect(state, ';', "';' at the end of the statement") === null) return;
    state.declarations.push({ kind: 'print', name: null, value: value, at: start });
  }

  function expression(state) {
    let text = atom(state);

    if (text === null) return null;
    while (state.tokens[state.at] && state.tokens[state.at].text === '+') {
      state.at += 1;
      const right = atom(state);

      if (right === null) return null;
      text = text + ' + ' + right;
    }
    return text;
  }

  function atom(state) {
    const token = state.tokens[state.at];

    if (token && (token.type === 'name' || token.type === 'number')) {
      state.at += 1;
      return token.text;
    }
    return fail(state, 'expected a name or a number', ['a name', 'a number']);
  }

  /**
   * Expect one token. `want` is either a token type or an exact text — the
   * distinction that lets one helper serve both `name` and `;`.
   */
  function expect(state, want, description) {
    const token = state.tokens[state.at];

    if (token && (token.text === want || token.type === want)) {
      state.at += 1;
      return token.text;
    }
    return fail(state, 'expected ' + description, [want]);
  }

  /* --------------------------------------------------------- recovery */

  function fail(state, message, expected) {
    diagnose(state, message, expected);
    if (state.strategy === 'stop') { state.stopped = true; return null; }
    if (state.strategy === 'repair' && repair(state, expected)) return REPAIRED;
    panic(state);
    return null;
  }

  const REPAIRED = '—';

  /**
   * Report, unless this is the same error echoing. Two errors within `window`
   * tokens of each other are one mistake seen twice far more often than they
   * are two mistakes, so the second is counted and dropped.
   */
  function diagnose(state, message, expected) {
    const token = state.tokens[state.at];
    const at = state.at;

    if (at - state.lastErrorAt <= state.window && state.diagnostics.length > 0) {
      state.suppressed += 1;
      return;
    }
    state.lastErrorAt = at;
    state.diagnostics.push({
      at: at, found: token ? token.text : 'end of input',
      message: message, expected: expected.join(' or '),
      text: message + ', found ' + (token ? "'" + token.text + "'" : 'end of input')
    });
  }

  /**
   * Panic mode: throw tokens away until a synchronising one appears. The
   * synchronising set is what makes it work — `;` and the statement keywords
   * are points where the parser knows where it is regardless of what came
   * before, so resuming there cannot produce a second bogus error.
   */
  function panic(state) {
    const from = state.at;

    while (state.at < state.tokens.length) {
      const token = state.tokens[state.at];

      if (token.text === ';') { state.at += 1; return; }
      if (SYNC.indexOf(token.text) !== -1) return;
      state.at += 1;
    }
    state.at = state.tokens.length;
    if (from === state.at) state.at += 1;
  }

  /**
   * Repair: try the two single-token edits and take the cheaper one that lets
   * the parser continue. Insertion is cheaper than deletion here because a
   * missing token is the more common typo — and that ordering is the whole
   * cost model, which is the honest size of most real ones.
   */
  const COST = { insert: 1, delete: 2 };

  function repair(state, expected) {
    const want = expected[0];

    if (canInsert(want) && plausible(state, want)) {
      state.repairs.push({ at: state.at, kind: 'insert', token: want, cost: COST.insert });
      state.tokens.splice(state.at, 0, { text: want, type: typeOf(want), inserted: true });
      state.at += 1;
      return true;
    }
    if (state.at < state.tokens.length && deletionHelps(state, want)) {
      state.repairs.push({ at: state.at, kind: 'delete',
        token: state.tokens[state.at].text, cost: COST.delete });
      state.tokens.splice(state.at, 1);
      return true;
    }
    return false;
  }

  function canInsert(want) {
    return want === ';' || want === '=' || want === 'name' || want === 'number';
  }

  /** Inserting is only plausible if the token AFTER the hole is one that could
   *  legitimately follow the inserted token — otherwise the repair papers over
   *  a real structural error and the cascade starts. */
  function plausible(state, want) {
    const token = state.tokens[state.at];

    if (!token) return want === ';';
    if (want === ';') return token.text === 'let' || token.text === 'print';
    if (want === '=') return token.type === 'name' || token.type === 'number';
    return token.text === '=' || token.text === ';' || token.text === '+';
  }

  function deletionHelps(state, want) {
    const next = state.tokens[state.at + 1];

    if (!next) return false;
    return next.text === want || next.type === want;
  }

  /* ------------------------------------------------------- comparison */

  /** Run all three strategies on one source, which is the demo's table. */
  function compare(source, options) {
    return STRATEGIES.map(function (strategy) {
      const result = parse(source, strategy, options);

      return { strategy: strategy, errors: result.errors, suppressed: result.suppressed,
        survived: result.survived, repairs: result.repairs.length,
        first: result.diagnostics.length ? result.diagnostics[0].text : 'none' };
    });
  }

  /** A source with exactly three independent mistakes and four good
   *  statements around them — the fixture the acceptance criterion names. */
  function threeErrors() {
    return [
      'let a = 1 ;',
      'let b 2 ;',
      'print a + b ;',
      'let c = ;',
      'let d = 4 ;',
      'print + ;',
      'print d ;'
    ].join('\n');
  }

  function clean() {
    return ['let a = 1 ;', 'let b = 2 ;', 'print a + b ;'].join('\n');
  }

  return {
    STRATEGIES: STRATEGIES, SYNC: SYNC, COST: COST,
    tokenise: tokenise, parse: parse, compare: compare,
    threeErrors: threeErrors, clean: clean
  };
}));
