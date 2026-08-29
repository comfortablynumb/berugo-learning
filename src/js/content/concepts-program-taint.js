/** Concepts for flow-sensitive taint analysis and symbolic execution (M32.3-M32.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'taint-analysis': [
      {
        term: 'A type system is a static analysis the language forces you to pass',
        plain: 'Same machinery, different fact, and a compiler that refuses to build.',
        formal: 'a decidable over-approximation of the values an expression can take',
        detail: 'Type checking, nullability, definite assignment and taint are the same ' +
          'forward fixpoint over the same control-flow graph, carrying a different fact and ' +
          'joining it differently at merges. Recognising that is worth more than any one of ' +
          'them: once you have implemented one, the distance to the others is the fact and the ' +
          'reporting, not the algorithm — and the reason type checking feels different is ' +
          'leverage rather than technique.',
        example: 'The section\'s last table lines the four up: the fact tracked, what it is ' +
          'for, and the way each is usually wrong.'
      },
      {
        term: 'Flow sensitivity is one fact per program point, not one per variable',
        plain: 'After `if (x != null)`, x is not null inside the branch.',
        formal: 'the abstract state is indexed by program point',
        detail: 'That narrowing is what makes a modern checker feel intelligent and is why it ' +
          'accepts code a declaration-only checker rejects. It is also the cheapest of the ' +
          'four precision axes — one abstract state per block rather than one per procedure — ' +
          'which is why essentially every analysis worth running has it, and why the ones that ' +
          'do not are usually doing something else entirely, like a whole-program points-to ' +
          'analysis that could not afford it.',
        example: 'The taint analysis stores a fact per register and per named local, and needs ' +
          '2 rounds on the back-edge fixture because a later round learns what an earlier one ' +
          'could not.'
      },
      {
        term: 'Taint is one bit carried from a source to a sink',
        diagram: {
          definition: [
            'flowchart LR',
            '    S["readParam"] -->|"taint enters"| V["a local"]',
            '    V -->|"copies and arithmetic<br/>carry it"| W["another local"]',
            '    W --> Q{"sanitiser?"}',
            '    Q -->|"escape"| C["clean"]',
            '    Q -->|"no"| K["query — a finding,<br/>with the whole path"]'
          ].join('\n'),
          caption: 'The algorithm is a reachability walk over three declared lists. Everything hard about deploying it is in the lists.'
        },
        plain: 'Untrusted in, propagate through, report at anything dangerous.',
        formal: 'sources introduce, sanitisers remove, sinks report, everything else propagates',
        detail: 'The value of the model is its size: for a fixed framework there are perhaps ' +
          'forty entry points, thirty dangerous calls and a dozen trusted cleaners, and that ' +
          'list is writable in a week. Once it exists, the analysis is a reachability walk that ' +
          'runs over a large codebase in seconds — which is why this is the highest-value ' +
          'static analysis in application security, and why every failure of it is a missing ' +
          'declaration rather than an algorithmic gap.',
        example: 'On the record fixture the path from `readParam` to `query` is 7 hops: source, ' +
          'store, read, makeRecord, store, read, loadField.'
      },
      {
        term: 'The path is the deliverable, not the line number',
        plain: 'A finding without a propagation path is a line number and a guess.',
        formal: 'the finding carries the chain of instructions the value travelled',
        detail: 'An engineer receiving "line 10 is vulnerable" has to reconstruct how untrusted ' +
          'data could possibly get there, and that reconstruction is most of the triage cost. ' +
          'A finding that names the source, the hops and the sink is a bug report: it can be ' +
          'confirmed or dismissed by reading, and dismissing it correctly usually means ' +
          'pointing at the hop where a sanitiser should have been. Tools are judged on this ' +
          'far more than on their algorithms.',
        example: 'The demo prints one row per hop with the IR instruction and the register or ' +
          'local the value passed through.'
      },
      {
        term: 'An unsummarised callee is assumed to pass its argument through',
        plain: 'A function that ignores its argument is not believed.',
        formal: 'the result of a call inherits the taint of any argument',
        detail: 'It is the conservative rule, so it never loses a real flow, and it is where ' +
          'a large share of the false positives come from — a logging call that returns a ' +
          'status code taints the status code. The fix is a summary per library function, and ' +
          'shipping those summaries for a framework is the bulk of the engineering in a real ' +
          'tool. Nothing about it is deep; it is a large, boring, high-value table.',
        example: 'The `ignores` fixture passes a tainted value to a callee that returns a ' +
          'constant, and the analysis reports the sink: 1 finding the run refutes.'
      },
      {
        term: 'Field insensitivity makes a container one location, and its clean fields dirty',
        diagram: {
          definition: [
            'flowchart TD',
            '    R["raw — tainted"] --> B["box = record with fields<br/>bad and good"]',
            '    C["clean — untainted"] --> B',
            '    B -->|"field-insensitive:<br/>one location for the record"| F1["query(box.good)<br/>reported — false positive"]',
            '    B -->|"field-sensitive:<br/>one location per field"| F2["query(box.good)<br/>not reported"]',
            '    B --> F3["query(box.bad)<br/>reported under both — real"]'
          ].join('\n'),
          caption: 'One precision axis, one false positive, measured rather than argued. The array fixture does not improve, because an array is one location under both.'
        },
        plain: 'Put one tainted value in a record and the whole record is tainted.',
        formal: 'one abstract location per allocation, or one per field of it',
        detail: 'Field sensitivity costs a map per allocation site and removes exactly the ' +
          'false positives that come from mixing fields, which in code that passes request ' +
          'objects around is a great many of them. Index sensitivity — separating array ' +
          'elements — is a further axis almost no production tool pays for, because array ' +
          'indices are usually computed and the analysis would have to reason about the ' +
          'arithmetic to say anything at all.',
        example: 'Record fixture: 2 findings field-insensitively and 1 field-sensitively, with ' +
          'the run confirming exactly 1 either way.'
      },
      {
        term: 'Taint can arrive backwards, so a pass is not enough',
        plain: 'A loop can taint a variable that was copied before it was tainted.',
        formal: 'iterate to a fixpoint, because a back edge carries facts to earlier blocks',
        detail: 'A single forward sweep over the block list gets the straight-line cases right ' +
          'and is quietly wrong on every loop where the value becomes tainted after it has ' +
          'already been read. Because the wrong answer here is a MISSING finding rather than a ' +
          'crash, this is exactly the kind of defect that survives a test suite built from ' +
          'straight-line fixtures — which is why the fixture set has one that needs a second ' +
          'round.',
        example: 'The back-edge fixture takes 2 rounds; with one round the sink is not reported ' +
          'at all.'
      },
      {
        term: 'The policy is the model, and its two failures have very different prices',
        plain: 'A missing source is silent. A missing sanitiser is noisy.',
        formal: 'undeclared source or sink loses findings; undeclared sanitiser gains them',
        detail: 'The asymmetry decides where review effort goes. Findings that appear because ' +
          'a sanitiser was not declared get triaged by a human, who notices; findings that ' +
          'never appear because a source was not declared produce a shorter report and no ' +
          'signal whatsoever. That is why auditing the source and sink lists against the ' +
          'framework you actually use is the adoption work, and why a trusted-but-wrong ' +
          'sanitiser is the worst entry in the file.',
        example: 'The sweep on the direct fixture: dropping one source takes findings from 1 to ' +
          '0, and dropping one sanitiser takes them from 1 to 2.'
      }
    ],

    'symbolic-execution': [
      {
        term: 'Run the program with expressions where the values go',
        plain: 'A parameter becomes a symbol, and arithmetic builds a formula.',
        formal: 'a register holds an affine expression: a constant plus weighted symbols',
        detail: 'Nothing about the execution changes until a decision has to be made about a ' +
          'value nobody knows. Keeping the state affine is a stated fragment rather than a ' +
          'hidden one: it covers the additions, subtractions and comparisons the language does ' +
          'on integers, and a multiplication of two symbols leaves it. Being explicit about ' +
          'the fragment is what lets the executor mark a value opaque instead of quietly ' +
          'approximating it.',
        example: 'In the `opaque` fixture `a * b` cannot be represented, so the branch on it ' +
          'forks with no constraint recorded and both leaves carry no useful input.'
      },
      {
        term: 'A branch on a symbol forks, and each side carries a path condition',
        diagram: {
          definition: [
            'flowchart TD',
            '    A["a is a symbol"] --> B{"if (a > 10)"}',
            '    B -->|"then"| C["condition: a > 10"]',
            '    B -->|"else"| D["condition: not (a > 10)"]',
            '    C --> E{"if (a < 5)"}',
            '    E -->|"then"| F["a > 10 and a < 5<br/>no input satisfies this"]',
            '    E -->|"else"| G["a > 10 and not (a < 5)<br/>solver: a = 11"]'
          ].join('\n'),
          caption: 'The path condition is the deliverable: a machine-checkable description of exactly the inputs that reach this leaf. Solving it gives a test case; failing to solve it gives a dead-code report.'
        },
        plain: 'Both sides are explored, each remembering the decisions that got it there.',
        formal: 'the conjunction of the branch conditions along the path',
        detail: 'The path condition is the whole product of the technique. It is not a summary ' +
          'or a heuristic: it describes precisely the set of inputs that follow this path, so ' +
          'anything a solver proves about it is a fact about the program rather than an ' +
          'estimate. Everything else in symbolic execution — the search order, the budgets, ' +
          'the merging — is machinery for producing as many of these as possible before time ' +
          'runs out.',
        example: 'The `classify` fixture produces 3 leaves with conditions `a > 10 and b < 0`, ' +
          '`a > 10 and not (b < 0)` and `not (a > 10)`.'
      },
      {
        term: 'A satisfying assignment is a test case with a proof of reachability attached',
        plain: 'The solver hands back an input that provably follows this path.',
        formal: 'a model of the path condition, executed and checked against the path',
        detail: 'This is the property that separates the technique from fuzzing, and it is ' +
          'worth checking rather than asserting: the demo executes every generated input and ' +
          'confirms it visits exactly the blocks the leaf was collected from. An input that ' +
          'satisfies the condition and then takes a different path means the condition does ' +
          'not describe the path, which is a defect in the executor that no count of generated ' +
          'inputs would reveal.',
        example: 'On `classify`, 3 of 3 generated inputs reached their path, and between them ' +
          'covered all 7 basic blocks.'
      },
      {
        term: 'An unsatisfiable path condition is a dead-code report, and it is free',
        plain: 'No input takes that branch.',
        formal: 'the conjunction is contradictory, so the leaf is unreachable',
        detail: 'The analysis was already going to ask the solver about that leaf, so the ' +
          'finding costs nothing extra — and it is the one engineers do not expect. A branch ' +
          'no input can take is a bug in the condition, a redundant check, or defensive code ' +
          'whose author was wrong about what could happen. All three are worth a review ' +
          'comment, and the last one is worth a conversation about what else that author ' +
          'believed.',
        example: 'The `guard` fixture asks for `a > 10 and a < 5`; the theory solver proves it ' +
          'has no solution.'
      },
      {
        term: 'A bounded search cannot prove impossibility, and must not claim to',
        plain: '"I found no input in this box" is not "no input exists".',
        formal: 'unknown and unsat are different answers, and only a decision procedure gives the second',
        detail: 'The executor here searches every assignment in a box around zero, so on a ' +
          'contradictory path condition it reports `unknown` — which is honest and useless, ' +
          'because a dead branch is worth knowing about. Wiring in the linear theory solver ' +
          'from 32.6 converts those to proved `unsat` by eliminating variables. The distinction ' +
          'between "no answer" and "no solution" is exactly why the next two sections build a ' +
          'real solver.',
        example: 'The seven-branch ladder: 120 leaves come back `unknown` from the box search ' +
          'and `unsat` from the theory solver, with 8 feasible either way.'
      },
      {
        term: 'Path explosion is exponential in branches and unbounded in loops',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["1 branch<br/>2 leaves, 2 real"] --> B["3 branches<br/>8 leaves, 4 real"]',
            '    B --> C["5 branches<br/>32 leaves, 6 real"]',
            '    C --> D["7 branches<br/>128 leaves, 8 real"]',
            '    D --> E["the tree doubles;<br/>the answer grows by one"]'
          ].join('\n'),
          caption: 'The gap is what makes the technique work at all: solving at the fork prunes exponentially many leaves that lazy exploration would have to walk.'
        },
        plain: 'Every branch doubles the tree; a symbolic loop bound has no end.',
        formal: 'up to 2 to the power of the branches, one path per iteration count',
        detail: 'The number that saves the technique is that the feasible paths are usually ' +
          'far fewer than the leaves — eight of 128 on the ladder — because real conditions ' +
          'constrain each other. That is why an engine that solves at the fork and prunes ' +
          'beats one that explores first and checks later by an exponential factor, and why ' +
          'search heuristics that reach new code sooner matter more than raw execution speed.',
        example: 'One to seven branches on the same parameter: 2, 4, 8, 16, 32, 64, 128 leaves ' +
          'and 2, 3, 4, 5, 6, 7, 8 of them reachable — at five branches, 26 of the 32 are ' +
          'proved impossible rather than merely unvisited.'
      },
      {
        term: 'Every tool bounds the tree, and hiding the bound fakes coverage',
        plain: 'Report what you abandoned, or your coverage number is about a different program.',
        formal: 'depth and path budgets, with the count of truncated paths reported',
        detail: 'A tool that explored 200 paths of a 4 000-path function and reports "all paths ' +
          'covered" is not lying about the 200; it is redefining "all". The honest form is two ' +
          'numbers — what was explored and what was abandoned — and it is the first thing to ' +
          'look for in any engine of this kind, because everything else it tells you is scoped ' +
          'by it.',
        example: 'The seven-branch ladder at a 64-path budget abandons 1 path and leaves 1 of ' +
          '22 blocks unreached.'
      },
      {
        term: 'Concolic execution keeps a concrete value beside every symbol',
        plain: 'Run for real, record the formula, negate one decision, solve for the next input.',
        formal: 'concrete plus symbolic: the concrete value is the fallback when the solver cannot',
        detail: 'It never gets stuck, which is the entire argument for it: when execution ' +
          'reaches a hash function, a system call or anything else outside the fragment, the ' +
          'concrete value carries on and only the symbolic reasoning is lost for that value. ' +
          'That is how industrial engines survive real programs, and it changes the technique ' +
          'from an enumeration into a directed search that produces one new input at a time.',
        example: 'The `opaque` fixture is where a purely symbolic executor stops being useful: ' +
          'both leaves survive with no constraint, so its inputs prove nothing.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
