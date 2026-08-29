/** Concepts for Turing machines, models, undecidability and Rice (M26.1-M26.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'turing-machines': [
      {
        term: 'A finite control, an infinite tape, and a head that moves one cell',
        plain: 'The transition function maps state and symbol to state, symbol and direction.',
        formal: 'delta: Q × Γ → Q × Γ × {L, R, S}',
        readAs: 'The transition takes a state and the symbol under the head, and gives back a new state, a symbol to write, and a direction to move.',
        detail: 'That is the entire model, and its poverty is deliberate. A model this weak that ' +
          'can still compute everything computable is what makes claims about it worth ' +
          'anything: a limit proved here is a limit on computation rather than on one ' +
          'formalism. Everything in this milestone is defined against it for that reason.',
        example: 'The binary increment machine has 3 states and 6 transitions, and increments ' +
          'any binary number in at most 2n + 2 steps.'
      },
      {
        term: 'A configuration is the state, the tape and the head position',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["current state"] --> D["a configuration"]',
            '    B["the tape contents"] --> D',
            '    C["where the head is"] --> D',
            '    D --> E["nothing else exists —<br/>there is no hidden memory"]',
            '    E --> F["so a run is a sequence of these,<br/>and each one determines the next"]'
          ].join('\n'),
          caption: 'Because the configuration is complete, a machine can be simulated by another machine that just rewrites configurations — which is what makes universality possible.'
        },
        plain: 'Those three fields are the complete description at any moment.',
        formal: 'a computation is a sequence of configurations related by delta',
        detail: 'There is nowhere else for information to hide, which is what makes the model ' +
          'tractable to reason about and what makes the halting argument airtight. The demo ' +
          'prints configurations rather than the conventional `uqv` notation, because the ' +
          'notation is exactly as informative and considerably less readable.',
        example: 'The trace shows step, state, the symbol under the head and the tape, one row ' +
          'per configuration.'
      },
      {
        term: 'A missing transition is a rejection',
        plain: 'The machine halts wherever it is, and that state is not accepting.',
        formal: 'if delta(q, a) is undefined the machine halts in q',
        detail: 'That convention is why no explicit reject state is needed and why the ' +
          'transition table is far smaller than states times alphabet. It is also how the ' +
          'aⁿbⁿcⁿ machine rejects a string with the wrong counts: it runs out of transitions ' +
          'part-way through a sweep and stops, in a state that is not accepting.',
        example: 'The aⁿbⁿcⁿ machine has 29 transitions over 9 states, and rejects by exhausting ' +
          'them.'
      },
      {
        term: 'Halting, accepting and running forever are three outcomes',
        plain: 'Folding the third into the second is the mistake the next section is about.',
        formal: 'accept: halted in an accepting state · reject: halted elsewhere · neither: never halts',
        detail: 'A simulator with a step budget must report budget exhaustion as its own outcome. ' +
          'Reporting it as a rejection is a lie about the language — the machine may accept ' +
          'after a million more steps — and it is the single easiest way to make a ' +
          'computability demo teach the opposite of the truth.',
        example: 'The looper machine reports `budget` at every budget setting, and never ' +
          '`rejected`.'
      },
      {
        term: '`aⁿbⁿcⁿ` is decidable and not context-free',
        plain: 'One stack cannot hold two independent counts; a tape can.',
        formal: 'cross off one a, one b and one c per sweep, in O(n²) time',
        detail: 'This is the language that separates this milestone from the last one. A ' +
          'pushdown automaton fails on it for a concrete reason — matching the a-count against ' +
          'the b-count empties the stack, leaving nothing to match the c-count against. A Turing ' +
          'machine walks the tape repeatedly instead, which is why it is quadratic rather than ' +
          'linear.',
        example: 'Checked against an independent definition over all 3 280 strings up to length ' +
          '7, with zero disagreements.'
      },
      {
        term: 'The order check is a separate phase, and the first version lacked it',
        plain: 'Crossing off one of each per sweep gets the counts right and says nothing about order.',
        formal: 'verify the input matches a* b* c*, rewind, then count',
        detail: 'Without the verification phase the machine accepts `abcabc`, because three ' +
          'sweeps cross off three of each and the counts match. That bug is invisible on every ' +
          'string anybody would try by hand and appears immediately in an exhaustive check, ' +
          'which is the argument for running one on any machine whose correctness is not ' +
          'obvious.',
        example: 'The exhaustive check over 3 280 strings found it; a handful of spot checks did ' +
          'not.'
      },
      {
        term: 'Multi-tape and nondeterministic variants add no power',
        plain: 'They change the cost, and the two changes are very different sizes.',
        formal: 'k tapes cost a quadratic slowdown; nondeterminism costs an exponential one',
        detail: 'The multi-tape simulation is polynomial, which is what makes "polynomial time" ' +
          'a robust notion — it means the same thing whichever variant you define it on. The ' +
          'nondeterministic simulation is exponential, and closing that gap is exactly the P ' +
          'versus NP question, which is why the two facts are worth stating together.',
        example: 'The demo runs the single-tape versions, and the cost table shows the quadratic ' +
          'behaviour a single tape imposes.'
      },
      {
        term: 'A machine encoded as a string is a program as data',
        plain: 'That is what makes the universal machine, and the diagonal argument, possible.',
        formal: 'encode(M) as a string; a universal machine simulates M from its encoding',
        detail: 'Turing needed it for a proof — the halting argument requires a machine that can ' +
          'simulate an arbitrary other one — and it turned out to be the most useful object in ' +
          'the subject. Every interpreter, virtual machine, container runtime and `eval` is a ' +
          'descendant of that construction, and each inherits the questions it raises about ' +
          'budgets and termination.',
        example: 'The increment machine encodes to a 116-character string that decodes back and ' +
          'runs identically.'
      }
    ],

    'equivalent-models-of-computation': [
      {
        term: 'Equivalence is proved by simulation, and simulation is a program',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["claim: model A is as<br/>powerful as model B"] --> B["write an interpreter for B,<br/>inside A"]',
            '    B --> C["anything B computes,<br/>A computes by running it"]',
            '    C --> D["do the same in the other direction"]',
            '    D --> E["and the two models are equivalent"]'
          ].join('\n'),
          caption: 'These proofs are not abstract arguments. They are programs, which is why the Church-Turing thesis is supported by decades of people actually writing them.'
        },
        plain: 'To show A is as powerful as B, write an interpreter for B in A.',
        formal: 'A simulates B if some fixed program in A computes B’s step relation',
        detail: 'That is the entire technique, which is why these proofs read like engineering ' +
          'rather than like mathematics — because they are. It also means every equivalence ' +
          'comes with a COST, the slowdown of the simulation, and the cost is the part that ' +
          'gets dropped when the result is quoted.',
        example: 'The demo runs one function in three models and compares both the answers and ' +
          'the step counts.'
      },
      {
        term: 'A counter machine has three instructions and no way to read without destroying',
        plain: 'Increment, decrement-or-jump-if-zero, and halt.',
        formal: 'inc(r); dec(r) or jump if zero; halt',
        detail: 'Copying a value therefore takes a loop and a scratch register, which is where ' +
          'the inefficiency comes from. The model is minimal in a useful way: everything a ' +
          'program does has to be built from counting, so it shows exactly how little is needed ' +
          'for universality and exactly what that minimality costs.',
        example: 'Doubling takes 3n + 1 steps on a counter machine and 2 on a RAM — 31 against 2 ' +
          'at n = 10.'
      },
      {
        term: 'Two counters are Turing complete, by Gödel numbering',
        plain: 'Store k registers as one number 2^a·3^b·5^c and use the second as scratch.',
        formal: 'reading register b means dividing by 3 repeatedly — a loop as long as the value',
        detail: 'Minsky proved it, and the encoding is the reason it is slow: every register ' +
          'access becomes a loop whose length is the value stored, so a single simulated step ' +
          'costs exponentially many real ones. The model is universal and useless, and both ' +
          'halves are the point — universality is cheap and says nothing about cost.',
        example: 'The simulation table marks this as the one model whose slowdown is exponential ' +
          'rather than polynomial.'
      },
      {
        term: 'The RAM is the model every algorithms course silently assumes',
        plain: 'Indexed registers and arithmetic in one step.',
        formal: 'unit-cost RAM: any arithmetic operation on a register is one step',
        detail: 'That is why "O(n) time" means what you expect. Under the LOGARITHMIC cost ' +
          'model, which charges for the bits in each operand, a RAM is polynomially related to a ' +
          'Turing machine; under the unit-cost model it is not, because you can square a number ' +
          'repeatedly and reach astronomically large values in linear time. The subtlety is real ' +
          'and almost always ignored.',
        example: 'The RAM doubles a number in 2 steps regardless of its size, which is the ' +
          'unit-cost assumption made visible.'
      },
      {
        term: 'Rule 110 is a three-cell lookup table and it is Turing complete',
        plain: 'Each cell is updated from itself and its two neighbours by an eight-entry rule.',
        formal: 'the rule number’s bits index the eight neighbourhood patterns',
        detail: 'Cook proved it in 2004, via tag systems. Nothing about the rule looks like ' +
          'computation, and that is the most useful thing about it: universality is common and ' +
          'cheap rather than rare and engineered, which is why so many systems nobody designed ' +
          'to be programmable turn out to be.',
        example: 'The demo evolves Rule 110 from a single live cell; Rule 90 draws the ' +
          'Sierpinski triangle and is exactly XOR of the neighbours.'
      },
      {
        term: 'Tag systems are the minimal model: no tape, no registers, one queue',
        plain: 'Delete the first m symbols, and append the production for whichever was first.',
        formal: 'a 2-tag system deletes two symbols and appends one production per step',
        detail: 'Post proved these universal in 1943, decades before anybody needed them, and ' +
          'they are what Cook\'s Rule 110 proof reduces to. The model has no random access, no ' +
          'arithmetic and no branching beyond the lookup, which makes it the standard target ' +
          'when someone wants to prove a system universal with as little machinery as possible.',
        example: 'The demo\'s tag system halts after 24 steps from a three-symbol start word.'
      },
      {
        term: 'SKI combinators show that variable binding is not primitive',
        plain: 'Three rewrite rules, no variables anywhere.',
        formal: 'I x → x · K x y → x · S x y z → x z (y z)',
        detail: 'Every lambda term translates into these by bracket abstraction, so the binding ' +
          'and substitution that lambda calculus is built on turn out to be a notation rather ' +
          'than a mechanism. That matters for compiler design: several functional-language ' +
          'implementations compile to combinators precisely to avoid implementing substitution ' +
          'at runtime.',
        example: '`S(K(SI))K x y` reduces to `y x` in 5 steps — argument reversal built from ' +
          'nothing but S and K.'
      },
      {
        term: 'Equal power is not equal efficiency, and that gap is complexity theory',
        plain: 'Computability asks whether the cost is finite; complexity asks how fast it grows.',
        formal: 'all these models compute the same class of functions, with slowdowns from constant to exponential',
        detail: 'The practical form appears whenever someone observes that a configuration ' +
          'format or a type system is Turing complete. It is almost always true and almost never ' +
          'the relevant fact — what matters is the cost model, and a system that is universal ' +
          'while paying a process spawn per step is a different engineering object from one ' +
          'that compiles.',
        example: 'Doubling at n = 10: 2 steps on a RAM, 31 on a counter machine, 242 on a Turing ' +
          'machine — same answer, three curves.'
      }
    ],

    'undecidability-and-diagonalisation': [
      {
        term: 'Decidable, recognisable and co-recognisable are three different things',
        plain: 'Always halts with the right answer; halts on the yes cases; halts on the no cases.',
        formal: 'decidable = recognisable AND co-recognisable',
        detail: 'That equivalence is the useful one, because it says exactly what a ' +
          'semi-decision procedure is missing. A tool that confirms the yes instances and may ' +
          'run forever on the no ones is a recogniser, and it can never be completed into a ' +
          'decider unless the complement is also recognisable — which for halting it is not.',
        example: 'The tower table classifies seven problems across all three columns, and the ' +
          'last two are in none of them.'
      },
      {
        term: 'Halting is recognisable and the gap is entirely one-sided',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["just run the program"] --> B{"did it halt?"}',
            '    B -->|yes| C["you now know: it halts"]',
            '    B -->|not yet| D["keep waiting"]',
            '    D --> B',
            '    D --> E["and you never learn that<br/>it will not halt"]'
          ].join('\n'),
          caption: 'The yes cases are all discoverable and the no cases are never confirmed. That one-sidedness is the precise shape of undecidability here.'
        },
        plain: 'Run it: if it halts you find out, and if it does not you wait forever.',
        formal: 'HALT is recursively enumerable; its complement is not',
        detail: 'There is no symmetric procedure and no way to detect that you are waiting ' +
          'forever, which is the shape of every semi-decision procedure ever written. It is why ' +
          '"we will find every bug eventually" is a coherent claim about a search and "we can ' +
          'certify this program is clean" is not.',
        example: 'The bounded-halting table decides the same question completely, and only ' +
          'because it has a bound.'
      },
      {
        term: 'Diagonalisation builds a row that differs from every row',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["machines down the side,<br/>inputs across the top"] --> B["read the diagonal:<br/>machine i on input i"]',
            '    B --> C["build a new row that does<br/>the opposite at every position"]',
            '    C --> D["it differs from row i at column i"]',
            '    D --> E["so it is not in the table —<br/>and the table listed everything"]'
          ].join('\n'),
          caption: 'The construction only needs the table to be complete. Anything you can enumerate can be diagonalised out of, which is why this one argument proves so many things.'
        },
        plain: 'Machines down the side, inputs across the top, and do the opposite of the diagonal.',
        formal: 'D differs from row i at column i, for every i',
        detail: 'It differs from every row, so it is no row of the table — and every machine IS ' +
          'a row, because the table was built by listing them all. This is Cantor\'s argument ' +
          'unchanged; his showed the reals are uncountable, and Turing\'s contribution was ' +
          'noticing it applies to programs.',
        example: 'The demo prints the table with the diagonal cells bracketed, and lists the ' +
          'column where the new machine differs from each existing row.'
      },
      {
        term: 'The halting proof is that argument plus one step',
        plain: 'The constructed program consults the oracle and does the opposite.',
        formal: 'contrary(p): if halts(p, p) then loop forever, else return',
        detail: 'The contradiction is then about the program\'s own behaviour rather than about ' +
          'a table entry, and it needs only six lines. Running `contrary` on its own source ' +
          'forces both branches to be impossible: whatever the oracle says, the program does the ' +
          'other thing, and there is no third branch to escape into.',
        example: 'The demo calls the oracle for real and reports both verdicts; 200 arbitrary ' +
          'deciders are defeated in the test suite.'
      },
      {
        term: 'The construction never looks inside the oracle',
        plain: 'Which is why the theorem is about every program rather than the ones we tried.',
        formal: 'the argument quantifies over all candidate deciders, not over a class of them',
        detail: 'A heuristic, a perfect oracle, a machine-learned model and a coin flip are all ' +
          'defeated by the same six lines, because the construction only ever calls the oracle ' +
          'and negates the answer. That universality is what makes this an impossibility result ' +
          'rather than a statement about the current state of the art.',
        example: 'The oracle control offers four strategies and the contradiction metric reads ' +
          'yes for all of them.'
      },
      {
        term: 'Bounded halting is decidable, and it is what every tool uses',
        plain: 'Does this machine halt within k steps? Run it for k steps and look.',
        formal: 'HALT_k is decidable for every fixed k',
        detail: 'That is not a compromise forced by engineering; it is a different and ' +
          'answerable question. Every timeout, step budget, fuel counter and gas limit in ' +
          'production software is that substitution — and each one inherits an obligation to say ' +
          'what happens when the bound is hit, which is the real engineering content of the ' +
          'section.',
        example: 'The demo decides bounded halting for five machines at any budget, and the ' +
          'looper migrates in and out of "still running" as you move it.'
      },
      {
        term: 'Recognisability has an enumeration reading',
        plain: 'A machine can list the members, in some order, possibly never finishing.',
        formal: 'recursively enumerable: L is the range of some computable partial function',
        detail: 'That is where the older name comes from, and it is the reading that makes ' +
          'semi-decision procedures intuitive: dovetail every machine on every input, and print ' +
          'each pair whose machine halts. The list is infinite and never complete at any moment, ' +
          'which is exactly what "eventually" means here.',
        example: 'The tower table marks which of seven problems can be enumerated from which ' +
          'side.'
      },
      {
        term: 'Totality is strictly harder than halting',
        plain: 'Neither recognisable nor co-recognisable, so no partial answer works either.',
        formal: '"does M halt on EVERY input" is not in RE and not in co-RE',
        detail: 'Halting at least has a procedure that confirms the yes cases. Totality has ' +
          'neither: you cannot confirm a machine halts on all inputs by running it, and you ' +
          'cannot confirm it fails to by any finite search that is guaranteed to succeed. That ' +
          'is why termination checkers are conservative in a way that halting-based tools are ' +
          'not.',
        example: 'The last row of the tower table is `no` in all three columns.'
      }
    ],

    'reductions-and-the-rice-theorem': [
      {
        term: 'A mapping reduction is a program transformation',
        plain: 'Turn any program into one that has property P exactly when the original halts.',
        formal: 'f computable with p in HALT iff f(p) in P',
        detail: 'That is the useful way to hold it: a reduction is a compiler, and the ' +
          'equivalence is something you check by reading the transformed source. The demo prints ' +
          'it for exactly that reason — the arrow in a textbook diagram hides that there is ' +
          'nothing to the technique but a source-to-source rewrite.',
        example: 'The reduction for "does it ever print" appends a print statement after the ' +
          'original program.'
      },
      {
        term: 'The direction matters and is easy to invert',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["reduce HALTING to P"] --> B["if you could decide P,<br/>you could decide halting"]',
            '    B --> C["so P is undecidable"]',
            '    D["reduce P to HALTING"] --> E["only says P is no harder<br/>than halting"]',
            '    E --> F["which almost everything is —<br/>this shows nothing"]'
          ].join('\n'),
          caption: 'Both directions are the same construction and only one of them is a proof. Writing the reduction backwards produces a paragraph that argues for nothing at all.'
        },
        plain: 'Reducing halting TO P shows P is hard; the other way shows nothing.',
        formal: 'HALT ≤m P means P is at least as hard as HALT',
        readAs: 'The halting problem reduces to P by a computable transformation, so any decider for P could be turned into a decider for halting — which means P is at least as hard as halting.',
        detail: 'Everything reduces to halting, so a reduction in that direction is content-free. ' +
          'The test is whether your argument would still work with the arrows swapped: if it ' +
          'would, it is not an argument. This is the commonest error in the subject and it ' +
          'produces confident proofs of nothing.',
        example: 'Each reduction in the demo states the equivalence and the consequence ' +
          'separately, so the direction is explicit.'
      },
      {
        term: 'Rice’s theorem generalises every such reduction at once',
        plain: 'Every non-trivial semantic property of programs is undecidable.',
        formal: 'non-trivial: some program has it and some does not · semantic: it depends on the function computed',
        detail: 'The scope is devastating and the proof is exactly the reduction the demo builds. ' +
          'It means the undecidability results are not a list of unlucky problems: any question ' +
          'about what a program COMPUTES, other than one whose answer is constant, has no ' +
          'algorithm at all.',
        example: 'Four of the ten properties in the demo are undecidable, and all four are ' +
          'non-trivial and semantic.'
      },
      {
        term: 'The syntactic escape is why any tool works at all',
        plain: 'Rice says nothing about how a program is written.',
        formal: 'a syntactic property depends on the text, not on the computed function',
        detail: '"Does the source contain a division operator" is decided by grep. Every linter, ' +
          'formatter, parser and style checker lives in that gap, which is why they answer ' +
          'questions about syntax precisely and approximate everything else. Recognising which ' +
          'side of the line a check is on tells you whether it can be exact.',
        example: 'Four of the ten properties are syntactic and all four are decidable.'
      },
      {
        term: 'The trivial escape is real and almost never useful',
        plain: 'A property every program has, or none has, is decided by a constant.',
        formal: 'Rice requires the property to separate at least two programs',
        detail: 'It is worth knowing because it is the precise reason the theorem needs the ' +
          'non-triviality hypothesis at all, and because "does this compute some function" ' +
          'sounds like it ought to be hard. The reason it is not is that the answer is always ' +
          'yes, and a constant is a decider.',
        example: 'Two of the six decidable properties in the demo are decidable for this reason ' +
          'rather than for being syntactic.'
      },
      {
        term: 'A bound is the third escape, and the one engineering uses',
        plain: 'Halting within 10 000 steps is not a property of the computed function.',
        formal: 'a bounded execution is a finite object, so any property of it is decidable',
        detail: 'This is where the previous section connects: every timeout converts an ' +
          'undecidable semantic question into a decidable one about a bounded run. It is not a ' +
          'weaker version of the same question — it is a different question that happens to be ' +
          'useful, and the value of k is part of the specification.',
        example: 'The bounded-halting row in the property table is decidable, and it is the only ' +
          'semantic-sounding one that is.'
      },
      {
        term: 'Every static analyser is unsound or incomplete, and it chose which',
        plain: 'Sound never misses a real problem; complete never reports a false one.',
        formal: 'Rice forbids both at once for any non-trivial semantic property',
        detail: 'A type checker is sound and rejects programs that would have run fine; a linter ' +
          'is incomplete and stays quiet about real bugs. Both are correct designs, and they ' +
          'mean opposite things when they say nothing. A tool claiming both is measuring ' +
          'something syntactic and calling it semantic.',
        example: 'The analyser table lists seven tools with the half each gave up and what that ' +
          'costs.'
      },
      {
        term: 'When it says nothing, what have you learned?',
        plain: 'That is the question to ask of any analysis in your pipeline.',
        formal: 'silence from a sound analysis is a guarantee; from an incomplete one it is nothing',
        detail: 'For a type checker, a borrow checker or an abstract interpreter, silence means ' +
          'the property holds, paid for with rejected programs. For a linter, a fuzzer or a test ' +
          'suite it means only that this tool found nothing, which is compatible with the code ' +
          'being catastrophically wrong. Teams get into trouble by treating the second kind as ' +
          'the first, and improving the tool never changes its category.',
        example: 'The last four rows of the analyser table are all the second kind.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
