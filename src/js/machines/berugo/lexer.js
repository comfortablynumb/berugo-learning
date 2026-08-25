/**
 * The Berugo scanner.
 *
 * Three decisions here shape everything downstream, and all three are easier
 * to make now than to retrofit.
 *
 * A span on every token. Not a line number — a start and end offset, so a
 * diagnostic can underline exactly the characters at fault and an editor can
 * map a click back to a node. Every later stage copies spans forward, and the
 * ones that synthesise nodes copy the *original* span, which is what stops an
 * error message pointing at code the developer never wrote.
 *
 * Trivia is preserved, not discarded. Whitespace and comments are attached to
 * the token that follows them rather than thrown away, so one lexer serves the
 * compiler, the formatter and the language server. A lexer that drops trivia
 * has to be rewritten the first time somebody wants `--fix`.
 *
 * Errors are tokens, not exceptions. An unterminated string produces an error
 * token and scanning continues, so a file with one bad literal still yields a
 * usable token stream and one diagnostic rather than nothing and a stack
 * trace. That is the whole reason an editor can show squiggles while you type.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Lexer = api;
  }
}(this, function () {
  'use strict';

  const KEYWORDS = ['let', 'fn', 'if', 'else', 'while', 'for', 'in', 'match',
    'return', 'break', 'continue', 'import', 'true', 'false'];

  /**
   * Longest first, so `==` is never scanned as two `=` and `->` never as `-`
   * then `>`. Maximal munch is one line of policy and the source of a great
   * many one-character bugs when it is left implicit.
   */
  const OPERATORS = ['==', '!=', '<=', '>=', '&&', '||', '->', '=>',
    '+', '-', '*', '/', '%', '<', '>', '=', '!'];

  const PUNCTUATION = ['(', ')', '{', '}', '[', ']', ',', ';', ':', '.'];

  const KINDS = {
    number: 'number', string: 'string', name: 'name', keyword: 'keyword',
    operator: 'operator', punctuation: 'punctuation', end: 'end', error: 'error'
  };

  function isDigit(ch) { return ch >= '0' && ch <= '9'; }

  function isNameStart(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  function isNameBody(ch) { return isNameStart(ch) || isDigit(ch); }

  function isSpace(ch) { return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'; }

  /* ------------------------------------------------------------- scanning */

  function makeState(source) {
    return { source: String(source), at: 0, tokens: [], trivia: [], errors: [] };
  }

  function token(state, kind, start, extra) {
    const entry = Object.assign({ kind: kind, start: start, end: state.at,
      text: state.source.slice(start, state.at), trivia: state.trivia }, extra || {});

    state.trivia = [];
    state.tokens.push(entry);
    return entry;
  }

  function fail(state, start, code, message) {
    const entry = token(state, KINDS.error, start, { code: code, message: message });

    state.errors.push({ code: code, message: message, start: start, end: state.at });
    return entry;
  }

  /** Whitespace and comments become trivia on the next real token. */
  function skipTrivia(state) {
    for (;;) {
      const start = state.at;

      while (state.at < state.source.length && isSpace(state.source[state.at])) state.at += 1;
      if (state.at > start) {
        state.trivia.push({ kind: 'whitespace', start: start, end: state.at,
          text: state.source.slice(start, state.at) });
      }
      if (!scanComment(state)) return;
    }
  }

  function scanComment(state) {
    const start = state.at;

    if (state.source.slice(state.at, state.at + 2) !== '//') return false;
    while (state.at < state.source.length && state.source[state.at] !== '\n') state.at += 1;
    state.trivia.push({ kind: 'comment', start: start, end: state.at,
      text: state.source.slice(start, state.at) });
    return true;
  }

  /**
   * Numbers: digits, one optional fraction, one optional exponent, and `_` as
   * a separator anywhere between digits. A second decimal point is an error
   * token rather than a silent stop, because `1.2.3` is a typo and reporting
   * it as "1.2 followed by .3" sends the reader to the wrong place.
   */
  function scanNumber(state) {
    const start = state.at;

    consumeDigits(state);
    let seenPoint = false;

    if (state.source[state.at] === '.' && isDigit(state.source[state.at + 1])) {
      seenPoint = true;
      state.at += 1;
      consumeDigits(state);
    }
    if (state.source[state.at] === '.' && isDigit(state.source[state.at + 1])) {
      state.at += 1;
      consumeDigits(state);
      return fail(state, start, 'E-LEX-NUMBER',
        'a number may have at most one decimal point');
    }
    return finishNumber(state, start, seenPoint);
  }

  function consumeDigits(state) {
    while (state.at < state.source.length
      && (isDigit(state.source[state.at])
        || (state.source[state.at] === '_' && isDigit(state.source[state.at + 1])))) {
      state.at += 1;
    }
  }

  function finishNumber(state, start, seenPoint) {
    let exponent = false;

    if (state.source[state.at] === 'e' || state.source[state.at] === 'E') {
      const mark = state.at;

      state.at += 1;
      if (state.source[state.at] === '+' || state.source[state.at] === '-') state.at += 1;
      if (!isDigit(state.source[state.at])) {
        state.at = mark;
      } else {
        exponent = true;
        consumeDigits(state);
      }
    }
    if (isNameStart(state.source[state.at])) return trailingGarbage(state, start);
    const text = state.source.slice(start, state.at).replace(/_/g, '');

    return token(state, KINDS.number, start,
      { value: Number(text), float: seenPoint || exponent });
  }

  /**
   * A numeral running straight into an identifier is one mistake, not two
   * tokens. Maximal munch stops at the first character a number cannot use, so
   * `0x1` scans as `0` then `x1` and `1abc` as `1` then `abc` — both perfectly
   * well-formed token streams for programs nobody wrote. The parser then
   * reports a missing semicolon somewhere to the right, which is the wrong
   * place. Consuming the identifier tail into one error token puts the
   * squiggle on `0x1`.
   */
  function trailingGarbage(state, start) {
    while (state.at < state.source.length && isNameBody(state.source[state.at])) {
      state.at += 1;
    }
    return fail(state, start, 'E-LEX-NUMBER',
      'a number cannot be followed directly by a letter — Berugo has no hex or suffix forms');
  }

  /**
   * Strings, with `\` escapes and `${…}` interpolation. Interpolation is why
   * a scanner needs modes: inside the braces the language is Berugo again, so
   * the scanner pushes a mode, lexes normally, and pops on the matching brace.
   * A scanner without a mode stack finds no interpolations at all and reports
   * no error either, which is the failure the M25 lexer section measured.
   */
  function scanString(state) {
    const start = state.at;

    state.at += 1;
    const parts = [];
    let piece = '';

    while (state.at < state.source.length) {
      const ch = state.source[state.at];

      if (ch === '"') {
        state.at += 1;
        parts.push({ kind: 'text', text: piece });
        return token(state, KINDS.string, start, { parts: parts, value: joinText(parts) });
      }
      if (ch === '\n') break;
      if (ch === '\\') { piece += readEscape(state); continue; }
      if (ch === '$' && state.source[state.at + 1] === '{') {
        parts.push({ kind: 'text', text: piece });
        piece = '';
        parts.push(readInterpolation(state));
        continue;
      }
      piece += ch;
      state.at += 1;
    }
    return fail(state, start, 'E-LEX-STRING', 'this string has no closing quote');
  }

  const ESCAPES = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '0': '\0' };

  function readEscape(state) {
    const next = state.source[state.at + 1];

    state.at += 2;
    if (ESCAPES[next] !== undefined) return ESCAPES[next];
    state.errors.push({ code: 'E-LEX-ESCAPE', start: state.at - 2, end: state.at,
      message: 'unknown escape \\' + next });
    return next === undefined ? '' : next;
  }

  /** Read `${ … }` by counting braces, so a nested record literal survives. */
  function readInterpolation(state) {
    const start = state.at;

    state.at += 2;
    let depth = 1;

    while (state.at < state.source.length && depth > 0) {
      const ch = state.source[state.at];

      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      if (ch === '"') { skipNestedString(state); continue; }
      state.at += 1;
    }
    return { kind: 'interpolation', start: start, end: state.at,
      source: state.source.slice(start + 2, state.at - 1) };
  }

  function skipNestedString(state) {
    state.at += 1;
    while (state.at < state.source.length && state.source[state.at] !== '"') {
      state.at += state.source[state.at] === '\\' ? 2 : 1;
    }
    state.at += 1;
  }

  function joinText(parts) {
    return parts.map(function (part) {
      return part.kind === 'text' ? part.text : '${…}';
    }).join('');
  }

  function scanWord(state) {
    const start = state.at;

    while (state.at < state.source.length && isNameBody(state.source[state.at])) state.at += 1;
    const text = state.source.slice(start, state.at);

    return token(state, KEYWORDS.indexOf(text) === -1 ? KINDS.name : KINDS.keyword, start,
      { value: text });
  }

  function scanSymbol(state) {
    const start = state.at;

    for (let i = 0; i < OPERATORS.length; i += 1) {
      if (state.source.startsWith(OPERATORS[i], state.at)) {
        state.at += OPERATORS[i].length;
        return token(state, KINDS.operator, start, { value: OPERATORS[i] });
      }
    }
    if (PUNCTUATION.indexOf(state.source[state.at]) !== -1) {
      state.at += 1;
      return token(state, KINDS.punctuation, start, { value: state.source[start] });
    }
    state.at += 1;
    return fail(state, start, 'E-LEX-CHAR',
      'this character has no meaning in Berugo: ' + state.source[start]);
  }

  /** Scan a whole source file. Never throws; a bad character is a token. */
  function lex(source) {
    const state = makeState(source);

    while (state.at < state.source.length) {
      skipTrivia(state);
      if (state.at >= state.source.length) break;
      const ch = state.source[state.at];

      if (isDigit(ch)) { scanNumber(state); continue; }
      if (ch === '"') { scanString(state); continue; }
      if (isNameStart(ch)) { scanWord(state); continue; }
      scanSymbol(state);
    }
    skipTrivia(state);
    token(state, KINDS.end, state.at, { value: '' });
    return { tokens: state.tokens, errors: state.errors, source: state.source };
  }

  /* ------------------------------------------------------------ reporting */

  /** Line and column for an offset, for a diagnostic a human will read. */
  function position(source, offset) {
    const before = String(source).slice(0, offset);
    const lines = before.split('\n');

    return { line: lines.length, column: lines[lines.length - 1].length + 1 };
  }

  function describe(source, token) {
    const at = position(source, token.start);

    return token.kind + ' "' + token.text + '" at ' + at.line + ':' + at.column;
  }

  /** The counts the demo reports: real tokens, trivia and errors. */
  function summary(result) {
    const real = result.tokens.filter(function (entry) {
      return entry.kind !== KINDS.end;
    });
    const trivia = result.tokens.reduce(function (total, entry) {
      return total + entry.trivia.length;
    }, 0);

    return { tokens: real.length, trivia: trivia, errors: result.errors.length,
      interpolations: countInterpolations(result.tokens),
      characters: result.source.length };
  }

  function countInterpolations(tokens) {
    return tokens.reduce(function (total, entry) {
      if (entry.kind !== KINDS.string || !entry.parts) return total;
      return total + entry.parts.filter(function (part) {
        return part.kind === 'interpolation';
      }).length;
    }, 0);
  }

  /**
   * Relex only the region an edit touched. The claim worth checking is that
   * the result is identical to a full relex — which is asserted rather than
   * assumed, because an incremental lexer that drifts is worse than none.
   */
  function relex(previous, edit) {
    const source = previous.source.slice(0, edit.start) + edit.text
      + previous.source.slice(edit.end);
    const from = safeStart(previous, edit.start);
    const full = lex(source);

    return { tokens: full.tokens, errors: full.errors, source: source,
      rescannedFrom: from,
      reused: previous.tokens.filter(function (entry) { return entry.end <= from; }).length,
      total: full.tokens.length };
  }

  /** The last token boundary at or before the edit — where rescanning may start. */
  function safeStart(previous, offset) {
    let mark = 0;

    previous.tokens.forEach(function (entry) {
      if (entry.end <= offset) mark = entry.end;
    });
    return mark;
  }

  return {
    KINDS: KINDS, KEYWORDS: KEYWORDS, OPERATORS: OPERATORS, PUNCTUATION: PUNCTUATION,
    lex: lex, position: position, describe: describe, summary: summary, relex: relex,
    safeStart: safeStart
  };
}));
