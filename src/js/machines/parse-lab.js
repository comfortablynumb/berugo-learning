/**
 * The parse lab: one grammar, one input, every parser in M25, side by side.
 *
 * Each parser in this milestone has a different power and a different failure
 * mode, and the only way to keep them honest is to run them against each other
 * on the same input and let disagreement be a build failure. Earley is the
 * reference — it accepts every context-free grammar including left-recursive
 * and ε-riddled ones — so anything that disagrees with Earley is either a bug
 * or a parser correctly refusing a grammar outside its class, and the lab says
 * which by reporting whether the parser could be BUILT at all.
 *
 * That distinction is the whole point. "LL(1) rejected this input" and "LL(1)
 * cannot be built for this grammar" are entirely different facts, and a table
 * that shows one number per parser hides it.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ParseLab = api;
}(this, function (root) {
  'use strict';

  function need(name, path) {
    if (root && root[name]) return root[name];
    return require(path);
  }

  const Grammar = need('Grammar', './grammar.js');
  const Earley = need('Earley', '../algorithms/earley.js');
  const Cyk = need('Cyk', '../algorithms/cyk.js');
  const LlParser = need('LlParser', '../algorithms/ll-parser.js');
  const LrParser = need('LrParser', '../algorithms/lr-parser.js');
  const Glr = need('Glr', '../algorithms/glr.js');
  const Pda = need('Pda', '../algorithms/pda.js');

  const PARSERS = ['earley', 'cyk', 'll1', 'slr', 'lalr', 'lr1', 'glr', 'pda'];

  /* ----------------------------------------------------------- one run */

  const RUNNERS = {
    earley: function (grammar, tokens) {
      const result = Earley.parse(grammar, tokens);

      return { accepted: result.accepted, work: countItems(result), built: true,
        detail: 'chart of ' + result.columns.length + ' columns' };
    },
    cyk: function (grammar, tokens) {
      const result = Cyk.parse(grammar, tokens);

      return { accepted: result.accepted, work: result.entries, built: true,
        detail: result.cells + ' cells over a CNF of '
          + result.cnf.productions.length + ' rules' };
    },
    ll1: function (grammar, tokens) {
      const built = LlParser.table(grammar);

      if (built.conflicts.length) {
        return { accepted: null, work: 0, built: false,
          detail: built.conflicts.length + ' table conflict'
            + (built.conflicts.length === 1 ? '' : 's') };
      }
      const result = LlParser.parse(grammar, tokens, built);

      return { accepted: result.accepted, work: result.steps.length, built: true,
        detail: 'predictive, one token of lookahead' };
    },
    slr: function (grammar, tokens) { return lr(grammar, tokens, 'slr'); },
    lalr: function (grammar, tokens) { return lr(grammar, tokens, 'lalr'); },
    lr1: function (grammar, tokens) { return lr(grammar, tokens, 'lr1'); },
    glr: function (grammar, tokens) {
      const result = Glr.parse(grammar, tokens);

      return { accepted: result.accepted, work: result.steps, built: true,
        detail: result.nodes + ' forest nodes, ' + result.ambiguous + ' ambiguous' };
    },
    pda: function (grammar, tokens) {
      const result = Pda.run(Pda.fromGrammar(grammar), tokens, 30000);

      if (result.exhausted && !result.accepted) {
        return { accepted: null, work: result.steps, built: false,
          detail: 'search cap reached — left recursion expands without consuming' };
      }
      return { accepted: result.accepted, work: result.steps, built: true,
        detail: 'nondeterministic top-down search' };
    }
  };

  function lr(grammar, tokens, mode) {
    const built = LrParser.build(grammar, mode);

    if (built.conflicts.length) {
      return { accepted: null, work: 0, built: false,
        detail: built.states + ' states, ' + built.conflicts.length + ' conflict'
          + (built.conflicts.length === 1 ? '' : 's') };
    }
    const result = LrParser.parse(built, tokens);

    return { accepted: result.accepted, work: result.steps.length, built: true,
      detail: built.states + ' states, no conflicts' };
  }

  function countItems(result) {
    return result.columns.reduce(function (total, column) {
      return total + column.length;
    }, 0);
  }

  /* -------------------------------------------------------- the table */

  /**
   * Run every parser and mark each row against the Earley reference. A row is
   * `agrees: null` when the parser could not be built, which is information
   * about the GRAMMAR rather than about the input.
   */
  function run(grammar, tokens, only) {
    const wanted = only || PARSERS;
    const reference = RUNNERS.earley(grammar, tokens).accepted;

    return wanted.map(function (name) {
      const outcome = safely(name, grammar, tokens);

      return {
        parser: name, accepted: outcome.accepted, built: outcome.built,
        work: outcome.work, detail: outcome.detail,
        agrees: outcome.built ? outcome.accepted === reference : null,
        verdict: verdictOf(outcome, reference)
      };
    });
  }

  function safely(name, grammar, tokens) {
    try {
      return RUNNERS[name](grammar, tokens);
    } catch (error) {
      return { accepted: null, work: 0, built: false,
        detail: 'threw: ' + (error && error.message ? error.message : String(error)) };
    }
  }

  function verdictOf(outcome, reference) {
    if (!outcome.built) return 'not applicable to this grammar';
    if (outcome.accepted === reference) return outcome.accepted ? 'accepts' : 'rejects';
    return 'DISAGREES with Earley';
  }

  /** Which parsers can be built for a grammar at all — the class question,
   *  asked once rather than per input. */
  function classify(grammar) {
    return PARSERS.map(function (name) {
      const outcome = safely(name, grammar, []);

      return { parser: name, applicable: outcome.built, reason: outcome.detail };
    });
  }

  /**
   * Every parser against Earley over every string up to `length`. This is the
   * acceptance criterion made runnable: a single disagreement is a named
   * input, not a percentage.
   */
  function sweep(grammar, length, only) {
    const alphabet = grammar.terminals;
    const failures = [];
    let checked = 0;

    exhaustive(alphabet, length).forEach(function (tokens) {
      const reference = RUNNERS.earley(grammar, tokens).accepted;

      (only || PARSERS).forEach(function (name) {
        const outcome = safely(name, grammar, tokens);

        if (!outcome.built) return;
        checked += 1;
        if (outcome.accepted === reference) return;
        failures.push({ parser: name, input: tokens.join(' ') || 'ε',
          got: outcome.accepted, expected: reference });
      });
    });
    return { checked: checked, failures: failures, clean: failures.length === 0 };
  }

  function exhaustive(alphabet, length) {
    let level = [[]];
    const out = [[]];

    for (let i = 0; i < length; i += 1) {
      const next = [];

      level.forEach(function (prefix) {
        alphabet.forEach(function (symbol) { next.push(prefix.concat([symbol])); });
      });
      next.forEach(function (tokens) { out.push(tokens); });
      level = next;
    }
    return out;
  }

  /* ------------------------------------------------------ the fixtures */

  /** The grammars the sections work with, in one place so a demo and its
   *  tests cannot drift apart. */
  const FIXTURES = {
    ambiguousSum: {
      label: 'ambiguous sum',
      start: 'E', productions: { E: [['E', '+', 'E'], ['a']] }
    },
    precedenceSum: {
      label: 'precedence and associativity',
      start: 'E',
      productions: {
        E: [['E', '+', 'T'], ['T']],
        T: [['T', '*', 'F'], ['F']],
        F: [['(', 'E', ')'], ['a']]
      }
    },
    danglingElse: {
      label: 'dangling else',
      start: 'S',
      productions: { S: [['i', 'E', 't', 'S'], ['i', 'E', 't', 'S', 'e', 'S'], ['x']],
        E: [['b']] }
    },
    leftRecursive: {
      label: 'left recursive',
      start: 'E', productions: { E: [['E', '+', 'T'], ['T']], T: [['a']] }
    },
    ll1Ready: {
      label: 'LL(1) after transformation',
      start: 'E',
      productions: { E: [['T', 'R']], R: [['+', 'T', 'R'], []], T: [['a']] }
    },
    balanced: {
      label: 'balanced brackets',
      start: 'S', productions: { S: [['(', 'S', ')', 'S'], []] }
    },
    nonLalr: {
      label: 'LR(1) but not LALR(1)',
      start: 'S',
      productions: {
        S: [['a', 'E', 'c'], ['a', 'F', 'd'], ['b', 'F', 'c'], ['b', 'E', 'd']],
        E: [['e']], F: [['e']]
      }
    },
    nullable: {
      label: 'four nullable symbols',
      start: 'S', productions: { S: [['A', 'A', 'A', 'A']], A: [['a'], []] }
    }
  };

  function fixture(name) {
    const spec = FIXTURES[name];

    return Grammar.create({ start: spec.start, productions: spec.productions,
      label: spec.label });
  }

  function fixtureNames() { return Object.keys(FIXTURES); }

  return {
    PARSERS: PARSERS, FIXTURES: FIXTURES,
    run: run, classify: classify, sweep: sweep, fixture: fixture,
    fixtureNames: fixtureNames, exhaustive: exhaustive
  };
}));
