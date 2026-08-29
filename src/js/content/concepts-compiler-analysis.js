/** Concepts for AST tooling, resolution and type checking (M28.4-M28.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'ast-infrastructure': [
      {
        term: 'The round-trip property',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["parse the source"] --> B["print the tree back out"]',
            '    B --> C["parse THAT"]',
            '    C --> D{"do the two trees match?"}',
            '    D -->|yes| E["the printer and parser agree"]',
            '    D -->|no| F["one of them is wrong,<br/>and the test names the node"]'
          ].join('\n'),
          caption: 'One property test covers the printer, the parser and their agreement, on every input you can generate — and it needs no expected output written by hand.'
        },
        plain: 'Parse, print, reparse, and the two trees must match.',
        formal: 'equal ignoring spans, over 2 000 generated programs with 0 failures',
        detail: 'It needs no expected output, so it can be run over generated programs by the ' +
          'thousand, and every failure is a genuine disagreement between two components that ' +
          'are supposed to agree. That makes it the cheapest parser test there is and the one ' +
          'that finds the most, because hand-written cases are the ones somebody could hold in ' +
          'their head and generated ones are not.',
        example: 'Raising the sweep to 10 000 programs still gives zero failures, in about half ' +
          'a second.'
      },
      {
        term: 'Ignoring spans is not a weakening',
        plain: 'The second parse assigns offsets into a different string.',
        formal: 'comparing spans would fail on formatting alone',
        detail: 'The printed text is not the original text — the author\'s whitespace is gone — ' +
          'so every offset in the reparsed tree differs and a span-aware comparison would report ' +
          'a failure for every program. What must survive is the structure: same kinds, same ' +
          'names, same nesting, same operators. Being precise about which parts of an artefact a ' +
          'property covers is what stops a property from being either vacuous or impossible.',
        example: 'The same source at two spaces, four spaces and a tab prints to 88, 100 and 82 ' +
          'characters, and all three reparse to one tree.'
      },
      {
        term: 'A minimal-parentheses printer is a precedence-table consumer',
        plain: 'A child needs brackets when its power is lower than the position requires.',
        formal: 'one line, reading the same table the parser reads',
        detail: 'Minimal rather than faithful is the property that matters. A printer that ' +
          'reproduces every bracket it was given is faithful and tests nothing, because it never ' +
          'has to decide. A printer that emits the fewest brackets the parser needs has to ' +
          'consult precedence at every binary node, which is what makes a disagreement with the ' +
          'parser show up — and sharing the table is what makes that disagreement impossible.',
        example: '1 + (2 * 3) prints as 1 + 2 * 3 because times already binds tighter, while ' +
          '1 - (2 - 3) keeps its brackets because removing them changes the tree.'
      },
      {
        term: 'A property that has never failed cannot be trusted',
        plain: 'Measure the property against a deliberately broken implementation.',
        formal: '106 of 2 000 programs fail with the right-operand power dropped — 5.3%',
        detail: 'Zero failures against a correct implementation is what you expect and tells you ' +
          'nothing on its own: it is equally consistent with a property that works and with a ' +
          'generator that never produced anything hard. Running the same corpus through a ' +
          'version with one line changed gives the property\'s sensitivity as a number. The rate ' +
          'is not near 100% because most generated expressions do not need brackets on the ' +
          'right, and a sabotage that failed everything would be too coarse to locate anything.',
        example: 'The broken printer makes 1 - (2 - 3) print as 1 - 2 - 3, and the reparse gives ' +
          'a tree whose first difference the demo names by path.'
      },
      {
        term: 'One children table, every walker',
        plain: 'Traversal is defined once, by which children each node kind has.',
        formal: 'visit, collect, nodeAt, countNodes, depth and the printer all read CHILDREN',
        detail: 'Adding a node kind is then one line rather than an audit of nine walkers, and ' +
          'the walker that gets missed in the audit is the one that silently skips the new kind ' +
          'rather than crashing on it. The table is also what the desugarer\'s generic child ' +
          'lowering uses, so a lowering that does not special-case a node still recurses into ' +
          'the right places.',
        example: 'The AST has 30 node kinds and one table describing all of them.'
      },
      {
        term: 'nodeAt costs the depth, not the size',
        plain: 'Finding the node at an offset descends only into the child that contains it.',
        formal: '9 nodes touched against 18 for a whole-tree query on the same program',
        detail: 'This is the editor\'s only structural question — what is under the cursor — and ' +
          'it is asked on every keystroke, so the difference between walking the tree and ' +
          'descending it is the difference between a language server that feels instant and one ' +
          'that does not. It is available only because every node carries a span the descent can ' +
          'test, which is another return on the decision made in the lexer.',
        example: 'Asking what is at offset 40 of an 18-node function touches 9 nodes; asking for ' +
          'every name used touches all 18.'
      },
      {
        term: 'Rewriting is immutable, and that is a real trade',
        plain: 'A lowering builds new nodes rather than mutating in place.',
        formal: 'the tree before and the tree after both exist at once',
        detail: 'The cost is allocation and the benefit is that every stage-comparison view in ' +
          'this milestone is possible: source beside core, tree before beside tree after, the ' +
          'original still valid for a diagnostic to point into. Mutation would make each of ' +
          'those require a defensive copy taken in advance by whoever wanted it, which in ' +
          'practice means nobody takes it and the feature is not built.',
        example: 'The desugaring viewer shows the surface tree and the core tree side by side, ' +
          'which needs both to exist after lowering has finished.'
      },
      {
        term: 'AST or CST is a decision about the consumer',
        plain: 'Keep every token, or keep the structure and re-derive the brackets.',
        formal: 'Berugo keeps an AST plus trivia on the tokens',
        detail: 'A concrete syntax tree can reproduce the author\'s exact text, which is what a ' +
          'refactoring tool that must not touch unrelated lines needs. An abstract one is ' +
          'smaller and simpler for every consumer that does not need that. Berugo takes the ' +
          'middle position deliberately, which is enough to format and not enough to preserve ' +
          'spacing — and that limit is precisely why the round-trip property compares trees ' +
          'rather than text.',
        example: 'The round trip asserts tree equality and explicitly does NOT assert that the ' +
          'printed text equals the original.'
      }
    ],

    'names-and-scopes': [
      {
        term: 'Resolution is a separate pass producing a table',
        plain: 'Walk the tree once and record what every name refers to.',
        formal: 'a binding table, a scope tree, and a capture list',
        detail: 'The shortcut is to resolve names inside the type checker, where the scope is ' +
          'already on hand. It works, and it means nothing else can ever answer "what does this ' +
          'name refer to" — not the optimiser, not go-to-definition, not rename. One extra pass ' +
          'makes every one of those a map lookup, and skipping it means each of them later ' +
          'either re-implements scoping or forces the checker to be restructured around the ' +
          'table it should have produced.',
        example: 'Hover, definition, references and completion in 28.8 are four lookups in ' +
          'tables this pass already built.'
      },
      {
        term: 'The table is keyed by occurrence, not by name',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["two references, both spelled x"] --> B["one in an inner scope,<br/>one in an outer"]',
            '    B --> C["they refer to different variables"]',
            '    C --> D["so the key must be the<br/>occurrence in the tree"]',
            '    D --> E["a map keyed by the name<br/>can only hold one of them"]'
          ].join('\n'),
          caption: 'Shadowing is legal in nearly every language, so a name is not a unique identifier. Keying the table by the occurrence is what makes resolution total.'
        },
        plain: 'Two references spelled the same can mean different things.',
        formal: 'a has 3 occurrences and 2 bindings in the default fixture',
        detail: 'Keying by name makes shadowing inexpressible, which is why a find-and-replace ' +
          'rename is wrong in a way that still compiles — the program keeps building and quietly ' +
          'means something else. The per-occurrence answer is what lets rename touch two of ' +
          'three occurrences and leave the third, and it is what an optimiser needs before it ' +
          'can conclude that two mentions of a name are the same value.',
        example: 'Renaming the parameter a to p in the shadowing fixture edits exactly the two ' +
          'occurrences inside the function and leaves the outer a alone.'
      },
      {
        term: 'Shadowing across scopes is legal, rebinding within one is not',
        plain: 'An inner scope may reuse a name; the same scope may not.',
        formal: 'a rebinding in one scope reports both spans',
        detail: 'The distinction is about what a reader can see. An inner binding is visibly ' +
          'nearer, so a reader can tell which one applies; two bindings in the same scope look ' +
          'identical and almost always mean somebody edited the wrong line. Reporting both spans ' +
          'is what lets the message show the earlier binding, which is the piece of information ' +
          'that makes the mistake obvious.',
        example: 'let a = 1; let a = 2; is E-RESOLVE-SHADOW-SAME with the second span primary and ' +
          'the first as related information.'
      },
      {
        term: 'Capture analysis falls out of the same walk',
        plain: 'A reference to a binding outside the enclosing function is a capture.',
        formal: 'the walk already knows which function it is standing in',
        detail: 'Computing it later means walking the tree again with less information than the ' +
          'resolver had, and reconstructing the function nesting from scratch. Recording the ' +
          'pair as it is found costs nothing and produces exactly what M29\'s escape analysis ' +
          'reads: a captured binding cannot live only on the stack frame that created it, ' +
          'because the closure outlives the frame.',
        example: 'The lambda returned from f captures b, which is bound in f\'s block scope, and ' +
          'the capture table names both.'
      },
      {
        term: 'A capture propagates through every function in between',
        plain: 'Each function between the use and the binding has to carry the value.',
        formal: 'the innermost cannot reach a frame the outer ones did not keep',
        detail: 'A lambda three levels deep that uses a top-level name forces all three closures ' +
          'to hold it, because each can only see what the one enclosing it kept. The memory cost ' +
          'is paid by every link, so reporting only the innermost user understates it by the ' +
          'nesting depth — which is why the demo shows the whole chain and why the resolver ' +
          'walks up to the owner rather than stopping at the first function.',
        example: 'The nested fixture has three functions each shadowing x, and the capture list ' +
          'shows which of them carries what.'
      },
      {
        term: 'A suggestion needs a threshold',
        plain: 'Offer the nearest name in scope, but only if it is near.',
        formal: 'edit distance capped at 3; beyond that, no suggestion',
        detail: 'A "did you mean" four edits away is the compiler guessing out loud, and after ' +
          'the second wrong guess a reader stops reading the line at all — including the part ' +
          'that was useful. Withholding it costs nothing and keeps the offered ones worth ' +
          'reading. The demo deliberately includes a name close to nothing, so the blank ' +
          'suggestion is visible as a decision rather than a gap.',
        example: 'valu suggests value at distance 1; totals suggests nothing, and the row shows ' +
          'the cap rather than a guess.'
      },
      {
        term: 'A module is a binding like anything else',
        plain: 'import binds a name, and a qualified reference is a field access on it.',
        formal: 'an unknown module and an unknown export are two errors with two spans',
        detail: 'Treating modules as ordinary bindings means resolution needs no new machinery ' +
          'for them, and the two failure kinds separate naturally: the import line is wrong, or ' +
          'the use site is. A design that makes qualified names a special syntactic form has to ' +
          'reimplement scoping for them, and usually gets shadowing of the module name wrong.',
        example: 'import math; binds math, and math.square is a field access the checker resolves ' +
          'against the module\'s export types.'
      },
      {
        term: 'Forward references are a policy, and both directions are wrong to get wrong',
        plain: 'Functions are visible before their bodies are walked; let bindings are not.',
        formal: 'mutual recursion works, and using a let before its initialiser does not',
        detail: 'Hoisting too little rejects correct programs — two mutually recursive functions ' +
          'cannot both be defined second. Hoisting too much accepts programs that read a binding ' +
          'before its initialiser has run, which in a language without a defined value for ' +
          '"not yet initialised" is a hole in the type system. Berugo takes the standard ' +
          'position and the demo shows both halves.',
        example: 'A generated program that used a name inside its own initialiser produced two ' +
          'spurious differential failures until the generator was fixed to bind after building ' +
          'the value.'
      }
    ],

    'type-checking-in-practice': [
      {
        term: 'The type table is an artefact, not a scratchpad',
        plain: 'Keep a type per node after checking finishes.',
        formal: '15 entries for an 18-node program, one per expression',
        detail: 'A checker that returns a verdict throws away the thing it spent its whole run ' +
          'computing. Keeping it is what makes hover instant, what the optimiser will read in ' +
          'M29 to know an addition is on numbers before folding it, and what lets a section ' +
          'print every expression beside its type. The cost is a map; the alternative is that ' +
          'every downstream consumer re-runs inference.',
        example: 'The demo\'s "every expression and its type" table is a direct rendering of the ' +
          'table the checker produced.'
      },
      {
        term: 'Two modes, and knowing which one you are in is most of the design',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["INFER: I have a term,<br/>what type does it have?"] --> C["the checker alternates<br/>between the two"]',
            '    B["CHECK: I have a term and an<br/>expected type — does it fit?"] --> C',
            '    C --> D["a lambda with no annotation<br/>can only be CHECKED"]',
            '    C --> E["a variable can be INFERRED"]',
            '    D --> F["and confusing the two is where<br/>bidirectional checkers go wrong"]',
            '    E --> F'
          ].join('\n'),
          caption: 'Most of the structure of a modern type checker is deciding, for each syntax form, which of the two modes it belongs in — and the annotations a language requires follow from that.'
        },
        plain: 'Infer derives a type from a term; check pushes an expected type inward.',
        formal: 'an annotation is the switch from infer to check',
        detail: 'The point of an annotation is not that the algorithm needs it — inference can ' +
          'usually manage without — but that it gives the error message somewhere to point. In ' +
          'check mode the thing that imposed the expectation is known and can be named in the ' +
          'diagnostic; in infer mode the blame lands wherever the traversal reached the ' +
          'contradiction, which may be a long way from the mistake.',
        example: 'let n: Number = true; is E-TYPE-ANNOTATION blaming true; without the annotation ' +
          'the same mistake becomes E-TYPE-MISMATCH blaming a use several lines later.'
      },
      {
        term: 'A mismatch carries both spans',
        plain: 'Report the expression at fault and the thing that required something of it.',
        formal: 'span and related, plus the expected and actual types',
        detail: '"Cannot unify Number with Bool" names neither end of the disagreement and is ' +
          'true of a great many programs. Recording both spans is what a language server needs ' +
          'to draw a squiggle and a related-information marker, and it is the single change that ' +
          'most improves a checker\'s messages. It has to be done as the failure is created, ' +
          'because by the time unification has returned, the context is gone.',
        example: 'The mismatch sample underlines flag and marks n + flag as the thing that ' +
          'required a Number.'
      },
      {
        term: 'The type table must report what a node has, not what was wanted',
        plain: 'On a failed check, record the actual type.',
        formal: 'flag is Bool in the table even though a Number was required',
        detail: 'Recording the expectation makes the table state something false about the node, ' +
          'so hovering over the Bool in n + flag reports Number — and the table is read by other ' +
          'tools, which then compound the error. On success the two are the same type after ' +
          'substitution, so the distinction only shows up on the error path, which is exactly ' +
          'the path nobody exercises while building the happy case.',
        example: 'Before this was fixed, the type table said Number for every expression that ' +
          'had failed a check.'
      },
      {
        term: 'Constraint order decides where blame lands',
        plain: 'The checker reports the first equation it cannot solve.',
        formal: '"first" is a fact about the traversal, not about which line is wrong',
        detail: 'A mistake at the top of a function can surface as a clash inside a caller three ' +
          'definitions away, because that is where the two constraints finally met. This is why ' +
          'inference errors have a reputation for pointing somewhere baffling, and why the ' +
          'practical fix is an annotation at a boundary you believe in: it splits the constraint ' +
          'set in two and moves the blame into the half containing the mistake.',
        example: 'The demo prints every constraint in traversal order and marks the one that ' +
          'could not be solved.'
      },
      {
        term: 'Generalisation happens at let and only there',
        plain: 'Quantify the variables the environment does not mention.',
        formal: 'a parameter gets no such treatment, because its type is chosen by the caller',
        detail: 'That single rule is what keeps inference decidable and principal, and it is what ' +
          'lets one definition serve several types. It is also the rule that makes the same body ' +
          'type or fail depending only on how the name was bound, which is the sharpest ' +
          'demonstration in the whole subject that a type system is a set of choices rather than ' +
          'a discovery.',
        example: 'id is used at Number, Bool and String in one program because let generalised ' +
          'it; the same body with id as a parameter would be rejected.'
      },
      {
        term: 'Records are structural, so the field set is part of the type',
        plain: 'Two records with different fields are different types.',
        formal: 'a missing field is a mismatch that can name the fields the record does have',
        detail: 'Structural typing means no declaration is needed before a record can be used, ' +
          'which suits a small language, and it means the checker knows the whole field set at ' +
          'the point of failure. That is what lets the message say "has no field named y, it ' +
          'has x" rather than refusing without explanation. The trade is that two unrelated ' +
          'records with the same shape are interchangeable, which nominal typing prevents.',
        example: 'let p = { x: 1 }; let y = p.y; reports that { x: Number } has no field named y.'
      },
      {
        term: 'Exhaustiveness is a checking question, not a runtime one',
        plain: 'A match must cover every constructor of its subject type.',
        formal: 'the missing constructor is named in the message',
        detail: 'Deferring the check to run time means the failure arrives as a crash in ' +
          'production on the one input nobody tested, which is the entire argument for sum types ' +
          'over an enum plus a default case. A default case makes every match exhaustive by ' +
          'construction and therefore makes the check worthless — which is why adding a ' +
          'constructor to a well-typed sum type produces a list of the places that must change, ' +
          'and adding one to an enum produces silence.',
        example: 'A match on an Option covering only some reports E-TYPE-EXHAUSTIVE and names ' +
          'none as the case that would fall through.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
