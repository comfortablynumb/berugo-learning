/**
 * Every remaining track: how to use this site, and the seven tracks whose milestones are still planned.
 *
 * Track data only - no API. `core/curriculum.js` assembles these into the one
 * ordered syllabus every view renders from, and it is still the single source
 * of truth; this file exists because the syllabus outgrew a thousand lines and
 * will keep growing as milestones land. Splitting per track rather than per
 * milestone keeps the seam in a place that does not move.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CurriculumOtherTracks = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  return [
    {
      id: 'using-this-site',
      title: 'How to use this site',
      summary: 'What this is, how it runs your code, and the JavaScript everything here is built on.',
      groups: [
        {
          id: 'M00',
          title: 'Foundation',
          summary: 'What this is, how it runs your code, and the JavaScript it runs on.',
          sections: [
            {
              id: 'home',
              kind: 'page',
              title: 'Home',
              summary: 'The curriculum map and how to use it.'
            },
            {
              id: 'code-engine',
              kind: 'section',
              title: 'How this platform runs your code',
              summary: 'The worker sandbox, the message protocol, budgets and how exercises are graded.',
              tags: ['runner', 'workers', 'measurement', 'platform']
            },
            {
              id: 'js-systems',
              kind: 'section',
              title: 'JavaScript as a systems language',
              summary: 'Typed arrays, endianness, IEEE 754, int32 coercion, BigInt and Math.imul.',
              tags: ['typed arrays', 'bits', 'floating point', 'bigint', 'endianness']
            },
            {
              id: 'settings',
              kind: 'page',
              title: 'Progress and settings',
              summary: 'Theme, animation, progress export and reset.'
            }
          ]
        }
      ]
    },
    {
      id: 'architecture',
      title: 'Computer architecture',
      summary: 'From a gate to an out-of-order core, and the memory hierarchy underneath it.',
      groups: [],
      planned: [
        { id: 'M33', title: 'Digital logic and sequential circuits', sections: 10 },
        { id: 'M34', title: 'ISA, assembly, datapath and control', sections: 10 },
        { id: 'M35', title: 'Pipelining, hazards and branch prediction', sections: 9 },
        { id: 'M36', title: 'Superscalar, out-of-order execution and speculation', sections: 9 },
        { id: 'M37', title: 'Caches and the memory hierarchy', sections: 10 },
        { id: 'M38', title: 'Cache coherence and memory consistency', sections: 9 },
        { id: 'M39', title: 'Linking, loading and the ABI', sections: 9 },
        { id: 'M40', title: 'GPUs, SIMD and domain-specific accelerators', sections: 9 }
      ]
    },
    {
      id: 'operating-systems',
      title: 'Operating systems',
      summary: 'Processes, synchronisation, virtual memory, file systems, I/O and isolation.',
      groups: [],
      planned: [
        { id: 'M41', title: 'Processes, threads and scheduling', sections: 10 },
        { id: 'M42', title: 'Synchronisation, deadlock and the classic problems', sections: 10 },
        { id: 'M43', title: 'Virtual memory, paging and allocators', sections: 11 },
        { id: 'M44', title: 'File systems and crash consistency', sections: 10 },
        { id: 'M45', title: 'I/O, interrupts, event loops and async runtimes', sections: 10 },
        { id: 'M46', title: 'Virtualisation, containers and isolation', sections: 9 },
        { id: 'M47', title: 'Concurrency and parallelism in practice', sections: 11 }
      ]
    },
    {
      id: 'automata-and-compilers',
      title: 'Automata, languages and compilers',
      summary: 'Regular and context-free languages, computability, types, and a compiler you build.',
      groups: [
        {
          id: 'M24',
          title: 'Regular languages and finite automata',
          summary: 'Every regex, tokeniser and protocol state machine is a finite automaton; this milestone builds the whole toolkit and runs it.',
          sections: [
            {
              id: 'languages-and-the-hierarchy',
              title: 'Languages and the hierarchy',
              summary: 'Eight languages, each run against the weakest machine that recognises it, with a finite automaton checked string by string wherever one exists.',
              tags: ['alphabet', 'kleene star', 'language class', 'chomsky hierarchy', 'finite automaton', 'pushdown automaton', 'linear bounded', 'turing machine', 'undecidable', 'closure properties']
            },
            {
              id: 'deterministic-finite-automata',
              title: 'Deterministic finite automata',
              summary: 'Five machines run against an independent definition over every string up to length 8, with divisibility by 7 built from arithmetic rather than drawn by hand.',
              tags: ['five-tuple', 'transition function', 'trap state', 'state design', 'counting modulo k', 'suffix tracking', 'batch testing', 'minimality', 'myhill nerode', 'protocol state']
            },
            {
              id: 'nondeterminism-and-subsets',
              title: 'Nondeterminism and the subset construction',
              summary: 'The set of active states advancing per character, then determinised — with the exponential family measured at 256 minimal states for 18 positions, exactly the predicted bound.',
              tags: ['nfa', 'epsilon closure', 'subset construction', 'state explosion', 'lazy determinisation', 'thompson simulation', 'equivalence', 're2', 'linear matching', 'state sets']
            },
            {
              id: 'regular-expressions-and-constructions',
              title: 'Regular expressions and their constructions',
              summary: 'Thompson, Glushkov and Brzozowski built in parallel on one pattern with their state counts compared, then the regex read back off the minimal machine and checked.',
              tags: ['kleene theorem', 'thompson construction', 'glushkov automaton', 'position sets', 'brzozowski derivatives', 'similarity rules', 'state elimination', 'backreferences', 'lookaround', 'np-hard matching']
            },
            {
              id: 'minimisation-and-canonical-forms',
              title: 'Minimisation and canonical forms',
              summary: 'Moore, Hopcroft and Brzozowski minimise the same machine and a brute-force Myhill-Nerode count checks all three, with the witness suffix printed for every pair of classes.',
              tags: ['myhill nerode', 'partition refinement', 'moore algorithm', 'hopcroft', 'brzozowski double reversal', 'canonical form', 'equivalence testing', 'distinguishing suffix', 'trim', 'total machine']
            },
            {
              id: 'closure-and-the-product',
              title: 'Closure properties and the product construction',
              summary: 'One product construction, four accepting rules, and a containment check that returns the shortest string one language admits and the other refuses.',
              tags: ['closure', 'product construction', 'intersection', 'complement', 'total machine', 'emptiness', 'containment', 'counter-example', 'equivalence', 'policy comparison']
            },
            {
              id: 'proving-non-regularity',
              title: 'Proving a language is not regular',
              summary: 'The pumping lemma played as the game it is, with every decomposition the adversary may choose enumerated, beside a Myhill-Nerode family that also builds the machine when there is one.',
              tags: ['pumping lemma', 'quantifier alternation', 'adversary game', 'myhill nerode', 'distinguishing suffix', 'infinite family', 'non-regular languages', 'closure reduction', 'necessary condition', 'proof technique']
            },
            {
              id: 'transducers',
              title: 'Transducers',
              summary: 'Two text machines composed into one, checked against running them in sequence over 204 inputs, with a one-state case folder growing to 29 as a Moore machine.',
              tags: ['mealy', 'moore', 'finite state transducer', 'composition', 'epsilon output', 'deletion', 'weighted transducer', 'text normalisation', 'position information', 'single pass']
            },
            {
              id: 'automata-in-production',
              title: 'Automata in production',
              summary: 'A generated lexer showing every maximal-munch decision it passed over, and a structural ReDoS analyser that gets nine verdicts right and then explodes the flagged patterns.',
              tags: ['lexer generation', 'maximal munch', 'rule priority', 'keyword shadowing', 'statechart', 'orthogonal regions', 'history state', 'redos', 'ambiguity detection', 'backtracking blowup']
            },
            {
              id: 'weighted-and-probabilistic',
              title: 'Weighted and probabilistic automata',
              summary: 'Viterbi checked against every enumerated path, the posterior disagreeing with the best path, and plain probabilities reaching exactly zero at length 619.',
              tags: ['semiring', 'weighted automaton', 'hidden markov model', 'viterbi', 'trellis', 'forward backward', 'posterior', 'log domain', 'underflow', 'shortest path decoding']
            },
            {
              id: 'automata-over-infinite-words',
              title: 'Automata over infinite words',
              summary: 'Three systems checked against two properties, where the server that may wait forever passes safety and fails liveness with a lasso no finite test could find.',
              tags: ['buchi automaton', 'infinite words', 'lasso trace', 'nested depth first search', 'emptiness', 'safety', 'liveness', 'fairness', 'ltl', 'parity condition']
            }]
        },
        {
          id: 'M25',
          title: 'Context-free languages and parsing',
          summary: 'Not use a parser generator but knowing what each algorithm can and cannot do, why a grammar conflicts, how to fix it, and how real languages get parsed despite not being context-free.',
          sections: [
            {
              id: 'grammars-and-ambiguity',
              title: 'Grammars, derivations and ambiguity',
              summary: 'Every parse tree for an input enumerated, so ambiguity is a count rather than an opinion, with the shortest ambiguous string found by search.',
              tags: ['context-free grammar', 'derivation', 'parse tree', 'leftmost', 'rightmost', 'ambiguity', 'dangling else', 'precedence', 'associativity', 'inherent ambiguity']
            },
            {
              id: 'grammar-transformations',
              title: 'Grammar transformations',
              summary: 'Six transformations run in sequence with the language re-checked against the original at every step, and the input whose tree shape changed named.',
              tags: ['useless symbols', 'epsilon removal', 'unit productions', 'left recursion', 'paull algorithm', 'left factoring', 'chomsky normal form', 'greibach', 'differential testing', 'tree shape']
            },
            {
              id: 'pushdown-automata',
              title: 'Pushdown automata',
              summary: 'The stack drawn beside the tape with every nondeterministic branch alive at once, and the CFG to PDA construction checked against Earley string by string.',
              tags: ['pushdown automaton', 'stack', 'empty stack acceptance', 'final state acceptance', 'cfg to pda', 'nondeterminism', 'deterministic pda', 'dcfl', 'closure properties', 'pumping']
            },
            {
              id: 'top-down-parsing-and-ll1',
              title: 'Top-down parsing and LL(1)',
              summary: 'Every table cell traceable to the FIRST or FOLLOW computation that produced it, each conflict named with a minimal input reaching it, and the repair applied live.',
              tags: ['recursive descent', 'predictive parsing', 'first set', 'follow set', 'll1 table', 'table conflict', 'left recursion', 'left factoring', 'll star', 'error detection point']
            },
            {
              id: 'shift-reduce-and-lr0',
              title: 'Bottom-up parsing: shift-reduce and LR(0)/SLR',
              summary: 'The item-set automaton drawn and walked, with LR(0) conflicts dropping to zero under SLR on the same twelve states and every conflict naming its items.',
              tags: ['shift reduce', 'handle', 'viable prefix', 'lr0 items', 'closure', 'goto', 'action table', 'goto table', 'slr', 'shift reduce conflict']
            },
            {
              id: 'lalr-and-canonical-lr1',
              title: 'LALR and canonical LR(1)',
              summary: 'Fourteen canonical states merged to thirteen, and the two reduce/reduce conflicts that appear are shown to exist in neither LR(1) nor SLR.',
              tags: ['lr1 items', 'lookahead', 'state explosion', 'core merging', 'lalr', 'reduce reduce conflict', 'precedence declarations', 'yacc', 'bison', 'ielr']
            },
            {
              id: 'general-parsing-earley-cyk-glr',
              title: 'General parsing: Earley, CYK and GLR',
              summary: 'Three unrelated mechanisms agreeing on every input, and a forest of eighty-seven nodes holding sixteen thousand seven hundred and ninety-six distinct trees.',
              tags: ['earley', 'chart parsing', 'predict scan complete', 'cyk', 'chomsky normal form', 'glr', 'graph structured stack', 'sppf', 'shared packed forest', 'nullable rules']
            },
            {
              id: 'pegs-and-packrat-parsing',
              title: 'PEGs and packrat parsing',
              summary: 'Six hundred and six thousand plain steps against one hundred and twenty-four memoised ones, and the alternative that can never win named with the reason.',
              tags: ['parsing expression grammar', 'ordered choice', 'packrat', 'memoisation', 'syntactic predicates', 'greedy repetition', 'left recursion', 'unreachable alternative', 'linear time', 'peg semantics']
            },
            {
              id: 'pratt-parsing-and-precedence',
              title: 'Pratt parsing and expression precedence',
              summary: 'An editable binding-power table with ten expected parenthesisations asserted against it, so moving one number breaks exactly the cases that depend on it.',
              tags: ['pratt parsing', 'precedence climbing', 'binding power', 'null denotation', 'left denotation', 'right associativity', 'prefix operators', 'postfix operators', 'ternary', 'operator table']
            },
            {
              id: 'lexing-in-context',
              title: 'Lexing in context',
              summary: 'The same nested template through two lexers, where the one without a mode stack finds zero interpolations instead of two and reports no error at all.',
              tags: ['lexer parser split', 'maximal munch', 'keywords', 'soft keywords', 'context sensitive lexing', 'lexer modes', 'mode stack', 'offside rule', 'indent dedent', 'template literals']
            },
            {
              id: 'error-recovery-and-diagnostics',
              title: 'Error recovery and diagnostics',
              summary: 'Three strategies on one broken file: one diagnostic and one survivor, three and four, three and five, with cascade suppression as a control you can move.',
              tags: ['error detection', 'panic mode', 'synchronising tokens', 'phrase level recovery', 'error productions', 'repair cost model', 'cascade suppression', 'incremental reparsing', 'language server', 'diagnostic quality']
            },
            {
              id: 'parsing-real-languages',
              title: 'Parsing real languages',
              summary: 'Eight constructs where the published grammar is not the language, each with a runnable failing input and the fix that shipped, including six ASI cases asserted against the specification.',
              tags: ['lexer hack', 'typedef ambiguity', 'template angle brackets', 'most vexing parse', 'automatic semicolon insertion', 'restricted productions', 'soft keywords', 'yaml', 'scannerless parsing', 'semantic filters']
            }]
        },
        {
          id: 'M26',
          title: 'Computability and complexity theory',
          summary: 'The limits: what no program can do, and what no efficient program can do — with every claim separated into proved, believed, and best-known-algorithm.',
          sections: [
            {
              id: 'turing-machines',
              title: 'Turing machines',
              summary: 'The a-to-the-n b-to-the-n c-to-the-n machine checked against an independent definition over every string up to length seven, and a budget that expires as a third outcome rather than as a rejection.',
              tags: ['turing machine', 'configuration', 'transition function', 'acceptance', 'halting', 'multi-tape', 'nondeterminism', 'universal machine', 'church turing thesis', 'step budget']
            },
            {
              id: 'equivalent-models-of-computation',
              title: 'Equivalent models of computation',
              summary: 'One function run in three models with the answers compared and the costs printed: two steps for a RAM, linear for a counter machine, quadratic for a Turing machine.',
              tags: ['simulation', 'counter machine', 'minsky', 'ram model', 'cellular automaton', 'rule 110', 'tag system', 'ski combinators', 'lambda calculus', 'cost model']
            },
            {
              id: 'undecidability-and-diagonalisation',
              title: 'Undecidability and diagonalisation',
              summary: 'A contradiction produced against every candidate oracle including one that flips a coin, with two hundred arbitrary deciders defeated in the test suite and bounded halting decided beside it.',
              tags: ['decidable', 'recognisable', 'co-recognisable', 'diagonalisation', 'halting problem', 'cantor', 'acceptance problem', 'bounded halting', 'enumeration', 'semi-decision']
            },
            {
              id: 'reductions-and-the-rice-theorem',
              title: 'Reductions and the Rice theorem',
              summary: 'A reduction builder that prints the transformed program, and ten properties classified where four are undecidable and six are decidable for two quite different reasons.',
              tags: ['mapping reduction', 'program transformation', 'rice theorem', 'semantic property', 'syntactic property', 'static analysis', 'soundness', 'completeness', 'dead code', 'program equivalence']
            },
            {
              id: 'time-complexity-classes',
              title: 'Time complexity classes',
              summary: 'Fifteen problems with their class, best algorithm, best lower bound and open questions kept in four separate columns, and only eight of the bounds proved unconditionally.',
              tags: ['time class', 'p versus np', 'exptime', 'time hierarchy theorem', 'padding argument', 'certificate', 'polynomial church turing', 'galactic algorithm', 'lower bound', 'relativisation']
            },
            {
              id: 'space-bounded-computation',
              title: 'Space-bounded computation',
              summary: 'A memory meter counting bits as they are taken and released, so log space is a number: ten thousand bits for breadth-first search against a bound of three hundred at a thousand vertices.',
              tags: ['space complexity', 'log space', 'nl complete', 'savitch theorem', 'reachability', 'pspace', 'immerman szelepcsenyi', 'recomputation', 'working memory', 'space time tradeoff']
            },
            {
              id: 'randomised-and-interactive-classes',
              title: 'Randomised and interactive classes',
              summary: 'The soundness error of the graph-non-isomorphism protocol measured over thousands of runs and matching two to the minus k within three sigma at every round count.',
              tags: ['bpp', 'rp', 'zpp', 'amplification', 'interactive proof', 'graph non isomorphism', 'soundness', 'completeness', 'arthur merlin', 'pcp theorem']
            },
            {
              id: 'circuits-and-non-uniform-computation',
              title: 'Circuits and non-uniform computation',
              summary: 'Size against depth with correctness checked over every input: twenty-one gates eleven deep for a ripple carry, twenty-eight gates three deep for lookahead.',
              tags: ['boolean circuit', 'size', 'depth', 'parallel time', 'non uniform', 'p poly', 'ac0', 'nc', 'parity lower bound', 'natural proofs']
            },
            {
              id: 'kolmogorov-complexity-and-randomness',
              title: 'Kolmogorov complexity and randomness',
              summary: 'The counting bound checked by brute force over every string up to sixteen bits, with over ninety-nine per cent resisting every codec and one string whose one-line rule none of them finds.',
              tags: ['kolmogorov complexity', 'invariance theorem', 'incompressibility', 'counting argument', 'berry paradox', 'entropy', 'minimum description length', 'occam razor', 'upper bound', 'uncomputable']
            },
            {
              id: 'quantum-computation',
              title: 'Quantum computation',
              summary: 'Grover amplitudes matching sin squared of two k plus one theta to fifteen decimal places, with the peak at the predicted iteration and the over-rotation past it visible.',
              tags: ['qubit', 'superposition', 'entanglement', 'unitary gate', 'measurement', 'deutsch jozsa', 'grover', 'shor', 'bqp', 'post quantum']
            }]
        }
        ,
        {
          id: 'M27',
          title: 'Lambda calculus, type systems and semantics',
          summary: 'The theory behind every language feature engineers argue about, with each type system implemented as a checker that shows its work.',
          sections: [
            {
              id: 'the-untyped-lambda-calculus',
              title: 'The untyped lambda calculus',
              summary: 'Five strategies on one term where three finish in a step and two spend the whole budget, and a capture fixture whose naive answer is the identity and whose right answer is not.',
              tags: ['lambda calculus', 'free variables', 'capture avoiding substitution', 'alpha equivalence', 'beta reduction', 'eta', 'church encoding', 'y combinator', 'normal order', 'call by value']
            },
            {
              id: 'combinatory-logic-and-compilation',
              title: 'Combinatory logic and compilation',
              summary: 'Eleven nodes compiled to one hundred and seven by the plain algorithm and to one by the optimised one, with every fixture checked to compute the same function either way.',
              tags: ['combinator', 'ski', 'bckw', 'bracket abstraction', 'point free', 'graph reduction', 'schonfinkel', 'closure conversion', 'sharing', 'size blowup']
            },
            {
              id: 'operational-semantics',
              title: 'Operational semantics',
              summary: 'Three rule sets over one language: two agree on every answer and differ in every trace, and the third gets stuck on a branch that was never going to run.',
              tags: ['small step', 'big step', 'evaluation context', 'congruence rule', 'computation rule', 'stuck term', 'determinism', 'confluence', 'inference rules', 'interpreter']
            },
            {
              id: 'the-simply-typed-lambda-calculus',
              title: 'The simply typed lambda calculus',
              summary: 'All two hundred and fifteen terms of depth one typed and run: zero well-typed terms get stuck, and twenty-four rejected ones would have worked.',
              tags: ['typing judgement', 'context', 't-app', 'type checking', 'progress', 'preservation', 'soundness', 'strong normalisation', 'curry howard', 'conservatism']
            },
            {
              id: 'type-inference-and-hindley-milner',
              title: 'Type inference and Hindley-Milner',
              summary: 'The same body typed and rejected depending on one generalisation step, with every equation unification was asked to solve printed in the order it was asked.',
              tags: ['algorithm w', 'unification', 'occurs check', 'substitution composition', 'generalisation', 'instantiation', 'principal type', 'let polymorphism', 'value restriction', 'error messages']
            },
            {
              id: 'polymorphism-and-system-f',
              title: 'Polymorphism and System F',
              summary: 'The inhabitants of a polymorphic type counted by enumeration: exactly one for the identity type, exactly two for the next, and none at all for two others.',
              tags: ['system f', 'type abstraction', 'type application', 'rank 2', 'undecidable inference', 'parametricity', 'free theorem', 'existential type', 'erasure', 'turbofish']
            },
            {
              id: 'subtyping-and-variance',
              title: 'Subtyping and variance',
              summary: 'The covariant-array hole found by search rather than recalled, with the value that breaks each admitted pair and a check that the invariant version rejects both.',
              tags: ['subsumption', 'width subtyping', 'depth subtyping', 'contravariance', 'covariance', 'invariance', 'declaration site variance', 'array store exception', 'bounded quantification', 'join and meet']
            },
            {
              id: 'beyond-plain-generics',
              title: 'Beyond plain generics',
              summary: 'A constraint elaborated into the dictionary expression a compiler inserts, and the same goal resolving to a different dictionary once two instances overlap.',
              tags: ['type class', 'dictionary passing', 'instance resolution', 'superclass', 'coherence', 'overlapping instances', 'orphan instance', 'ambiguity', 'higher kinded', 'trait']
            },
            {
              id: 'algebraic-data-types-and-pattern-matching',
              title: 'Algebraic data types and pattern matching',
              summary: 'Incomplete matches answered with a value you could paste into a test, and four column heuristics compiling the same matrix to thirteen nodes or to nine.',
              tags: ['sum type', 'product type', 'recursive type', 'decision tree', 'maranget', 'usefulness', 'exhaustiveness', 'redundancy', 'witness', 'sealed types']
            },
            {
              id: 'denotational-and-axiomatic-semantics',
              title: 'Denotational and axiomatic semantics',
              summary: 'Nine annotated programs proved and separately executed, with two correct programs whose invariants are too weak and a formula that doubles per nested branch.',
              tags: ['hoare triple', 'weakest precondition', 'loop invariant', 'verification condition', 'partial correctness', 'denotational', 'least fixed point', 'bottom', 'bounded check', 'counterexample']
            },
            {
              id: 'substructural-types-and-ownership',
              title: 'Substructural types and ownership',
              summary: 'Twelve programs against four disciplines where the columns separate on exactly two structural rules, and every borrow error names the earlier line responsible.',
              tags: ['weakening', 'contraction', 'linear types', 'affine types', 'ownership', 'borrowing', 'move semantics', 'aliasing xor mutation', 'lifetime', 'session types']
            }]
        },
        {
          id: 'M28',
          title: 'Compiler front end — build a language',
          summary: 'Berugo, front to back: a scanner that survives malformed input, a parser that always returns a tree, and a differential interpreter that found four name captures and an off-by-one nobody had noticed.',
          sections: [
            {
              id: 'designing-a-language',
              title: 'Designing the language',
              summary: 'Eleven features scored twice — work in the parser and work in every stage after it — where the two rankings disagree and pattern matching costs five units nobody sees while writing the grammar.',
              tags: ['language design', 'specification', 'grammar production', 'typing rule', 'evaluation rule', 'non goals', 'conformance suite', 'pipeline', 'versioning', 'feature cost']
            },
            {
              id: 'the-lexer',
              title: 'The lexer',
              summary: 'A scanner that keeps every character reachable and turns three malformed literals into three error tokens without stopping, including the numeral that used to split silently into two valid tokens.',
              tags: ['scanner', 'token', 'span', 'trivia', 'error token', 'maximal munch', 'string interpolation', 'lexer modes', 'numeric literals', 'incremental relex']
            },
            {
              id: 'the-parser',
              title: 'The parser',
              summary: 'A tree that exists even for input the parser could not read, with error nodes exactly where the file broke and the statement after them parsed normally.',
              tags: ['recursive descent', 'pratt parsing', 'binding power', 'associativity', 'error node', 'recovery', 'resynchronisation', 'parse then validate', 'span', 'totality']
            },
            {
              id: 'ast-infrastructure',
              title: 'AST infrastructure',
              summary: 'Ten thousand generated programs parsed, printed and reparsed with no tree changing, and the same corpus through a printer with one line broken to show what the property is worth.',
              tags: ['visitor', 'traversal', 'pretty printer', 'minimal parentheses', 'round trip', 'property test', 'immutable rewriting', 'source map', 'node identity', 'ast versus cst']
            },
            {
              id: 'names-and-scopes',
              title: 'Names, scopes and resolution',
              summary: 'Four occurrences of one spelling resolving to two different bindings, and a rename that applies its edits, re-resolves, and refuses when anything changed meaning.',
              tags: ['lexical scope', 'scope tree', 'shadowing', 'binding table', 'occurrence keyed', 'capture analysis', 'closure', 'rename', 'did you mean', 'module resolution']
            },
            {
              id: 'type-checking-in-practice',
              title: 'Type checking and inference',
              summary: 'The same mistake checked twice, with and without an annotation, where both the diagnostic code and the underlined span move because the annotation is what gave the message somewhere to point.',
              tags: ['bidirectional checking', 'check mode', 'infer mode', 'unification', 'constraint order', 'generalisation', 'instantiation', 'type table', 'two spans', 'exhaustiveness']
            },
            {
              id: 'desugaring-to-a-core',
              title: 'Semantic analysis and desugaring',
              summary: 'Three lowerings that shipped wrong and were found by running the surface program beside its core: a function that called itself forever, a loop that read one element past the end, and a guard that divided by zero.',
              tags: ['desugaring', 'core language', 'lowering', 'hygiene', 'name capture', 'short circuit', 'span preservation', 'constant folding', 'differential testing', 'continue']
            },
            {
              id: 'diagnostics-as-a-product',
              title: 'Diagnostics as a product',
              summary: 'Twelve mistakes producing fifteen true messages, cut to twelve by three rules that are each switchable and each counted, plus quick fixes verified by applying them and rechecking.',
              tags: ['diagnostic model', 'severity', 'primary span', 'secondary span', 'cascade suppression', 'stage gating', 'quick fix', 'machine applicable', 'language server', 'incremental recheck']
            },
            {
              id: 'testing-a-front-end',
              title: 'Testing the front end',
              summary: 'Four properties over ten thousand generated programs, each reported beside the number of failures a deliberately broken implementation produces, and a table of what every oracle is blind to.',
              tags: ['property testing', 'round trip', 'grammar driven generation', 'fuzzing', 'mutation', 'differential testing', 'golden files', 'conformance', 'purity', 'oracle blind spots']
            }]
        },
        {
          id: 'M29',
          title: 'IR, SSA and optimisation',
          summary: 'The middle end of the Berugo compiler, where every pass is gated by a verifier that names the invariant it broke and a differential run that catches the ones producing perfectly valid IR and the wrong answer.',
          sections: [
            {
              id: 'designing-an-ir',
              title: 'Designing an intermediate representation',
              summary: 'A verifier with nine named invariants and five ways to break it on purpose, beside seventeen programs that lower, verify, and compute exactly what the core language computed.',
              tags: ['three address code', 'virtual registers', 'typed ir', 'basic blocks', 'verifier', 'invariants', 'lowering', 'slots', 'spans', 'differential testing']
            },
            {
              id: 'control-flow-graphs',
              title: 'Control-flow graphs',
              summary: 'Loop membership checked against a brute-force path enumeration, including the fixture where a continue gives one loop two latches and a naive finder reports two loops sharing every block.',
              tags: ['basic block', 'back edge', 'natural loop', 'loop nesting', 'critical edge', 'reducibility', 'unreachable blocks', 'join', 'split', 'cfg simplification']
            },
            {
              id: 'dominators',
              title: 'Dominators',
              summary: 'The whole dominator tree checked against removing each block and asking what became unreachable, plus the six different questions six different passes all reduce to a walk up it.',
              tags: ['dominance', 'immediate dominator', 'dominator tree', 'cooper harvey kennedy', 'reverse postorder', 'dominance frontier', 'post dominance', 'fixpoint', 'virtual exit', 'brute force oracle']
            },
            {
              id: 'ssa-form',
              title: 'SSA form',
              summary: 'Every phi shown beside the dominance frontier that justified it, the placed and pruned counts that are the whole of minimal versus pruned, and a swap fixture where destruction needs a temporary.',
              tags: ['single assignment', 'phi function', 'cytron', 'dominance frontier', 'renaming', 'dominator tree walk', 'pruned ssa', 'destruction', 'swap problem', 'parallel copies']
            },
            {
              id: 'dataflow-analysis',
              title: 'Dataflow analysis',
              summary: 'Four analyses that look different running through one worklist loop with four settings, and liveness checked against a path enumeration on every fixture.',
              tags: ['lattice', 'transfer function', 'meet', 'worklist', 'fixpoint', 'monotonicity', 'liveness', 'reaching definitions', 'available expressions', 'very busy expressions']
            },
            {
              id: 'scalar-optimisations',
              title: 'Scalar optimisations',
              summary: 'A division by zero on a branch that cannot be taken, which constant propagation must leave and SCCP removes along with the branch, and the same two passes run both ways round with the counts.',
              tags: ['copy propagation', 'dead code elimination', 'global value numbering', 'sccp', 'peephole', 'algebraic identities', 'constant folding', 'phase ordering', 'dominator scoping', 'faulting folds']
            },
            {
              id: 'loop-optimisations',
              title: 'Loop optimisations',
              summary: 'A division whose guard is the loop condition, hoisted by the naive pass into a program that then divides by zero, and refused by the safe one with the dominance reason named.',
              tags: ['loop invariant code motion', 'preheader', 'fault safety', 'dominance of exits', 'induction variables', 'strength reduction', 'unswitching', 'loop nesting cost', 'speculation', 'aliasing precondition']
            },
            {
              id: 'interprocedural-optimisation',
              title: 'Interprocedural optimisation',
              summary: 'Two records in one program separated by an escape analysis that gives a reason rather than a verdict, and a call graph whose indirect column is the precision a whole-program pass must not assume away.',
              tags: ['call graph', 'indirect call', 'inlining', 'cost benefit', 'budget', 'recursion', 'escape analysis', 'stack allocation', 'tail call', 'devirtualisation']
            },
            {
              id: 'alias-analysis',
              title: 'Memory and alias analysis',
              summary: 'Two records merged at a join where inclusion keeps them apart and unification merges them permanently, with both checked against a record of which registers really held the same object.',
              tags: ['points to analysis', 'andersen', 'steensgaard', 'may alias', 'soundness', 'dynamic oracle', 'load forwarding', 'memory ssa', 'restrict', 'ownership']
            },
            {
              id: 'verifying-the-optimiser',
              title: 'Verifying the optimiser',
              summary: 'The Csmith loop at page scale: generate, compile, compare, and shrink a twenty-line failure to four lines while keeping it a valid program that fails at the same pass in the same way.',
              tags: ['ir verifier', 'differential testing', 'random program generation', 'fuzzing', 'shrinking', 'minimal repro', 'translation validation', 'gates', 'oracle blind spots', 'csmith']
            }]
        },
        {
          id: 'M30',
          title: 'Code generation, bytecode VMs and JIT',
          summary: 'The back end of the Berugo compiler: two bytecodes, a stepping VM, instruction selection, register allocation, scheduling, a real WebAssembly module, a tiered JIT with deoptimisation, and a benchmark protocol that refuses to print a single sample.',
          sections: [
            {
              id: 'bytecode-design',
              title: 'Bytecode design',
              summary: 'Two code generators over one IR, with instructions, encoded bytes and executed dispatches measured side by side and a differential column so a smaller number can never be a wrong one.',
              tags: ['stack machine', 'register machine', 'dispatch', 'instruction encoding', 'constant pool', 'superinstructions', 'jump patching', 'virtual registers', 'disassembly', 'jvm lua cpython v8']
            },
            {
              id: 'building-the-interpreter',
              title: 'Building the interpreter',
              summary: 'A machine stopped between two instructions, with its operand stack, locals, upvalues and frames all objects you can look at, and the one switch that decides what a loop-captured variable means.',
              tags: ['dispatch loop', 'call frames', 'calling convention', 'closures', 'upvalues', 'open and closed', 'step debugger', 'breakpoints', 'unwinding', 'stack trace']
            },
            {
              id: 'instruction-selection',
              title: 'Instruction selection',
              summary: 'A cost slider that moves the selection with nothing recompiled, and every chosen cover checked against an exhaustive search of every possible cover.',
              tags: ['tree tiling', 'dynamic programming', 'burs', 'cost model', 'addressing modes', 'complex instructions', 'commutativity', 'retargeting', 'covering problem', 'optimal cover']
            },
            {
              id: 'register-allocation',
              title: 'Register allocation',
              summary: 'Graph colouring against linear scan on the same function, with spills plotted against the register count and both allocations verified against a liveness pass neither produced.',
              tags: ['live ranges', 'interference graph', 'graph colouring', 'chaitin briggs', 'coalescing', 'spilling', 'linear scan', 'interval splitting', 'precolouring', 'verification']
            },
            {
              id: 'machine-scheduling',
              title: 'Scheduling and peephole at the machine level',
              summary: 'One block through two orders and one pipeline model, with register pressure reported beside the cycle count so the trade between the two passes is visible rather than argued.',
              tags: ['dependence dag', 'list scheduling', 'critical path', 'latency', 'stalls', 'register pressure', 'memory edges', 'block layout', 'delay slots', 'phase ordering']
            },
            {
              id: 'targeting-webassembly',
              title: 'Targeting WebAssembly',
              summary: 'A module built byte by byte, validated by the browser rather than by this compiler, instantiated and compared against the interpreter — with the numeric subset stated per program rather than hidden.',
              tags: ['wasm module', 'leb128', 'sections', 'structured control flow', 'stackifier', 'relooper', 'reducibility', 'linear memory', 'traps', 'subset']
            },
            {
              id: 'jit-compilation',
              title: 'JIT compilation',
              summary: 'A function crossing a hotness threshold, being recompiled with guards the profile justified, and falling back to the interpreter mid-instruction when one of them does not hold.',
              tags: ['tiering', 'hotness counters', 'profiling', 'speculation', 'guards', 'deoptimisation', 'on-stack replacement', 'warm-up', 'closure compilation', 'deopt blacklist']
            },
            {
              id: 'inline-caches',
              title: 'Inline caches and object shapes',
              summary: 'The same fields written in two orders, costing a site its monomorphic state, with the cliff past the polymorphic limit measured rather than described.',
              tags: ['hidden classes', 'shapes', 'transition tree', 'inline cache', 'monomorphic', 'polymorphic', 'megamorphic', 'dictionary mode', 'property offsets', 'method dispatch']
            },
            {
              id: 'runtime-support',
              title: 'Runtime support',
              summary: 'A stack map checked against what the program actually reads next, and a source-level stack trace out of the same metadata, from a fault two calls deep.',
              tags: ['calling convention', 'stack maps', 'safepoints', 'precise collection', 'conservative collection', 'stack traces', 'source maps', 'spans', 'inlining metadata', 'runtime boundary']
            },
            {
              id: 'measuring-a-runtime',
              title: 'Measuring a language runtime',
              summary: 'A bake-off across every execution mode with warm-up separated and the run count attached, beside the same work measured the way people actually measure it.',
              tags: ['benchmarking', 'warm-up', 'steady state', 'median and spread', 'compile time', 'dead code elimination', 'constant folding', 'microbenchmark pathologies', 'deterministic units', 'honest reporting']
            }]
        }
      ],
      planned: [
        { id: 'M31', title: 'Garbage collection and runtime memory', sections: 9 },
        { id: 'M32', title: 'Program analysis, SAT/SMT and verification', sections: 11 }
      ]
    },
    {
      id: 'networking',
      title: 'Networking',
      summary: 'Link layer to the web stack, with the protocols simulated rather than described.',
      groups: [],
      planned: [
        { id: 'M48', title: 'Link layer, IP and routing', sections: 9 },
        { id: 'M49', title: 'Transport: TCP, UDP, QUIC and congestion control', sections: 10 },
        { id: 'M50', title: 'DNS, TLS and the web protocol stack', sections: 10 }
      ]
    },
    {
      id: 'data-systems',
      title: 'Data systems',
      summary: 'Storage engines, query processing and transactions, built rather than configured.',
      groups: [],
      planned: [
        { id: 'M51', title: 'Storage engines and indexes', sections: 10 },
        { id: 'M52', title: 'Query processing and optimisation', sections: 10 },
        { id: 'M53', title: 'Transactions, isolation and recovery', sections: 10 }
      ]
    },
    {
      id: 'distributed-systems',
      title: 'Distributed systems',
      summary: 'Time, replication, consensus, partitioning and the failure modes they exist for.',
      groups: [],
      planned: [
        { id: 'M54', title: 'Distributed time, consistency and replication', sections: 10 },
        { id: 'M55', title: 'Consensus and fault tolerance', sections: 9 },
        { id: 'M56', title: 'Partitioning, membership, gossip and CRDTs', sections: 10 },
        { id: 'M57', title: 'Stream processing and resilience engineering', sections: 10 }
      ]
    },
    {
      id: 'engineering-practice',
      title: 'Engineering practice',
      summary: 'Performance, security, architecture, observability and the data types that bite.',
      groups: [],
      planned: [
        { id: 'M58', title: 'Performance engineering and queueing theory', sections: 10 },
        { id: 'M59', title: 'Security engineering and side channels', sections: 11 },
        { id: 'M60', title: 'Software architecture, API and schema design', sections: 11 },
        { id: 'M61', title: 'Testing, debugging and observability', sections: 10 },
        { id: 'M62', title: 'Systems data: Unicode, time, serialisation, RNG and IDs', sections: 10 }
      ]
    },
    {
      id: 'practice-and-mastery',
      title: 'Practice and mastery',
      summary: 'Capstones that assemble the tracks, and the arena that keeps them fresh.',
      groups: [],
      planned: [
        { id: 'M63', title: 'Build-your-own-X capstones', sections: 12 },
        { id: 'M64', title: 'Challenge arena, progress and spaced repetition', sections: 8 }
      ]
    }
  ];
}));
