/**
 * A small JavaScript lexer for the code lab's syntax highlighting.
 *
 * Written rather than imported for two reasons: it is one dependency fewer on
 * a platform that vendors everything, and a hand-written scanner is exactly
 * the artefact M24 and M25 teach - the code lab is highlighted by the same
 * kind of machine the curriculum builds.
 *
 * It is a lexer, not a parser: it does not resolve the regex-versus-division
 * ambiguity from M25.10 perfectly, and it says so rather than pretending.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.JsHighlight = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KEYWORDS = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
    'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
    'let', 'new', 'of', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
    'void', 'while', 'with', 'yield', 'async', 'await', 'static', 'get', 'set',
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity'
  ]);

  const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

  function escape(text) {
    return text.replace(/[&<>]/g, function (ch) { return ENTITIES[ch]; });
  }

  function span(cls, text) {
    return '<span class="' + cls + '">' + escape(text) + '</span>';
  }

  function readString(source, start) {
    const quote = source[start];
    let i = start + 1;
    while (i < source.length) {
      if (source[i] === '\\') { i += 2; continue; }
      if (source[i] === quote) { i += 1; break; }
      if (quote !== '`' && source[i] === '\n') break;
      i += 1;
    }
    return i;
  }

  function readLineComment(source, start) {
    let i = start;
    while (i < source.length && source[i] !== '\n') i += 1;
    return i;
  }

  function readBlockComment(source, start) {
    const end = source.indexOf('*/', start + 2);
    return end === -1 ? source.length : end + 2;
  }

  function readNumber(source, start) {
    let i = start;
    while (i < source.length && /[0-9a-fA-FxXbBoOeE._+-]/.test(source[i])) {
      if ((source[i] === '+' || source[i] === '-') && !/[eE]/.test(source[i - 1])) break;
      i += 1;
    }
    return i;
  }

  function readWord(source, start) {
    let i = start;
    while (i < source.length && /[A-Za-z0-9_$]/.test(source[i])) i += 1;
    return i;
  }

  function classifyWord(word, source, end) {
    if (KEYWORDS.has(word)) return 'tok-key';
    return source[end] === '(' ? 'tok-fn' : null;
  }

  function highlight(code) {
    const source = String(code === undefined || code === null ? '' : code);
    let out = '';
    let i = 0;

    while (i < source.length) {
      const ch = source[i];

      if (ch === '"' || ch === "'" || ch === '`') {
        const end = readString(source, i);
        out += span('tok-str', source.slice(i, end));
        i = end;
      } else if (ch === '/' && source[i + 1] === '/') {
        const end = readLineComment(source, i);
        out += span('tok-com', source.slice(i, end));
        i = end;
      } else if (ch === '/' && source[i + 1] === '*') {
        const end = readBlockComment(source, i);
        out += span('tok-com', source.slice(i, end));
        i = end;
      } else if (/[0-9]/.test(ch)) {
        const end = readNumber(source, i);
        out += span('tok-num', source.slice(i, end));
        i = end;
      } else if (/[A-Za-z_$]/.test(ch)) {
        const end = readWord(source, i);
        const word = source.slice(i, end);
        const cls = classifyWord(word, source, end);
        out += cls ? span(cls, word) : escape(word);
        i = end;
      } else if (/[+\-*/%=<>!&|^~?:]/.test(ch)) {
        out += span('tok-op', ch);
        i += 1;
      } else {
        out += escape(ch);
        i += 1;
      }
    }

    return out;
  }

  return { highlight: highlight, escape: escape, keywords: KEYWORDS };
}));
