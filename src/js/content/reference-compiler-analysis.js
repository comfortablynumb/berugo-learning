/** Reference entries for AST tooling, resolution and type checking (M28.4-M28.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'ast-infrastructure': {
      summary: 'Two thousand generated programs round-tripping with zero failures, and the same ' +
        'corpus through a printer with one line changed failing 106 of them — which is the ' +
        'number that makes the zero mean anything.',
      intuition: 'Parse, print, reparse, compare the trees ignoring spans; then break the ' +
        'printer on purpose and see how many the property catches.',
      formulation: {
        equations: [
          {
            label: 'Two printers, one corpus',
            expr: 'printer · checked · round trips · fails',
            terms: [
              { sym: 'the real printer', meaning: '2 000 · 2 000 · 0' },
              { sym: 'right-operand power dropped', meaning: '2 000 · 1 894 · 106, a rate of 5.3%' },
              { sym: 'at ten thousand programs', meaning: '0 failures, about 550 milliseconds' },
              { sym: 'why not near 100%', meaning: 'most generated expressions have nothing bracketable on the right' }
            ]
          },
          {
            label: 'The same tree at three indent widths',
            expr: 'indent · characters · lines · tree unchanged',
            terms: [
              { sym: 'two spaces', meaning: '88 · 7 · yes' },
              { sym: 'four spaces', meaning: '100 · 7 · yes' },
              { sym: 'a tab', meaning: '82 · 7 · yes' },
              { sym: 'the check', meaning: 'one extra parse per formatting' }
            ]
          },
          {
            label: 'Traversal costs on an eighteen-node function',
            expr: 'query · nodes touched',
            terms: [
              { sym: 'count the nodes', meaning: '18' },
              { sym: 'measure the depth', meaning: '18, and the answer is 9' },
              { sym: 'collect every name', meaning: '18, and the answer is five names' },
              { sym: 'what is at offset 40', meaning: '9 — the depth, not the size' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A tree survives being printed and reparsed',
          why: 'It is the cheapest way to find a disagreement between the parser and the printer.',
          breaks: 'The sweep compares trees ignoring spans over thousands of generated programs and reports the first differing path.'
        },
        {
          name: 'The property is measured against a broken implementation',
          why: 'Zero failures is equally consistent with a working property and an unambitious generator.',
          breaks: 'Both printers run over the same corpus every time the controls change, and both columns are reported.'
        },
        {
          name: 'Reformatting does not change the tree',
          why: 'It is the property a formatter must have and the one that is never tested.',
          breaks: 'Three indent widths, three reparses, three tree comparisons.'
        }
      ],
      complexity: [
        { operation: 'one round trip', average: 'O(source)', worst: 'two parses and one print' },
        { operation: 'a sweep', average: 'O(programs × source)', worst: '10 000 programs in about 550 milliseconds' },
        { operation: 'tree equality ignoring spans', average: 'O(nodes)', worst: 'O(nodes), stopping at the first difference' },
        { operation: 'nodeAt', average: 'O(depth)', worst: 'O(nodes) on a fully left-leaning tree' },
        { operation: 'collect with a predicate', average: 'O(nodes)', worst: 'O(nodes)' }
      ],
      failureModes: [
        {
          symptom: 'A property test suite reports zero failures and finds no bugs.',
          cause: 'Nobody checked that the property fails on known-bad code.',
          fix: 'Run the same corpus through a deliberately broken implementation and report the catch rate.'
        },
        {
          symptom: 'The formatter changed the meaning of a program.',
          cause: 'The printer\'s bracket rule disagrees with the parser\'s precedence.',
          fix: 'Share one table, and assert tree equality after reformatting rather than reading the diff.'
        },
        {
          symptom: 'Adding a node kind silently breaks one traversal.',
          cause: 'Each walker has its own idea of which children a node has.',
          fix: 'Define children once in a table and derive every walker from it.'
        },
        {
          symptom: 'Hover is slow on a large file.',
          cause: 'The editor query walks the whole tree instead of descending into the child containing the offset.',
          fix: 'Use spans to descend; the cost becomes the depth rather than the size.'
        }
      ],
      inTheWild: [
        'rustfmt and prettier, both of which are minimal-parenthesis printers over the parser\'s own precedence.',
        'roslyn\'s syntax trees, where the round-trip property is a hard invariant because trivia is preserved.',
        'QuickCheck and Hypothesis, whose whole method is generate-and-check with a shrinker.',
        'The Go standard library\'s go/printer and go/parser, tested against each other over the entire standard library.'
      ],
      sources: [
        { title: 'Claessen and Hughes — QuickCheck (2000)', note: 'property-based testing, and why generation beats enumeration' },
        { title: 'Wadler — A prettier printer (2003)', note: 'the layout algebra behind most modern printers' },
        { title: 'Appel — Modern Compiler Implementation in ML', note: 'AST design, visitors and the abstract-concrete distinction' },
        { title: 'Microsoft — roslyn syntax tree design notes', note: 'full fidelity, trivia, and what round-tripping costs' }
      ]
    },

    'names-and-scopes': {
      summary: 'Four scopes and seven bindings in a seven-line file where two of three spellings ' +
        'mean more than one thing, and a rename that applies its edits, re-resolves, and refuses ' +
        'when any name changed meaning.',
      intuition: 'Resolve once into a table keyed by occurrence; capture analysis, ' +
        'go-to-definition and rename are then lookups rather than passes.',
      formulation: {
        equations: [
          {
            label: 'The shadowing fixture',
            expr: 'measure · value',
            terms: [
              { sym: 'scopes', meaning: '4 — global, the function, its block, and the lambda' },
              { sym: 'bindings', meaning: '7, excluding the four builtins' },
              { sym: 'captured', meaning: '1 — the lambda uses b, which the function owns' },
              { sym: 'a', meaning: '3 occurrences resolving to 2 bindings' },
              { sym: 'b', meaning: '2 occurrences resolving to 2 bindings' }
            ]
          },
          {
            label: 'Rename outcomes on the same fixture',
            expr: 'request · outcome',
            terms: [
              { sym: 'the parameter a to p', meaning: '2 edits, structure identical, allowed' },
              { sym: 'the outer a to renamed', meaning: '3 edits, allowed' },
              { sym: 'the outer a to b', meaning: 'refused — b is already bound in that scope' },
              { sym: 'a to let', meaning: 'refused before any edit — not a valid identifier' },
              { sym: 'the verification cost', meaning: 'one extra parse and one extra resolution' }
            ]
          },
          {
            label: 'Suggestions, and the threshold',
            expr: 'written · suggestion · distance',
            terms: [
              { sym: 'valu', meaning: 'value · 1' },
              { sym: 'totl', meaning: 'total · 1' },
              { sym: 'accumulator', meaning: 'none offered · more than 3' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The binding table answers per occurrence, not per name',
          why: 'Two references spelled the same can be different bindings, and a rename must separate them.',
          breaks: 'The shadowing table reports occurrences and distinct bindings as two columns, and they differ.'
        },
        {
          name: 'A rename verifies itself by re-resolving',
          why: 'Capture can happen in a scope the renamer never inspected.',
          breaks: 'The edits are applied, the result is resolved from scratch, and the reference-to-binding structure must be identical.'
        },
        {
          name: 'A suggestion is withheld beyond three edits',
          why: 'A wrong guess costs more than a blank, because after two of them nobody reads the line.',
          breaks: 'The typo fixture includes a name close to nothing, and its suggestion column is empty on purpose.'
        },
        {
          name: 'A capture is recorded for every function between the use and the binding',
          why: 'Each of them has to carry the value, so reporting only the innermost understates the cost.',
          breaks: 'The capture walk ascends to the owning function, and the demo lists every link.'
        }
      ],
      complexity: [
        { operation: 'resolving a file', average: 'O(nodes)', worst: 'O(nodes × scope depth) for a lookup chain' },
        { operation: 'one name lookup', average: 'O(depth)', worst: 'O(depth) — a walk up the scope chain' },
        { operation: 'find all references', average: 'O(references)', worst: 'a filter over the reference list' },
        { operation: 'rename', average: 'O(source) plus one resolution', worst: 'the edits, a reparse and a re-resolution' },
        { operation: 'the nearest-name suggestion', average: 'O(visible names × name length squared)', worst: 'capped at edit distance 3, so most candidates exit early' }
      ],
      failureModes: [
        {
          symptom: 'A rename compiles and the program behaves differently.',
          cause: 'The rename matched a spelling rather than a binding.',
          fix: 'Key the table by occurrence and edit only the occurrences of the chosen binding.'
        },
        {
          symptom: 'Go-to-definition requires running the type checker.',
          cause: 'Names are resolved inline in the checker rather than into a table.',
          fix: 'Make resolution a separate pass. Everything downstream becomes a lookup.'
        },
        {
          symptom: 'A closure reads a stale value.',
          cause: 'A captured binding was left on the stack frame that created it.',
          fix: 'Record captures during resolution and let escape analysis move them; the capture list is the input it needs.'
        },
        {
          symptom: 'Nobody trusts the "did you mean" suggestions.',
          cause: 'They are offered at any distance, so most of them are wrong.',
          fix: 'Cap the edit distance and offer nothing beyond it.'
        },
        {
          symptom: 'Two mutually recursive functions cannot both be defined.',
          cause: 'Function declarations are not visible before their bodies are walked.',
          fix: 'Hoist declarations into the scope before walking any body; keep let bindings sequential.'
        }
      ],
      inTheWild: [
        'Every language server implementing textDocument/rename, all of which must handle shadowing.',
        'rustc\'s resolver, a separate pass producing a table the borrow checker and the type checker both read.',
        'The TypeScript compiler\'s symbol table, which is what makes its refactorings possible at all.',
        'JavaScript engines\' scope analysis, where capture detection decides what can stay on the stack.'
      ],
      sources: [
        { title: 'Appel — Modern Compiler Implementation in ML, chapter 5', note: 'symbol tables and scope, with the table as the deliverable' },
        { title: 'Aho, Lam, Sethi and Ullman — chapter 2 and 7', note: 'scope, environments and activation records' },
        { title: 'Microsoft — Language Server Protocol, rename and prepareRename', note: 'why a server is expected to refuse a rename rather than guess' },
        { title: 'Levenshtein — Binary codes capable of correcting deletions (1966)', note: 'the distance the suggestion threshold is measured in' }
      ]
    },

    'type-checking-in-practice': {
      summary: 'Three mistakes checked twice, with and without an annotation, where two change ' +
        'their diagnostic code and two change what is underlined — and the third does not move, ' +
        'which is the case that states the rule.',
      intuition: 'Infer derives a type from a term and check pushes an expected type inward; an ' +
        'annotation is the switch, and its value is that it gives the message somewhere to point.',
      formulation: {
        equations: [
          {
            label: 'The same mistake, annotated and not',
            expr: 'program · code · underlined',
            terms: [
              { sym: 'let n = true; let total = n + 1;', meaning: 'E-TYPE-MISMATCH · n' },
              { sym: 'let n: Number = true; ...', meaning: 'E-TYPE-ANNOTATION · true' },
              { sym: 'let p = { x: true }; let s = p.x + 1;', meaning: 'E-TYPE-MISMATCH · p.x' },
              { sym: 'let p: { x: Number } = { x: true }; ...', meaning: 'E-TYPE-ANNOTATION · { x: true }' },
              { sym: 'double(true), annotated or not', meaning: 'E-TYPE-CALL · double(true) — unchanged, because the call was already where the types met' }
            ]
          },
          {
            label: 'A three-line program, checked',
            expr: 'measure · value',
            terms: [
              { sym: 'constraints', meaning: '2, of which 1 is unsolvable' },
              { sym: 'the failure', meaning: 'Bool against Number at offsets 42 to 46' },
              { sym: 'the diagnostic', meaning: 'plus needs a Number on the right; blaming flag, required by n + flag' },
              { sym: 'the type table', meaning: '8 entries, and flag is Bool in it — not the Number that was wanted' }
            ]
          },
          {
            label: 'The conformance suite, against the stated types',
            expr: 'measure · value',
            terms: [
              { sym: 'programs agreeing', meaning: '17 of 17 infer exactly the stated type' },
              { sym: 'constraints, smallest', meaning: '4 on arithmetic' },
              { sym: 'constraints, largest', meaning: '6 on while' },
              { sym: 'why exact', meaning: 'a checker inferring Number for everything would pass a weaker assertion on most rows' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every mismatch carries two spans',
          why: 'Naming only one end produces a message true of a great many programs.',
          breaks: 'Each error records the expression and whatever imposed the expectation, and the demo marks both.'
        },
        {
          name: 'The type table records what a node has, not what was wanted of it',
          why: 'Recording the expectation makes hover state something false on the error path.',
          breaks: 'A failed check records the actual type; the demo shows Bool for the Bool in a Number position.'
        },
        {
          name: 'The suite asserts the exact type, not that checking succeeded',
          why: 'A checker that inferred Number for everything would pass the weaker version.',
          breaks: 'Every conformance program states its type and the table compares against it.'
        },
        {
          name: 'The environment maps names to schemes and holds nothing else',
          why: 'Generalisation walks every key and reads a scheme off each value.',
          breaks: 'A sentinel stored under a reserved key crashed the checker on the first function containing a let.'
        }
      ],
      complexity: [
        { operation: 'checking a program', average: 'O(nodes) constraints, each solved by unification', worst: 'unification is near-linear with union-find and quadratic without' },
        { operation: 'one unification', average: 'O(type size)', worst: 'O(type size), with the occurs check on every binding' },
        { operation: 'generalisation at a let', average: 'O(environment size × type size)', worst: 'the whole environment is scanned for free variables' },
        { operation: 'instantiation at a use', average: 'O(quantified variables)', worst: 'one fresh variable per quantifier' },
        { operation: 'the type table', average: 'one entry per expression node', worst: '15 entries for an 18-node program' }
      ],
      failureModes: [
        {
          symptom: 'An inference error points at a line that is obviously correct.',
          cause: 'The blame lands where the traversal reached the contradiction, not where the mistake is.',
          fix: 'Add an annotation between the mistake and the collision; it splits the constraint set and moves the blame.'
        },
        {
          symptom: 'The error message says a type cannot be unified with another and names no location.',
          cause: 'The failure was reported by unification, which has no idea where either type came from.',
          fix: 'Record both spans at the point the constraint is created, before unification is called.'
        },
        {
          symptom: 'Hover reports the wrong type on an expression that failed to check.',
          cause: 'The checker recorded the expected type rather than the actual one.',
          fix: 'Record the expectation only when the constraint solved.'
        },
        {
          symptom: 'A function that used to check now crashes the compiler.',
          cause: 'Something that is not a type scheme was stored in the type environment.',
          fix: 'Keep the environment to one kind of value, and add a conformance program for the shape that exposed it.'
        },
        {
          symptom: 'Adding a constructor to a sum type breaks nothing and then breaks production.',
          cause: 'Every match has a default case, so exhaustiveness checking has nothing to say.',
          fix: 'Reject inexhaustive matches and name the missing constructor; a default case makes the check worthless.'
        }
      ],
      inTheWild: [
        'The OCaml and Haskell type checkers, both Hindley-Milner with generalisation at let and both famous for distant error locations.',
        'rustc, whose bidirectional checking and two-span diagnostics are the reference for message quality.',
        'The TypeScript compiler, whose contextual typing is check mode by another name.',
        'Elm, whose error messages are its principal design goal and are built on keeping both spans and the connecting constraint.'
      ],
      sources: [
        { title: 'Pierce — Types and Programming Languages, chapters 22 and 11', note: 'inference, unification and the record extensions' },
        { title: 'Damas and Milner — Principal type-schemes for functional programs (1982)', note: 'the algorithm and the generalisation rule' },
        { title: 'Dunfield and Krishnaswami — Complete and Easy Bidirectional Typechecking (2013)', note: 'check and infer as a discipline rather than an implementation detail' },
        { title: 'The Elm compiler\'s error message design notes', note: 'the argument that a type error is a UX artefact' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
