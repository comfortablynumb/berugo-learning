/**
 * LL(1): predictive parsing with one token of lookahead.
 *
 * The table has one row per nonterminal and one column per terminal, and the
 * cell says which production to use. Building it is two lines given FIRST and
 * FOLLOW: for each production `A → α`, put it in every column of FIRST(α), and
 * if α is nullable, in every column of FOLLOW(A) as well.
 *
 * A CONFLICT is a cell wanting two productions, and reporting one usefully is
 * most of what this module is for. "LL(1) conflict in A on token t" is not
 * actionable; naming the two competing productions and a minimal input that
 * reaches the ambiguity is, because it tells you whether to left-factor, remove
 * left recursion, or accept that the grammar is genuinely ambiguous.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.LlParser = api;
}(this, function (root) {
  'use strict';

  const Grammar = root && root.Grammar ? root.Grammar : require('../machines/grammar.js');
  const Transform = root && root.GrammarTransform ? root.GrammarTransform
    : require('./grammar-transform.js');

  /* ---------------------------------------------------------- the table */

  /**
   * Build the table, and record for every cell the FIRST or FOLLOW set that
   * put it there — a demo that cannot answer "why is this production here"
   * teaches the algorithm as a ritual.
   */
  function table(grammar) {
    const analysis = Grammar.first(grammar);
    const follows = Grammar.follow(grammar, analysis);
    const cells = {};
    const conflicts = [];

    grammar.nonterminals.forEach(function (name) { cells[name] = {}; });
    grammar.productions.forEach(function (rule) {
      const head = Grammar.firstOfSequence(grammar, analysis, rule.rhs);

      Object.keys(head.set).forEach(function (terminal) {
        place(cells, conflicts, rule, terminal, 'FIRST of the right-hand side');
      });
      if (!head.nullable) return;
      Object.keys(follows[rule.lhs]).forEach(function (terminal) {
        place(cells, conflicts, rule, terminal,
          'the right-hand side is nullable, so FOLLOW(' + rule.lhs + ')');
      });
    });
    return { cells: cells, conflicts: conflicts, first: analysis, follow: follows,
      grammar: grammar, isLL1: conflicts.length === 0 };
  }

  function place(cells, conflicts, rule, terminal, reason) {
    const existing = cells[rule.lhs][terminal];

    if (existing && existing.rule.index !== rule.index) {
      conflicts.push({ nonterminal: rule.lhs, terminal: terminal,
        first: existing.rule, second: rule, reason: existing.reason + ' against ' + reason });
      return;
    }
    cells[rule.lhs][terminal] = { rule: rule, reason: reason };
  }

  /**
   * The shortest input that reaches a conflicting cell, so the report carries
   * an example rather than a coordinate. It is found by deriving a terminal
   * prefix that puts the parser in the conflicting state, which is what makes
   * the conflict reproducible.
   */
  function conflictExample(grammar, conflict, maxLength) {
    const bound = maxLength === undefined ? 6 : maxLength;
    const words = Grammar.language(grammar, bound).words;

    for (let i = 0; i < words.length; i += 1) {
      const tokens = tokenise(grammar, words[i]);

      if (tokens === null) continue;
      const run = parse(grammar, tokens, table(grammar));

      if (run.hitConflict === conflict.nonterminal + '/' + conflict.terminal) {
        return words[i];
      }
    }
    return null;
  }

  /** Split a derived string back into terminals. Terminals may be multiple
   *  characters, so the longest match wins — the same rule as a lexer. */
  function tokenise(grammar, word) {
    const out = [];
    let at = 0;

    while (at < word.length) {
      const found = grammar.terminals.filter(function (terminal) {
        return word.slice(at, at + terminal.length) === terminal;
      }).sort(function (a, b) { return b.length - a.length; })[0];

      if (found === undefined) return null;
      out.push(found);
      at += found.length;
    }
    return out;
  }

  /* --------------------------------------------------------- the parser */

  /**
   * The predictive parse loop: a stack of symbols, one token of lookahead, and
   * a table lookup per step. Every step is recorded, because the trace is what
   * makes the algorithm legible.
   */
  function parse(grammar, tokens, built) {
    const info = built || table(grammar);
    const stack = [Grammar.END, grammar.start];
    const input = tokens.concat([Grammar.END]);
    const steps = [];
    let at = 0;
    let hitConflict = null;

    while (stack.length && steps.length < 4000) {
      const top = stack[stack.length - 1];
      const lookahead = input[at];

      if (top === Grammar.END && lookahead === Grammar.END) {
        steps.push({ stack: stack.slice(), lookahead: lookahead, action: 'accept' });
        return done(steps, true, at, hitConflict);
      }
      if (!Grammar.isNonterminal(grammar, top)) {
        if (top !== lookahead) {
          steps.push({ stack: stack.slice(), lookahead: lookahead,
            action: 'error: expected ' + top });
          return done(steps, false, at, hitConflict);
        }
        stack.pop();
        at += 1;
        steps.push({ stack: stack.slice(), lookahead: lookahead, action: 'match ' + top });
        continue;
      }
      const cell = info.cells[top][lookahead];

      if (!cell) {
        steps.push({ stack: stack.slice(), lookahead: lookahead,
          action: 'error: no production for ' + top + ' on ' + lookahead });
        return done(steps, false, at, hitConflict);
      }
      if (info.conflicts.some(function (c) {
        return c.nonterminal === top && c.terminal === lookahead;
      })) hitConflict = top + '/' + lookahead;
      stack.pop();
      cell.rule.rhs.slice().reverse().forEach(function (symbol) { stack.push(symbol); });
      steps.push({ stack: stack.slice(), lookahead: lookahead,
        action: 'expand ' + top + ' → ' + (cell.rule.rhs.join(' ') || 'ε') });
    }
    return done(steps, false, at, hitConflict);
  }

  function done(steps, accepted, at, hitConflict) {
    return { accepted: accepted, steps: steps, consumed: at, hitConflict: hitConflict };
  }

  function accepts(grammar, tokens) {
    return parse(grammar, tokens).accepted;
  }

  /* -------------------------------------------------------- the diagnosis */

  /**
   * Why is this grammar not LL(1), and what would fix it? Three causes, three
   * different answers, and telling them apart is the practical value of the
   * conflict report.
   */
  function diagnose(grammar) {
    const built = table(grammar);
    const recursive = Transform.leftRecursive(grammar);
    const shared = sharedPrefixes(grammar);

    return {
      isLL1: built.isLL1,
      conflicts: built.conflicts.length,
      leftRecursive: recursive,
      sharedPrefixes: shared,
      remedy: built.isLL1 ? 'none needed'
        : recursive.length ? 'eliminate left recursion in ' + recursive.join(', ')
          : shared.length ? 'left-factor ' + shared.map(function (s) {
            return s.lhs + ' on ' + s.prefix;
          }).join('; ')
            : 'the grammar is ambiguous — no transformation makes it LL(1)'
    };
  }

  function sharedPrefixes(grammar) {
    const out = [];

    grammar.nonterminals.forEach(function (name) {
      const seen = {};

      grammar.byLhs[name].forEach(function (rule) {
        if (rule.rhs.length === 0) return;
        const head = rule.rhs[0];

        if (seen[head]) {
          if (!out.some(function (e) { return e.lhs === name && e.prefix === head; })) {
            out.push({ lhs: name, prefix: head });
          }
          return;
        }
        seen[head] = true;
      });
    });
    return out;
  }

  /** The table as rows for the demo, with the reason each cell exists. */
  function tableRows(built) {
    const rows = [];

    built.grammar.nonterminals.forEach(function (name) {
      built.grammar.terminals.concat([Grammar.END]).forEach(function (terminal) {
        const cell = built.cells[name][terminal];

        if (!cell) return;
        rows.push({ nonterminal: name, terminal: terminal,
          production: name + ' → ' + (cell.rule.rhs.join(' ') || 'ε'),
          reason: cell.reason,
          conflict: built.conflicts.some(function (c) {
            return c.nonterminal === name && c.terminal === terminal;
          }) });
      });
    });
    return rows;
  }

  return {
    table: table, parse: parse, accepts: accepts, diagnose: diagnose,
    tableRows: tableRows, conflictExample: conflictExample, tokenise: tokenise,
    sharedPrefixes: sharedPrefixes
  };
}));
