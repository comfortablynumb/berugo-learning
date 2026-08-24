/**
 * Lexing in context: mode stacks, the offside rule, and the places where the
 * "context-free" claim about a language quietly stops being true.
 *
 * A single flat regex set cannot tokenise a template literal. `` `a ${b + `c`}
 * d` `` needs the lexer to know it is inside a string, then inside an
 * interpolation, then inside a nested string, and to come back out in the right
 * order. That is a stack, which means the lexer is not a finite automaton any
 * more — it is the smallest pushdown machine in the compiler, and it is where
 * most of a language's context-sensitivity actually lives.
 *
 * Indentation is the same story with a different stack. INDENT and DEDENT are
 * synthesised tokens: the grammar downstream is perfectly ordinary and sees
 * brackets, because the lexer manufactured them from column counts. The rules
 * that make it work in practice — blank lines produce nothing, comment-only
 * lines produce nothing, a dedent to a column that is not on the stack is an
 * error — are all here, because they are the ones real implementations get
 * wrong.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.LexerModes = api;
}(this, function () {
  'use strict';

  /* ------------------------------------------------------- the mode lexer */

  const MODES = ['code', 'template', 'interpolation'];

  /**
   * Tokenise a source that mixes code, template literals and `${...}`
   * interpolations. `useStack` false collapses the machine to a single mode,
   * which is exactly the bug this section is about — the demo runs both.
   */
  function lex(source, options) {
    const settings = options || {};
    const state = {
      source: source, at: 0, tokens: [], modes: ['code'], depth: [],
      history: [], useStack: settings.useStack !== false, errors: []
    };

    while (state.at < source.length) {
      const before = state.at;

      stepFor(state)(state);
      if (state.at === before) state.at += 1;
    }
    if (state.modes.length > 1) {
      state.errors.push({ at: state.at, message: 'input ended inside ' + top(state) });
    }
    return { tokens: state.tokens, history: state.history, errors: state.errors,
      maxDepth: maxDepth(state.history), modes: state.modes.slice() };
  }

  function stepFor(state) {
    if (!state.useStack) return flatStep;
    return top(state) === 'template' ? templateStep : codeStep;
  }

  function top(state) { return state.modes[state.modes.length - 1]; }

  function push(state, mode) {
    state.modes.push(mode);
    record(state, 'push ' + mode);
  }

  function pop(state) {
    const mode = state.modes.pop();

    record(state, 'pop ' + mode);
  }

  function record(state, action) {
    state.history.push({ at: state.at, action: action, stack: state.modes.join(' > '),
      depth: state.modes.length });
  }

  function emit(state, type, text) {
    state.tokens.push({ type: type, text: text, at: state.at, mode: top(state) });
  }

  /** Ordinary code: a backtick opens a template and pushes a mode. */
  function codeStep(state) {
    const ch = state.source[state.at];

    if (ch === '`') { emit(state, 'template-start', '`'); state.at += 1; push(state, 'template');
      return; }
    if (ch === '}' && top(state) === 'interpolation') {
      emit(state, 'interpolation-end', '}'); state.at += 1; pop(state); return;
    }
    if (ch === ' ' || ch === '\n') { state.at += 1; return; }
    readWord(state, 'code');
  }

  /** Inside a template: `${` pushes back into code, a backtick closes. */
  function templateStep(state) {
    const ch = state.source[state.at];

    if (ch === '`') { emit(state, 'template-end', '`'); state.at += 1; pop(state); return; }
    if (ch === '$' && state.source[state.at + 1] === '{') {
      emit(state, 'interpolation-start', '${');
      state.at += 2;
      push(state, 'interpolation');
      return;
    }
    let length = 0;

    while (state.at + length < state.source.length
      && state.source[state.at + length] !== '`'
      && !(state.source[state.at + length] === '$'
        && state.source[state.at + length + 1] === '{')) length += 1;
    emit(state, 'chars', state.source.slice(state.at, state.at + length));
    state.at += length;
  }

  /**
   * The same lexer with the stack removed: one mode, and a backtick toggles.
   * It is fine on a flat template and wrong the moment one nests, which is the
   * measurement the section quotes.
   */
  function flatStep(state) {
    const ch = state.source[state.at];

    if (ch === '`') {
      state.inTemplate = !state.inTemplate;
      emit(state, state.inTemplate ? 'template-start' : 'template-end', '`');
      state.at += 1;
      return;
    }
    if (state.inTemplate) {
      let length = 0;

      while (state.at + length < state.source.length
        && state.source[state.at + length] !== '`') length += 1;
      emit(state, 'chars', state.source.slice(state.at, state.at + length));
      state.at += length;
      return;
    }
    if (ch === ' ' || ch === '\n') { state.at += 1; return; }
    readWord(state, 'code');
  }

  function readWord(state, type) {
    let length = 0;

    while (state.at + length < state.source.length
      && ' \n`${}'.indexOf(state.source[state.at + length]) === -1) length += 1;
    if (length === 0) {
      emit(state, 'punct', state.source[state.at]);
      state.at += 1;
      return;
    }
    emit(state, type, state.source.slice(state.at, state.at + length));
    state.at += length;
  }

  function maxDepth(history) {
    return history.reduce(function (best, entry) {
      return Math.max(best, entry.depth);
    }, 1);
  }

  /* --------------------------------------------------------- maximal munch */

  /**
   * Longest match wins, and the classic failure: with `>>` in the operator set,
   * `List<List<int>>` lexes the closing brackets as one shift operator. C++
   * fixed this in the parser, not the lexer, which is the point.
   */
  function munch(source, operators) {
    const sorted = operators.slice().sort(function (a, b) { return b.length - a.length; });
    const tokens = [];
    let at = 0;

    while (at < source.length) {
      if (source[at] === ' ') { at += 1; continue; }
      const match = sorted.filter(function (op) {
        return source.slice(at, at + op.length) === op;
      })[0];

      if (match) { tokens.push({ type: 'op', text: match }); at += match.length; continue; }
      let length = 0;

      while (at + length < source.length && isWord(source[at + length])) length += 1;
      if (length === 0) { tokens.push({ type: 'punct', text: source[at] }); at += 1; continue; }
      tokens.push({ type: 'word', text: source.slice(at, at + length) });
      at += length;
    }
    return tokens;
  }

  function isWord(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
      || (ch >= '0' && ch <= '9') || ch === '_';
  }

  /* ------------------------------------------------------ the offside rule */

  const TAB_WIDTH = 8;

  /**
   * INDENT/DEDENT from an indentation stack. Blank and comment-only lines
   * produce nothing at all — not even a NEWLINE — which is the rule that makes
   * a file with a blank line inside a block work, and the one most
   * reimplementations forget.
   */
  function indentTokens(source, options) {
    const settings = options || {};
    const state = { stack: [0], tokens: [], errors: [], lines: 0,
      tabWidth: settings.tabWidth || TAB_WIDTH,
      comment: settings.comment === undefined ? '#' : settings.comment };

    source.split('\n').forEach(function (line, index) {
      state.lines = index + 1;
      lineTokens(state, line);
    });
    while (state.stack.length > 1) { state.stack.pop(); state.tokens.push({ type: 'DEDENT' }); }
    return { tokens: state.tokens, errors: state.errors, stack: state.stack.slice() };
  }

  function lineTokens(state, line) {
    const measured = columnOf(line, state.tabWidth);

    if (isBlank(state, line, measured)) return;
    adjust(state, measured);
    state.tokens.push({ type: 'LINE', text: line.slice(measured.characters).trim(),
      column: measured.column, line: state.lines });
    state.tokens.push({ type: 'NEWLINE' });
  }

  function isBlank(state, line, measured) {
    const rest = line.slice(measured.characters);

    return rest.trim() === '' || rest.indexOf(state.comment) === 0;
  }

  function adjust(state, measured) {
    const current = state.stack[state.stack.length - 1];

    if (measured.column > current) {
      state.stack.push(measured.column);
      state.tokens.push({ type: 'INDENT', column: measured.column });
      return;
    }
    while (state.stack[state.stack.length - 1] > measured.column) {
      state.stack.pop();
      state.tokens.push({ type: 'DEDENT', column: state.stack[state.stack.length - 1] });
    }
    if (state.stack[state.stack.length - 1] !== measured.column) {
      state.errors.push({ line: state.lines, column: measured.column,
        message: 'dedent to column ' + measured.column + ' matches no open block' });
    }
  }

  /**
   * A tab advances to the next multiple of the tab width, which is what Python
   * does — and why a file mixing tabs and spaces can indent identically on
   * screen and differently to the lexer.
   */
  function columnOf(line, tabWidth) {
    let column = 0;
    let characters = 0;

    while (characters < line.length && (line[characters] === ' ' || line[characters] === '\t')) {
      column = line[characters] === '\t'
        ? (Math.floor(column / tabWidth) + 1) * tabWidth : column + 1;
      characters += 1;
    }
    return { column: column, characters: characters };
  }

  /** Tokens as a compact string for a table cell. */
  function show(tokens) {
    return tokens.map(function (token) {
      if (token.type === 'LINE') return 'LINE(' + token.text + ')';
      if (token.type === 'NEWLINE') return 'NL';
      return token.type;
    }).join(' ');
  }

  /* -------------------------------------------------- keywords and context */

  /**
   * A soft keyword is a word that is a keyword only where the grammar expects
   * one. `match` in Python and `await` in older JavaScript are both variables
   * elsewhere, so the lexer cannot decide — the parser has to.
   */
  function classify(words, hard, soft) {
    return words.map(function (word, index) {
      if (hard.indexOf(word) !== -1) return { text: word, type: 'keyword', reason: 'reserved' };
      if (soft.indexOf(word) !== -1 && index === 0) {
        return { text: word, type: 'keyword',
          reason: 'soft keyword in statement-start position' };
      }
      if (soft.indexOf(word) !== -1) {
        return { text: word, type: 'identifier', reason: 'soft keyword used as a name' };
      }
      return { text: word, type: 'identifier', reason: 'not in either set' };
    });
  }

  return {
    MODES: MODES, TAB_WIDTH: TAB_WIDTH,
    lex: lex, munch: munch, indentTokens: indentTokens, columnOf: columnOf,
    show: show, classify: classify
  };
}));
