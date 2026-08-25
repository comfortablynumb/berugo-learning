/**
 * The Berugo parser: recursive descent for statements, Pratt for expressions.
 *
 * The parser is TOTAL. It always returns a tree, and where the input is
 * malformed the tree contains an `error` node carrying the span of what went
 * wrong. Nothing throws. That is what makes an editor possible — a file being
 * typed is malformed most of the time, and a parser that gives up on the first
 * problem cannot colour it, fold it or complete in it.
 *
 * Precedence comes from `ast.js`, the same table the printer uses, so the
 * round-trip property in 28.4 tests a real agreement rather than a shared
 * mistake. Statements are recursive descent because they are keyword-led and
 * that reads best; expressions are Pratt because a precedence table is data
 * and a recursive-descent cascade is not.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Parser = api;
  }
}(this, function (root) {
  'use strict';

  const Ast = root && root.Berugo && root.Berugo.Ast ? root.Berugo.Ast : require('./ast.js');
  const Lexer = root && root.Berugo && root.Berugo.Lexer
    ? root.Berugo.Lexer : require('./lexer.js');
  const Spec = root && root.Berugo && root.Berugo.Spec
    ? root.Berugo.Spec : require('./spec.js');

  function makeState(tokens, source) {
    return { tokens: tokens, at: 0, source: source, errors: [] };
  }

  function peek(state, ahead) { return state.tokens[state.at + (ahead || 0)]; }
  function current(state) { return state.tokens[state.at]; }

  function advance(state) {
    const token = state.tokens[state.at];

    if (state.at < state.tokens.length - 1) state.at += 1;
    return token;
  }

  function at(state, kind, value) {
    const token = current(state);

    return token.kind === kind && (value === undefined || token.value === value);
  }

  function atKeyword(state, word) { return at(state, 'keyword', word); }
  function atPunct(state, mark) { return at(state, 'punctuation', mark); }
  function atOperator(state, mark) { return at(state, 'operator', mark); }

  /**
   * `end` is a token at some call sites and a NODE at others — `parseIf` ends
   * at the else-block, `parseWhile` at its body — and a token carries `end`
   * directly while a node carries it inside `span`. Reading only `end.end`
   * produced ten nodes per conformance run whose span had no end at all: they
   * looked fine in the tree and underlined nothing, so a diagnostic on an
   * `if` had a start and no extent. Accepting both shapes here is the fix,
   * and `spanAudit` in `pipeline.js` is what stops it coming back.
   */
  function spanFrom(start, end) {
    const from = typeof start.start === 'number' ? start.start : start.span.start;
    const to = typeof end.end === 'number' ? end.end : end.span.end;

    return { start: from, end: to };
  }

  function spanOf(token) { return { start: token.start, end: token.end }; }

  /**
   * Record the problem and return an error node. The parser does not stop; it
   * has already decided what to do next, and saying so in the tree is more
   * useful than an exception nobody can render.
   */
  function problem(state, code, message, span) {
    state.errors.push({ code: code, message: message, span: span });
    return Ast.node('error', span, { code: code, why: message });
  }

  function expect(state, kind, value, what) {
    if (at(state, kind, value)) return advance(state);
    const token = current(state);

    problem(state, 'E-PARSE-EXPECTED',
      'expected ' + what + ' but found ' + (token.text || 'the end of the file'),
      spanOf(token));
    return null;
  }

  /* ------------------------------------------------------------ the items */

  function parseProgram(state) {
    const items = [];
    const start = current(state);

    while (!at(state, 'end')) {
      const before = state.at;

      items.push(parseItem(state));
      if (state.at === before) advance(state);
    }
    return Ast.node('program', spanFrom(start, current(state)), { items: items });
  }

  function parseItem(state) {
    if (atKeyword(state, 'fn') && peek(state, 1).kind === 'name') return parseFnDecl(state);
    if (atKeyword(state, 'import')) return parseImport(state);
    return parseStatement(state);
  }

  function parseFnDecl(state) {
    const start = advance(state);
    const name = expect(state, 'name', undefined, 'a function name');

    expect(state, 'punctuation', '(', '"("');
    const params = parseParams(state);

    expect(state, 'punctuation', ')', '")"');
    const body = parseBlock(state);

    return Ast.node('fnDecl', spanFrom(start, body), {
      name: name ? name.value : '?', params: params, body: body });
  }

  function parseParams(state) {
    const params = [];

    while (!atPunct(state, ')') && !at(state, 'end')) {
      const name = expect(state, 'name', undefined, 'a parameter name');

      if (!name) break;
      const annotation = atPunct(state, ':') ? (advance(state), parseType(state)) : null;

      params.push(Ast.node('param', spanOf(name),
        { name: name.value, annotation: annotation }));
      if (!atPunct(state, ',')) break;
      advance(state);
    }
    return params;
  }

  function parseImport(state) {
    const start = advance(state);
    const name = expect(state, 'name', undefined, 'a module name');
    const semi = expect(state, 'punctuation', ';', '";"');

    return Ast.node('importDecl', spanFrom(start, semi || start),
      { name: name ? name.value : '?' });
  }

  /* ------------------------------------------------------- the statements */

  /**
   * A block is statements and, optionally, a trailing expression with no
   * semicolon — the block's value. Deciding between them needs no lookahead
   * trick: parse the expression, and if the next token closes the block then
   * it was the tail. Requiring a semicolon everywhere would make `if` unable
   * to be an expression, which is not the language this spec describes.
   */
  function parseBlock(state) {
    const start = current(state);

    expect(state, 'punctuation', '{', '"{"');
    const statements = [];
    let tail = null;

    while (!atPunct(state, '}') && !at(state, 'end')) {
      const before = state.at;
      const parsed = parseBlockEntry(state);

      if (parsed.tail) { tail = parsed.node; break; }
      statements.push(parsed.node);
      if (state.at === before) advance(state);
    }
    const close = expect(state, 'punctuation', '}', '"}"');

    return Ast.node('block', spanFrom(start, close || current(state)),
      { statements: statements, tail: tail });
  }

  /** One entry: a statement, or the tail expression that ends the block. */
  function parseBlockEntry(state) {
    const token = current(state);

    if (token.kind === 'keyword' && STATEMENTS[token.value]) {
      return { node: STATEMENTS[token.value](state), tail: false };
    }
    if (atKeyword(state, 'fn') && peek(state, 1).kind === 'name') {
      return { node: parseFnDecl(state), tail: false };
    }
    const start = current(state);
    const expr = parseExpr(state, 0);

    if (atPunct(state, '}')) return { node: expr, tail: true };
    return { node: finishExprStatement(state, start, expr), tail: false };
  }

  const STATEMENTS = {
    let: parseLet, while: parseWhile, for: parseFor,
    return: parseReturn, break: parseBreak, continue: parseContinue
  };

  function parseStatement(state) {
    const token = current(state);

    if (token.kind === 'keyword' && STATEMENTS[token.value]) {
      return STATEMENTS[token.value](state);
    }
    if (atKeyword(state, 'fn') && peek(state, 1).kind === 'name') return parseFnDecl(state);
    return parseExprStatement(state);
  }

  function parseLet(state) {
    const start = advance(state);
    const name = expect(state, 'name', undefined, 'a name');
    const annotation = atPunct(state, ':') ? (advance(state), parseType(state)) : null;

    expect(state, 'operator', '=', '"="');
    const value = parseExpr(state, 0);
    const semi = expect(state, 'punctuation', ';', '";"');

    return Ast.node('letDecl', spanFrom(start, semi || value), {
      name: name ? name.value : '?', annotation: annotation, value: value });
  }

  function parseWhile(state) {
    const start = advance(state);
    const test = parseExpr(state, 0);
    const body = parseBlock(state);

    return Ast.node('whileStmt', spanFrom(start, body), { test: test, body: body });
  }

  function parseFor(state) {
    const start = advance(state);
    const name = expect(state, 'name', undefined, 'a loop variable');

    expect(state, 'keyword', 'in', '"in"');
    const iterable = parseExpr(state, 0);
    const body = parseBlock(state);

    return Ast.node('forStmt', spanFrom(start, body),
      { name: name ? name.value : '?', iterable: iterable, body: body });
  }

  function parseReturn(state) {
    const start = advance(state);
    const value = atPunct(state, ';') ? null : parseExpr(state, 0);
    const semi = expect(state, 'punctuation', ';', '";"');

    return Ast.node('returnStmt', spanFrom(start, semi || start), { value: value });
  }

  function parseBreak(state) {
    const start = advance(state);
    const semi = expect(state, 'punctuation', ';', '";"');

    return Ast.node('breakStmt', spanFrom(start, semi || start), {});
  }

  function parseContinue(state) {
    const start = advance(state);
    const semi = expect(state, 'punctuation', ';', '";"');

    return Ast.node('continueStmt', spanFrom(start, semi || start), {});
  }

  /**
   * An expression statement, or an assignment. The grammar cannot express
   * "the left of `=` must be assignable", so the parser parses an expression
   * and then validates — the parse-then-validate pattern, which gives a better
   * message than a grammar contortion would.
   */
  function parseExprStatement(state) {
    const start = current(state);

    return finishExprStatement(state, start, parseExpr(state, 0));
  }

  function finishExprStatement(state, start, expr) {
    if (!atOperator(state, '=')) {
      const semi = expect(state, 'punctuation', ';', '";"');

      return Ast.node('exprStmt', spanFrom(start, semi || expr), { expr: expr });
    }
    advance(state);
    const value = parseExpr(state, 0);
    const semi = expect(state, 'punctuation', ';', '";"');

    if (!assignable(expr)) {
      problem(state, 'E-PARSE-ASSIGN', 'this is not something you can assign to', expr.span);
    }
    return Ast.node('assign', spanFrom(start, semi || value), { target: expr, value: value });
  }

  function assignable(target) {
    return target.kind === 'name' || target.kind === 'field' || target.kind === 'index';
  }

  /* ------------------------------------------------------- the expressions */

  /**
   * Pratt: parse a prefix, then keep absorbing infix and postfix operators
   * whose left binding power beats the minimum the caller asked for.
   */
  function parseExpr(state, minimum) {
    let left = parsePrefix(state);

    for (;;) {
      const token = current(state);
      const next = infixOf(token);

      if (next === null || next.left < minimum) return left;
      left = next.parse(state, left);
    }
  }

  function infixOf(token) {
    if (token.kind === 'operator' && Ast.PRECEDENCE[token.value]) {
      return { left: Ast.PRECEDENCE[token.value].left, parse: parseBinary };
    }
    if (token.kind === 'punctuation' && token.value === '(') {
      return { left: Ast.POSTFIX_POWER, parse: parseCall };
    }
    if (token.kind === 'punctuation' && token.value === '.') {
      return { left: Ast.POSTFIX_POWER, parse: parseField };
    }
    if (token.kind === 'punctuation' && token.value === '[') {
      return { left: Ast.POSTFIX_POWER, parse: parseIndex };
    }
    return null;
  }

  function parseBinary(state, left) {
    const token = advance(state);
    const right = parseExpr(state, Ast.PRECEDENCE[token.value].right);

    return Ast.node('binary', { start: left.span.start, end: right.span.end },
      { op: token.value, left: left, right: right });
  }

  function parseCall(state, callee) {
    advance(state);
    const args = [];

    while (!atPunct(state, ')') && !at(state, 'end')) {
      args.push(parseExpr(state, 0));
      if (!atPunct(state, ',')) break;
      advance(state);
    }
    const close = expect(state, 'punctuation', ')', '")"');

    return Ast.node('call', { start: callee.span.start,
      end: close ? close.end : callee.span.end }, { callee: callee, args: args });
  }

  function parseField(state, object) {
    advance(state);
    const name = expect(state, 'name', undefined, 'a field name');

    return Ast.node('field', { start: object.span.start,
      end: name ? name.end : object.span.end },
    { object: object, name: name ? name.value : '?' });
  }

  function parseIndex(state, object) {
    advance(state);
    const key = parseExpr(state, 0);
    const close = expect(state, 'punctuation', ']', '"]"');

    return Ast.node('index', { start: object.span.start,
      end: close ? close.end : key.span.end }, { object: object, key: key });
  }

  const PREFIX_KEYWORDS = { if: parseIf, match: parseMatch, fn: parseLambda };

  function parsePrefix(state) {
    const token = current(state);

    if (token.kind === 'number') return literal(state, 'num', token.value);
    if (token.kind === 'string') return literal(state, 'str', token.value);
    if (token.kind === 'keyword' && (token.value === 'true' || token.value === 'false')) {
      return literal(state, 'bool', token.value === 'true');
    }
    if (token.kind === 'keyword' && PREFIX_KEYWORDS[token.value]) {
      return PREFIX_KEYWORDS[token.value](state);
    }
    if (token.kind === 'name') return literal(state, 'name', token.value);
    return parsePrefixSymbol(state, token);
  }

  function literal(state, kind, value) {
    const token = advance(state);
    const extra = kind === 'name' ? { name: value } : { value: value };

    return Ast.node(kind, spanOf(token), extra);
  }

  function parsePrefixSymbol(state, token) {
    if (token.kind === 'operator' && (token.value === '-' || token.value === '!')) {
      advance(state);
      const operand = parseExpr(state, Ast.UNARY_POWER);

      return Ast.node('unary', { start: token.start, end: operand.span.end },
        { op: token.value, operand: operand });
    }
    if (atPunct(state, '(')) return parseParenthesised(state);
    if (atPunct(state, '[')) return parseArray(state);
    if (atPunct(state, '{')) return parseRecord(state);
    advance(state);
    return problem(state, 'E-PARSE-EXPR',
      'expected an expression but found ' + (token.text || 'the end of the file'),
      spanOf(token));
  }

  function parseParenthesised(state) {
    advance(state);
    const inner = parseExpr(state, 0);

    expect(state, 'punctuation', ')', '")"');
    return inner;
  }

  function parseArray(state) {
    const start = advance(state);
    const items = [];

    while (!atPunct(state, ']') && !at(state, 'end')) {
      items.push(parseExpr(state, 0));
      if (!atPunct(state, ',')) break;
      advance(state);
    }
    const close = expect(state, 'punctuation', ']', '"]"');

    return Ast.node('array', spanFrom(start, close || start), { items: items });
  }

  function parseRecord(state) {
    const start = advance(state);
    const fields = [];

    while (!atPunct(state, '}') && !at(state, 'end')) {
      const name = expect(state, 'name', undefined, 'a field name');

      if (!name) break;
      expect(state, 'punctuation', ':', '":"');
      const value = parseExpr(state, 0);

      fields.push(Ast.node('recordField', { start: name.start, end: value.span.end },
        { name: name.value, value: value }));
      if (!atPunct(state, ',')) break;
      advance(state);
    }
    const close = expect(state, 'punctuation', '}', '"}"');

    return Ast.node('record', spanFrom(start, close || start), { fields: fields });
  }

  function parseLambda(state) {
    const start = advance(state);

    expect(state, 'punctuation', '(', '"("');
    const params = parseParams(state);

    expect(state, 'punctuation', ')', '")"');
    expect(state, 'operator', '=>', '"=>"');
    const body = parseExpr(state, 0);

    return Ast.node('lambda', { start: start.start, end: body.span.end },
      { params: params, body: body });
  }

  function parseIf(state) {
    const start = advance(state);
    const test = parseExpr(state, 0);
    const then = parseBlock(state);

    expect(state, 'keyword', 'else', '"else"');
    const other = parseBlock(state);

    return Ast.node('ifExpr', spanFrom(start, other),
      { test: test, then: then, other: other });
  }

  function parseMatch(state) {
    const start = advance(state);
    const subject = parseExpr(state, 0);

    expect(state, 'punctuation', '{', '"{"');
    const arms = [];

    while (!atPunct(state, '}') && !at(state, 'end')) {
      const before = state.at;

      arms.push(parseArm(state));
      if (state.at === before) advance(state);
    }
    const close = expect(state, 'punctuation', '}', '"}"');

    return Ast.node('matchExpr', spanFrom(start, close || start),
      { subject: subject, arms: arms });
  }

  function parseArm(state) {
    const start = current(state);
    const pattern = parsePattern(state);
    const guard = atKeyword(state, 'if') ? (advance(state), parseExpr(state, 0)) : null;

    expect(state, 'operator', '=>', '"=>"');
    const body = parseExpr(state, 0);

    if (atPunct(state, ',')) advance(state);
    return Ast.node('matchArm', { start: start.start, end: body.span.end },
      { pattern: pattern, guard: guard, body: body });
  }

  /* ---------------------------------------------------------- the patterns */

  function parsePattern(state) {
    const token = current(state);

    if (token.kind === 'number' || token.kind === 'string') {
      advance(state);
      return Ast.node('patternLiteral', spanOf(token), { value: token.value });
    }
    if (token.kind === 'keyword' && (token.value === 'true' || token.value === 'false')) {
      advance(state);
      return Ast.node('patternLiteral', spanOf(token), { value: token.value === 'true' });
    }
    if (atPunct(state, '{')) return parseRecordPattern(state);
    if (token.kind === 'name') return parseNamePattern(state);
    advance(state);
    return problem(state, 'E-PARSE-PATTERN', 'expected a pattern', spanOf(token));
  }

  function parseNamePattern(state) {
    const token = advance(state);

    if (token.value === '_') return Ast.node('patternWild', spanOf(token), {});
    if (!atPunct(state, '(')) {
      const nullary = Spec.SUM_CONSTRUCTORS[token.value] === 0;

      return Ast.node(nullary ? 'patternCtor' : 'patternName', spanOf(token),
        nullary ? { name: token.value, args: [] } : { name: token.value });
    }
    advance(state);
    const args = [];

    while (!atPunct(state, ')') && !at(state, 'end')) {
      args.push(parsePattern(state));
      if (!atPunct(state, ',')) break;
      advance(state);
    }
    const close = expect(state, 'punctuation', ')', '")"');

    return Ast.node('patternCtor', spanFrom(token, close || token),
      { name: token.value, args: args });
  }

  function parseRecordPattern(state) {
    const start = advance(state);
    const fields = [];

    while (!atPunct(state, '}') && !at(state, 'end')) {
      const name = expect(state, 'name', undefined, 'a field name');

      if (!name) break;
      expect(state, 'punctuation', ':', '":"');
      const pattern = parsePattern(state);

      fields.push(Ast.node('patternField', { start: name.start, end: pattern.span.end },
        { name: name.value, pattern: pattern }));
      if (!atPunct(state, ',')) break;
      advance(state);
    }
    const close = expect(state, 'punctuation', '}', '"}"');

    return Ast.node('patternRecord', spanFrom(start, close || start), { fields: fields });
  }

  /* ------------------------------------------------------------ the types */

  function parseType(state) {
    const left = parseTypeAtom(state);

    if (!atOperator(state, '->')) return left;
    advance(state);
    const right = parseType(state);

    return Ast.node('typeArrow', { start: left.span.start, end: right.span.end },
      { from: left, to: right });
  }

  function parseTypeAtom(state) {
    const token = current(state);

    if (token.kind === 'name') {
      advance(state);
      return Ast.node('typeName', spanOf(token), { name: token.value });
    }
    if (atPunct(state, '[')) return parseArrayType(state);
    if (atPunct(state, '{')) return parseRecordType(state);
    if (atPunct(state, '(')) return parseParenthesisedType(state);
    advance(state);
    return problem(state, 'E-PARSE-TYPE', 'expected a type', spanOf(token));
  }

  function parseArrayType(state) {
    const start = advance(state);
    const item = parseType(state);
    const close = expect(state, 'punctuation', ']', '"]"');

    return Ast.node('typeArray', spanFrom(start, close || start), { item: item });
  }

  function parseParenthesisedType(state) {
    advance(state);
    const inner = parseType(state);

    expect(state, 'punctuation', ')', '")"');
    return inner;
  }

  function parseRecordType(state) {
    const start = advance(state);
    const fields = [];

    while (!atPunct(state, '}') && !at(state, 'end')) {
      const name = expect(state, 'name', undefined, 'a field name');

      if (!name) break;
      expect(state, 'punctuation', ':', '":"');
      fields.push({ name: name.value, type: parseType(state) });
      if (!atPunct(state, ',')) break;
      advance(state);
    }
    const close = expect(state, 'punctuation', '}', '"}"');

    return Ast.node('typeRecord', spanFrom(start, close || start), { fields: fields });
  }

  /* ---------------------------------------------------------- the entry */

  /** Lex and parse. Never throws; the errors are in the result. */
  function parse(source) {
    const lexed = Lexer.lex(source);
    const state = makeState(lexed.tokens, lexed.source);
    const tree = parseProgram(state);

    return { tree: tree, errors: lexed.errors.map(asDiagnostic).concat(state.errors),
      tokens: lexed.tokens, source: lexed.source };
  }

  function asDiagnostic(entry) {
    return { code: entry.code, message: entry.message,
      span: { start: entry.start, end: entry.end } };
  }

  /** Parse, print, reparse — the property 28.4 is built on. */
  function roundTrip(source, options) {
    const first = parse(source);
    const printed = Ast.print(first.tree, options);
    const second = parse(printed);

    return { source: source, printed: printed, first: first.tree, second: second.tree,
      equal: Ast.equalIgnoringSpans(first.tree, second.tree),
      difference: Ast.firstDifference(first.tree, second.tree, 'root'),
      errors: first.errors.length + second.errors.length };
  }

  return {
    parse: parse, parseProgram: parseProgram, roundTrip: roundTrip,
    makeState: makeState, assignable: assignable
  };
}));
