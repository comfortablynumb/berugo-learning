/**
 * The places real languages stop being context-free, each one runnable.
 *
 * Every entry here is a construct that a parser built from the published
 * grammar gets wrong, together with the fix the language actually shipped. They
 * have one thing in common and it is the point of the section: the fix always
 * feeds information BACKWARDS — from the symbol table to the lexer, from the
 * parser to the tokeniser, from a semantic pass to a disambiguation choice —
 * which is precisely the dependency a clean layered architecture forbids.
 *
 * Three of them are implemented properly rather than described:
 *
 *   - **Automatic semicolon insertion**, JavaScript's rule that a newline ends
 *     a statement when the parse would otherwise fail. The famous cases are
 *     `return` on its own line and a postfix `++` on the next one.
 *   - **The lexer hack**, C's answer to `x * y;` being either a declaration or
 *     a multiplication depending on whether `x` is a typedef name.
 *   - **Angle brackets**, C++'s `>>` closing two template argument lists.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.RealLanguages = api;
}(this, function () {
  'use strict';

  /* ---------------------------------------- automatic semicolon insertion */

  /** Tokens that end an expression, so a newline after one may terminate the
   *  statement. A newline after `+` cannot, because `+` needs a right operand. */
  const ENDS_EXPRESSION = ['ident', 'number', ')', ']', '}', '++', '--'];

  /** Tokens after which a newline never inserts, because a statement cannot
   *  start with them and the parse continues across the line. */
  const CONTINUES = ['(', '[', '.', ',', '+', '-', '*', '/', '=', '&&', '||', '?', ':'];

  /** `return`, `throw`, `break`, `continue` and postfix `++`/`--` are the
   *  RESTRICTED productions: the specification forbids a newline at that exact
   *  point, so one is inserted whether or not the parse would have failed. */
  const RESTRICTED = ['return', 'throw', 'break', 'continue'];

  function tokenise(source) {
    const out = [];

    source.split('\n').forEach(function (line, lineNumber) {
      words(line).forEach(function (text) {
        out.push({ text: text, type: typeOf(text), line: lineNumber, newlineBefore: false });
      });
      if (out.length) out[out.length - 1].endsLine = true;
    });
    out.forEach(function (token, i) {
      token.newlineBefore = i > 0 && out[i - 1].endsLine === true;
    });
    return out;
  }

  function words(line) {
    const out = [];
    const multi = ['++', '--', '&&', '||', '=='];
    let at = 0;

    while (at < line.length) {
      if (line[at] === ' ') { at += 1; continue; }
      const pair = multi.filter(function (op) {
        return line.slice(at, at + 2) === op;
      })[0];

      if (pair) { out.push(pair); at += 2; continue; }
      if ('()[]{};,.+-*/=?:'.indexOf(line[at]) !== -1) { out.push(line[at]); at += 1; continue; }
      let length = 0;

      while (at + length < line.length && /[A-Za-z0-9_$]/.test(line[at + length])) length += 1;
      if (length === 0) { at += 1; continue; }
      out.push(line.slice(at, at + length));
      at += length;
    }
    return out;
  }

  function typeOf(text) {
    if (/^[0-9]+$/.test(text)) return 'number';
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text)) {
      return RESTRICTED.indexOf(text) !== -1 ? text : 'ident';
    }
    return text;
  }

  /**
   * Insert semicolons where the specification says to, and report each one with
   * the rule that caused it. Three rules, in the order the specification
   * applies them.
   */
  function insertSemicolons(source) {
    const tokens = tokenise(source);
    const out = [];
    const inserted = [];

    tokens.forEach(function (token, i) {
      const previous = tokens[i - 1];

      if (token.newlineBefore && previous && shouldInsert(previous, token)) {
        inserted.push({ at: out.length, line: previous.line,
          after: previous.text, before: token.text, rule: ruleFor(previous, token) });
        out.push({ text: ';', type: ';', synthetic: true });
      }
      out.push(token);
    });
    if (tokens.length && tokens[tokens.length - 1].text !== ';') {
      inserted.push({ at: out.length, line: tokens[tokens.length - 1].line,
        after: tokens[tokens.length - 1].text, before: 'end of input',
        rule: 'end of the program' });
      out.push({ text: ';', type: ';', synthetic: true });
    }
    return { tokens: out, inserted: inserted,
      text: out.map(function (token) { return token.text; }).join(' ') };
  }

  function shouldInsert(previous, token) {
    if (previous.text === ';' || previous.text === '{' || previous.text === '}') return false;
    if (RESTRICTED.indexOf(previous.type) !== -1) return true;
    if (token.text === '++' || token.text === '--') return true;
    if (CONTINUES.indexOf(token.text) !== -1) return false;
    return ENDS_EXPRESSION.indexOf(previous.type) !== -1;
  }

  function ruleFor(previous, token) {
    if (RESTRICTED.indexOf(previous.type) !== -1) {
      return 'restricted production: no newline is allowed after ' + previous.text;
    }
    if (token.text === '++' || token.text === '--') {
      return 'restricted production: no newline is allowed before a postfix ' + token.text;
    }
    return 'the parse would fail at ' + token.text + ', so the newline ends the statement';
  }

  /** The cases every JavaScript programmer eventually meets, with the answer
   *  the specification gives. */
  function asiCases() {
    return [
      { name: 'return on its own line',
        source: 'return\n1', expected: 'return ; 1 ;',
        note: 'the value is unreachable and the function returns undefined' },
      { name: 'a postfix ++ on the next line',
        source: 'a\n++ b', expected: 'a ; ++ b ;',
        note: 'the ++ binds to b as a prefix, not to a as a postfix' },
      { name: 'no insertion before an opening parenthesis',
        source: 'a = b\n( c )', expected: 'a = b ( c ) ;',
        note: 'the next line is read as a call — the classic reason for a leading semicolon' },
      { name: 'no insertion before an opening bracket',
        source: 'a = b\n[ c ]', expected: 'a = b [ c ] ;',
        note: 'read as an index, not as an array literal' },
      { name: 'no insertion after a binary operator',
        source: 'a = b +\nc', expected: 'a = b + c ;',
        note: 'the operator needs a right operand, so the expression continues' },
      { name: 'ordinary statement end',
        source: 'a = 1\nb = 2', expected: 'a = 1 ; b = 2 ;',
        note: 'the common case, and the reason the rule exists at all' }
    ];
  }

  /* ------------------------------------------------------- the lexer hack */

  /**
   * `x * y;` is a declaration of `y` as a pointer to `x` when `x` is a typedef
   * name, and a multiplication otherwise. The lexer cannot know, so C compilers
   * feed the symbol table back into the lexer — the "lexer hack".
   */
  function classifyC(source, typedefs) {
    const parts = source.split(/\s+/).filter(function (part) { return part !== ''; });
    const head = parts[0];
    const isType = typedefs.indexOf(head) !== -1;

    return {
      source: source, head: head, isType: isType,
      naive: 'multiplication — the lexer has no reason to think otherwise',
      withHack: isType ? 'a declaration of ' + (parts[2] || '?') + ' as a pointer to ' + head
        : 'a multiplication of ' + head + ' by ' + (parts[2] || '?'),
      differs: isType,
      needs: 'the symbol table, which only the parser has built'
    };
  }

  /* ---------------------------------------------------- angle brackets */

  /**
   * With `>>` in the operator set, maximal munch takes it as a shift and the
   * nested template arguments do not close. C++11 fixed it in the PARSER: when
   * looking for a closing angle bracket, a `>>` token is split.
   */
  function angleBrackets(source, splitShift) {
    const tokens = [];
    let at = 0;

    while (at < source.length) {
      if (source.slice(at, at + 2) === '>>') {
        if (splitShift) { tokens.push('>'); tokens.push('>'); } else { tokens.push('>>'); }
        at += 2;
        continue;
      }
      if ('<>(),'.indexOf(source[at]) !== -1) { tokens.push(source[at]); at += 1; continue; }
      let length = 0;

      while (at + length < source.length && /[A-Za-z0-9_ ]/.test(source[at + length])) {
        length += 1;
      }
      if (length === 0) { at += 1; continue; }
      const word = source.slice(at, at + length).trim();

      if (word) tokens.push(word);
      at += length;
    }
    return { tokens: tokens, balanced: balance(tokens) === 0, depth: balance(tokens) };
  }

  function balance(tokens) {
    let depth = 0;

    tokens.forEach(function (token) {
      if (token === '<') depth += 1;
      if (token === '>') depth -= 1;
    });
    return depth;
  }

  /* -------------------------------------------------------- the gallery */

  /** Every hard case, with a runnable input, what a naive parser does, and the
   *  engineering answer that shipped. */
  function gallery() {
    return [
      { language: 'C', construct: 'typedef names',
        input: 'x * y ;',
        naive: 'a multiplication statement',
        fix: 'the lexer hack: the parser tells the lexer which identifiers are type names',
        cost: 'the lexer now depends on the parser, and on parse ORDER' },
      { language: 'C++', construct: 'nested template arguments',
        input: 'vector<vector<int>>',
        naive: 'the >> lexes as a shift operator and the arguments never close',
        fix: 'the parser splits a >> token when it wants a closing angle bracket',
        cost: 'a token can be split after lexing, so token positions need care' },
      { language: 'C++', construct: 'the most vexing parse',
        input: 'Widget w ( Gadget ( ) ) ;',
        naive: 'ambiguous: a variable with an initialiser, or a function declaration',
        fix: 'the standard mandates the function-declaration reading',
        cost: 'the reading nobody wants wins, and braces exist to avoid it' },
      { language: 'Python', construct: 'indentation',
        input: 'if a :\\n    b = 1',
        naive: 'whitespace is skipped, so the block structure is invisible',
        fix: 'the lexer synthesises INDENT and DEDENT from a column stack',
        cost: 'tabs against spaces, and a dedent to an unopened column is an error' },
      { language: 'Python', construct: 'soft keywords',
        input: 'match = 1',
        naive: 'match is a keyword, so this is a syntax error',
        fix: 'the parser decides by position; match is a keyword only starting a statement',
        cost: 'the grammar needs the PEG parser CPython adopted in 3.9' },
      { language: 'JavaScript', construct: 'automatic semicolon insertion',
        input: 'return\\n1',
        naive: 'a return statement with the value 1',
        fix: 'restricted productions: a newline after return inserts a semicolon',
        cost: 'silently returns undefined, and no warning is required' },
      { language: 'JavaScript', construct: 'regex against division',
        input: 'a = b / c / d',
        naive: 'undecidable from the characters alone',
        fix: 'the lexer is told which context it is in by the parser',
        cost: 'the tokeniser cannot run ahead of the parser' },
      { language: 'YAML', construct: 'almost everything',
        input: 'country: NO',
        naive: 'NO is the string "NO"',
        fix: 'YAML 1.1 reads it as the boolean false; 1.2 does not, and tools differ',
        cost: 'the Norway problem — quoting is the only reliable answer' }
    ];
  }

  return {
    ENDS_EXPRESSION: ENDS_EXPRESSION, CONTINUES: CONTINUES, RESTRICTED: RESTRICTED,
    tokenise: tokenise, insertSemicolons: insertSemicolons, asiCases: asiCases,
    classifyC: classifyC, angleBrackets: angleBrackets, gallery: gallery
  };
}));
