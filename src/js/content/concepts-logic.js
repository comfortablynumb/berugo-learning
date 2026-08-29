/** Concepts for gates, minimisation and the combinational blocks (M33.1-M33.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'boolean-algebra-and-gates': [
      {
        term: 'A Boolean function is a table; a circuit is one implementation of it',
        plain: 'n inputs give 2 to the n rows, and any assignment of 0 and 1 to those rows is a function.',
        formal: 'a function from {0,1}^n to {0,1}, of which there are 2^(2^n)',
        readAs: 'a function taking n bits to one bit, and there are two to the power of two to the n of them.',
        detail: 'The distinction between the table and the circuit is the one that makes the '
          + 'rest of the milestone possible. The table is what the thing must compute and it is '
          + 'unique; the circuit is how, and there are many. The demo derives the table by '
          + 'running the circuit rather than the other way round, which is the right direction: '
          + 'the circuit is the claim and the table is the evidence. Two circuits with the same '
          + 'table are interchangeable in function and can differ by a factor of five in area.',
        example: 'The exclusive-or of two inputs is 1 on rows 1 and 2 of its four-row table, and '
          + 'the demo reads that off by evaluating the netlist eight times.'
      },
      {
        term: 'The canonical sum of products exists for every function and is never minimal',
        plain: 'One AND term per row where the output is 1, all ORed together.',
        formal: 'f = OR over the minterms m where f(m) = 1 of AND over the inputs in the polarity m has',
        readAs: 'or together one and-term for every row whose output is one, each term naming every input.',
        detail: 'This is the mechanical proof that AND, OR and NOT can express anything: given '
          + 'any table you can write the expression down without thinking. It is also always '
          + 'larger than it needs to be, because it never notices that two rows differing in '
          + 'one variable can be merged. That gap between "always available" and "never '
          + 'minimal" is exactly the space the next section works in, and it is why synthesis '
          + 'is a real subject rather than a transcription exercise.',
        example: 'The classic four-variable function has 10 minterms: canonically 40 literals '
          + 'and 43 gates, against 7 literals and 10 gates after minimisation.'
      },
      {
        term: 'NAND alone is functionally complete, and the demo builds the proof',
        diagram: {
          definition: [
            'flowchart LR',
            '    A(["a"]) --> N1["NAND"]',
            '    A --> N1',
            '    N1 --> NOT["not a<br/>1 gate, 4 transistors"]',
            '    B(["a, b"]) --> N2["NAND"]',
            '    N2 --> N3["NAND, inputs tied"]',
            '    N3 --> AND["a and b<br/>2 gates, 8 transistors"]',
            '    C(["a, b"]) --> I1["NAND, tied"]',
            '    C --> I2["NAND, tied"]',
            '    I1 --> N4["NAND"]',
            '    I2 --> N4',
            '    N4 --> OR["a or b<br/>3 gates, 12 transistors"]'
          ].join('\n'),
          caption: 'Every gate built from one gate type. A NAND with its inputs tied together '
            + 'is an inverter; NAND then invert is AND; invert both inputs then NAND is OR, '
            + 'which is De Morgan drawn as a circuit.'
        },
        plain: 'Tie a NAND\'s inputs together and it is an inverter; everything follows.',
        formal: 'not a = a NAND a; a and b = not (a NAND b); a or b = (not a) NAND (not b)',
        readAs: 'not a is a nand-ed with itself; and is a nand followed by an inverter; or is a nand over two inverted inputs.',
        detail: 'Functional completeness matters because a fabrication process wants to build '
          + 'one thing well rather than five things adequately, and because the inverting gates '
          + 'are the cheap ones in static CMOS. The price is visible: the demo measures '
          + 'exclusive-or as one library cell at 12 transistors and depth 3, and as four NANDs '
          + 'at 16 transistors and depth 3. Completeness says the second is possible; the '
          + 'numbers say why a library ships the first.',
        example: 'NOT costs 1 NAND, AND 2, OR 3 and XOR 4 — 4, 8, 12 and 16 transistors '
          + 'respectively, all measured from the netlist.'
      },
      {
        term: 'De Morgan is an engineering tool, not an identity to memorise',
        plain: 'Not (a and b) is (not a) or (not b), and the same the other way round.',
        formal: 'not (a and b) = (not a) or (not b); not (a or b) = (not a) and (not b)',
        readAs: 'the negation of a conjunction is the disjunction of the negations, and the same the other way round.',
        detail: 'The reason to care is physical rather than logical. In static CMOS a NAND or '
          + 'NOR is one pull-up network and one pull-down network — four transistors — while an '
          + 'AND or OR is that plus an inverter, so six. De Morgan lets a synthesis tool rewrite '
          + 'any AND-OR structure into NANDs or NORs and take that saving everywhere, which is '
          + 'why a synthesised netlist is full of inverting gates even when the source described '
          + 'nothing but ANDs and ORs.',
        example: 'The demo\'s cost table: NAND and NOR at 4 transistors, AND and OR at 6, '
          + 'inverter at 2, exclusive-or at 12.'
      },
      {
        term: 'Depth is latency and width is area, and they move in opposite directions',
        plain: 'The same function can be a shallow wide circuit or a deep narrow one.',
        formal: 'depth = the longest chain of gates from any input to any output',
        detail: 'Every construction in this milestone is a position on that line. The '
          + 'multiplexer tree against the flat form, the ripple adder against carry lookahead, '
          + 'binary state encoding against one-hot: in each pair the shallower circuit is '
          + 'larger. Neither is better without a target, which is why a synthesis tool is given '
          + 'a clock period and an area budget rather than being asked for the best circuit. '
          + 'The instruction latency table in a processor manual is this trade, tabulated.',
        example: 'Majority of three is 5 gates at depth 6; the same three inputs through a '
          + 'multiplexer cell are 1 gate at depth 3.'
      },
      {
        term: 'A truth table and a waveform answer different questions',
        plain: 'The table says what it computes; the simulation says what it does on the way there.',
        formal: 'a circuit correct on every row of its table may still leave and return to that value during a transition',
        detail: 'The demo runs two evaluators over every row: a zero-delay reference that walks '
          + 'the netlist topologically, and an event-driven simulation with a delay per gate. '
          + 'They must agree on the value, and they say different things about time. The '
          + '`hazard` circuit is the point: correct on all eight rows and its output still dips '
          + 'during one input change. Everything about glitches, setup times and metastability '
          + 'lives in the gap between those two answers.',
        example: 'All 8 rows of the hazard circuit agree between the two evaluators, and its '
          + 'settling time is 5 gate delays — the dip happens inside those 5.'
      },
      {
        term: 'Fan-in and fan-out are the physical limits behind every gate count',
        plain: 'A gate with many inputs is slow; a gate driving many loads is slow.',
        formal: 'delay grows with the series transistors on the inputs and with the capacitance on the output',
        detail: 'This is why every number in this milestone assumes two-input gates. A real '
          + 'library stops at three or four inputs because the transistors are in series and '
          + 'each one adds resistance, and it inserts buffers when one gate drives many others '
          + 'because charging that capacitance takes time. An eight-input AND in a diagram is a '
          + 'tree of two-input ANDs in the silicon, and that tree is where the extra logarithm '
          + 'of depth in the measured numbers comes from.',
        example: 'The flat 16:1 multiplexer is depth 17 rather than the constant depth the '
          + 'textbook promises, because its wide AND and OR terms are trees.'
      },
      {
        term: 'A gate is transistors, and the count is the area',
        plain: 'Inverter 2, NAND or NOR 4, AND or OR 6, exclusive-or 12.',
        formal: 'static CMOS: one pull-up network and one pull-down network, complementary',
        detail: 'Counting transistors rather than gates is what makes different gate types '
          + 'comparable, and it explains the shape of every cost table that follows. An AND is '
          + 'a NAND plus an inverter, which is why the inverting gates dominate a synthesised '
          + 'netlist. An exclusive-or is three times an inverter-pair, which is why XOR-heavy '
          + 'logic — parity, error correction, cryptography — is expensive in a way that is '
          + 'invisible if you count gates and obvious if you count transistors.',
        example: 'The four-NAND exclusive-or is 16 transistors against 12 for the library cell, '
          + 'so functional completeness costs 33% here.'
      }
    ],
    'logic-minimisation': [
      {
        term: 'A prime implicant is a term that cannot be made any larger',
        plain: 'Merge minterms differing in one variable, replacing it with a dash, until nothing merges.',
        formal: 'an implicant not contained in any other implicant of the function',
        readAs: 'a product term covering only rows where the function is one, and maximal among such terms.',
        detail: 'This half of minimisation is exact, cheap and has no judgement in it. Two rows '
          + 'that differ in exactly one variable can be covered by one term that does not '
          + 'mention that variable, and repeating the merge to a fixed point leaves terms that '
          + 'cannot grow. Quine–McCluskey is that procedure written down. The reason it is not '
          + 'the whole story is that the primes usually overlap, and choosing among them is a '
          + 'different and much harder problem.',
        example: 'The demo\'s four-variable function has 10 minterms and exactly 6 prime '
          + 'implicants, of which 2 are essential.'
      },
      {
        term: 'Choosing which primes to keep is set cover, and set cover is NP-hard',
        diagram: {
          definition: [
            'flowchart TD',
            '    T["truth table"] --> P["prime implicants<br/>exact, by merging"]',
            '    P --> E["essential primes<br/>forced: no alternative covers that row"]',
            '    E --> G["greedy: take the prime<br/>covering the most rows left"]',
            '    E --> X["exhaustive: try every subset<br/>of the primes"]',
            '    G -->|"trap function: 4 terms, 8 literals"| C1["a cover"]',
            '    X -->|"trap function: 3 terms, 6 literals"| C2["the cheapest cover"]'
          ].join('\n'),
          caption: 'The two halves of minimisation. Merging is exact; covering is set cover, '
            + 'so every production tool is greedy and every greedy answer can be beaten — the '
            + 'demo runs both and prints the difference.'
        },
        plain: 'Cover every 1-row with the fewest terms and literals.',
        formal: 'minimise |S| over subsets S of the primes such that every minterm is covered by some term in S',
        readAs: 'pick the smallest set of prime implicants that still covers every row that must be one.',
        detail: 'Espresso and every other production minimiser is a heuristic for this, and '
          + 'the demo makes the gap measurable by also running an exhaustive search over every '
          + 'subset of the primes. On most functions they agree, which is why greedy is '
          + 'shipped. On a function with no essential primes the greedy answer takes a large '
          + 'term early and needs extras to mop up what it left, and the cheapest cover uses no '
          + 'large term at all.',
        example: 'On the trap function, greedy gives 4 terms and 8 literals where an exhaustive '
          + 'search over 64 subsets of 6 primes finds 3 terms and 6 literals.'
      },
      {
        term: 'An essential prime implicant is forced, and it is why greedy usually wins',
        plain: 'If a row is covered by exactly one prime, that prime is in every cover.',
        formal: 'a prime that uniquely covers some minterm',
        detail: 'Taking the essentials first is free — no search can avoid them — and on most '
          + 'real functions they cover nearly everything, leaving greedy very little room to '
          + 'get it wrong. That is the whole reason a heuristic is acceptable in a tool that '
          + 'ships. It also tells you exactly when to be suspicious: a function whose prime '
          + 'implicant chart has no essentials at all is one where the covering step is doing '
          + 'all the work and can lose.',
        example: 'The classic function has 2 essentials of 6 primes and greedy matches the '
          + 'minimum; the trap function has 0 essentials and greedy loses by 2 literals.'
      },
      {
        term: 'Don\'t-cares are free minimisation, which is an argument for partial specifications',
        plain: 'A row the specification does not constrain can be in a term or out of it, whichever helps.',
        formal: 'primes may cover don\'t-care rows; the cover must include every care row and may include any don\'t-care',
        detail: 'This is the one place where saying less gets you a cheaper circuit, and it is '
          + 'a genuine engineering lesson rather than a trick. An input combination that cannot '
          + 'occur, or an output nobody reads, is information the minimiser can use to grow a '
          + 'term. Over-specifying — writing down what the circuit happens to do rather than '
          + 'what it must do — throws that away, and the same is true of an over-tight '
          + 'assertion in software.',
        example: 'The demo\'s don\'t-care function leaves 3 of 16 rows unconstrained, and the '
          + 'minimiser uses them to enlarge terms rather than adding any.'
      },
      {
        term: 'A Karnaugh map is a truth table where adjacency is visible',
        plain: 'Rows and columns in Gray-code order, so neighbouring cells differ in one variable.',
        formal: 'cells at Hamming distance 1 are adjacent, including across the edges',
        readAs: 'two cells next to each other differ in exactly one input bit, and the map wraps around.',
        detail: 'It is a human interface to the same merging the algorithm performs, and it '
          + 'stops working at four or five variables because the eye cannot see adjacency in '
          + 'more dimensions. The algorithm does not stop, which is the practical point: the '
          + 'map is worth learning because it makes the idea of adjacency concrete, not because '
          + 'anybody minimises real logic by hand. The demo prints the map with each 1 labelled '
          + 'by how many chosen terms cover it, so overlap is visible too.',
        example: 'A four-variable map is 4 by 4 with both edges wrapping; the demo prints it '
          + 'directly from the same minterm list the algorithm reads.'
      },
      {
        term: 'A static hazard is a correct circuit with a wrong waveform',
        plain: 'Two adjacent 1-rows covered by different terms, and no term covering both.',
        formal: 'as the differing variable changes, one product turns off before the other turns on',
        detail: 'The output dips for a few gate delays even though the truth table is right on '
          + 'every row, because the two product terms have different path lengths — one goes '
          + 'through an inverter and the other does not. The fix is to add the redundant term '
          + 'that covers both rows, which is precisely the term minimisation removed for being '
          + 'unnecessary. Correctness and glitch-freedom are different properties, and '
          + 'minimising for one costs the other.',
        example: 'The minimised classic function glitches on 4 of its 13 adjacent 1-pairs; '
          + 'adding the redundant terms takes it to 0 of 13, at 22 gates instead of 10.'
      },
      {
        term: 'Whether a glitch matters depends entirely on what is downstream',
        plain: 'Into a flip-flop that samples once a cycle, a settled glitch is invisible.',
        formal: 'a transient that resolves before the setup window has no effect on a synchronous load',
        detail: 'This is why synchronous design tolerates hazards and why hazard-free covers '
          + 'are not the default. If the only consumer samples at a clock edge and the circuit '
          + 'has settled by then, the dip never happened as far as the machine is concerned. '
          + 'The exceptions are where the clock is not there to save you: an asynchronous latch '
          + 'enable, a clock line, a reset, a signal crossing into another clock domain, or an '
          + 'output leaving the chip. In those places the same dip is a fault.',
        example: 'Adding the redundant terms costs 12 extra gates and 8 extra gate delays on '
          + 'the demo\'s function — real money, spent only where it buys something.'
      },
      {
        term: 'Two-level minimisation cannot help a function with no adjacency',
        plain: 'If no two 1-rows differ in one variable, nothing merges and nothing shrinks.',
        formal: 'parity is 1 exactly on odd-weight inputs, so every pair of 1-rows differs in at least two bits',
        readAs: 'the parity function is one exactly on those inputs that carry an odd number of ones.',
        detail: 'Parity is the standard counterexample and it is worth internalising, because '
          + 'it explains why the answer to an expensive parity function is not a better '
          + 'minimiser but a different structure — a tree of exclusive-ors, which is '
          + 'multi-level logic. Two-level minimisation is a local optimum over a restricted '
          + 'shape, and some functions simply live outside that shape. Error-correcting codes '
          + 'and cryptographic primitives are made of them.',
        example: 'The demo\'s parity function is 32 literals canonically and 32 literals after '
          + 'minimisation, with 0 adjacent pairs of ones.'
      }
    ],
    'combinational-blocks': [
      {
        term: 'A multiplexer is the universal combinational element',
        plain: 'Select one of several inputs with an address.',
        formal: 'y = d[s], where s is the select value read as a binary number',
        detail: 'Reading a register, forwarding a result, choosing a cache way, picking the '
          + 'next program counter — all of them are "select one of these", and all of them are '
          + 'this block. A lookup table in an FPGA is a multiplexer whose data inputs are held '
          + 'in configuration bits, which is why an FPGA can implement any function of its '
          + 'input count. When an instruction set limits how many sources an operand can have, '
          + 'the limit is usually this block\'s depth.',
        example: 'A 4:1 tree is 3 gates at depth 6; the same function flat is 13 gates at depth '
          + '9, and both agree on all 64 input vectors.'
      },
      {
        term: 'Tree or flat is one function and two cost curves — and the textbook claim needs a caveat',
        diagram: {
          definition: [
            'flowchart LR',
            '    subgraph tree["tree: log depth, linear gates"]',
            '      D0(["d0"]) --> M0["2:1"]',
            '      D1(["d1"]) --> M0',
            '      D2(["d2"]) --> M1["2:1"]',
            '      D3(["d3"]) --> M1',
            '      M0 --> M2["2:1"]',
            '      M1 --> M2',
            '    end',
            '    subgraph flat["flat: one decoded term per input"]',
            '      E0(["d0 and not s1 and not s0"]) --> OR["OR of every term"]',
            '      E1(["d1 and not s1 and s0"]) --> OR',
            '      E2(["d2 and s1 and not s0"]) --> OR',
            '      E3(["d3 and s1 and s0"]) --> OR',
            '    end'
          ].join('\n'),
          caption: 'The same 4:1 multiplexer twice. The flat form is constant depth only if a '
            + 'wide AND and a wide OR are single gates; built from two-input gates it is both '
            + 'larger and deeper, which is what the demo measures.'
        },
        plain: 'A tree of 2:1 stages, or one level of decoded terms.',
        formal: 'tree: depth grows as log2 of the width, gates linearly. Flat: a term per input.',
        readAs: 'the tree has a depth of about the base-two logarithm of the number of data inputs.',
        detail: 'The flat form is described everywhere as constant depth, and that is only true '
          + 'with unbounded fan-in — a PLA row, a memory word line, a domino AND-OR. In a '
          + 'standard cell library the wide AND and the wide OR are themselves trees, so the '
          + 'flat multiplexer pays a logarithm twice and loses on both axes. The demo builds '
          + 'both from two-input gates and prints the result, which is more useful than the '
          + 'slogan it replaces.',
        example: 'At 16:1 the tree is 15 gates at depth 12 and the flat form is 83 gates at '
          + 'depth 17 — larger and slower.'
      },
      {
        term: 'A decoder turns an address into one hot wire, and it is the mux\'s dual',
        plain: 'n address lines drive 2 to the n outputs, exactly one of which is high.',
        formal: 'y_v = 1 exactly when the address equals v',
        detail: 'Every memory, register file and jump table contains one, and it is the same '
          + 'structure as the flat multiplexer with the data inputs removed — which is why the '
          + 'two share a cost curve. Recognising the duality is what stops a memory from '
          + 'looking like a new kind of circuit: it is a decoder on the write side, a '
          + 'multiplexer on the read side, and some storage in between. Both grow with the '
          + 'number of addresses, which is why address decoding is pipelined in large arrays.',
        example: 'A 2-bit decoder is 6 gates at depth 3 and agrees with its model on all 4 '
          + 'input vectors; the 3-bit version is 19 gates at depth 5.'
      },
      {
        term: 'A priority encoder is a chain, and that is why interrupt latency grows',
        plain: 'Report the index of the highest set input, plus a valid flag.',
        formal: 'input i wins exactly when it is set and nothing above it is',
        detail: 'The "nothing above" signal has to ripple down the whole width, so unlike '
          + 'equality — which is a tree because OR is associative — priority cannot be '
          + 'flattened. It is the same distinction as a parallel reduction against a sequential '
          + 'fold, and it has the same consequence: adding requesters adds latency rather than '
          + 'just area. The valid flag has to exist because "no input set" and "input zero set" '
          + 'would otherwise produce the same index.',
        example: 'A 4-input priority encoder is 9 gates at depth 7, checked on all 16 vectors; '
          + 'the depth is the chain, not the encode.'
      },
      {
        term: 'Equality is a tree and magnitude is a chain',
        plain: 'Equal is an XNOR per bit and an AND tree; less-than needs the most significant differing bit.',
        formal: 'a < b when at the highest bit where they differ, a has 0 and b has 1',
        detail: 'The structural difference is why an unsigned comparison costs about as much as '
          + 'a subtraction — the comparator is a subtractor that throws the difference away — '
          + 'while equality is cheap and shallow. That asymmetry shows up in an instruction set '
          + 'as branch-if-equal being available everywhere and branch-if-less-than sometimes '
          + 'costing more, and in a cache as tag comparison being an equality test rather than '
          + 'an ordering one.',
        example: 'A 4-bit comparator is 24 gates and 152 transistors at depth 13, verified on '
          + 'all 256 input pairs.'
      },
      {
        term: 'A barrel shifter is why a variable shift costs one cycle',
        plain: 'One multiplexer stage per bit of the shift amount, each moving by a power of two.',
        formal: 'log2(width) stages handle any distance, with depth independent of the amount',
        readAs: 'the number of shifting stages is the base-two logarithm of the width of the word.',
        detail: 'The alternative — shifting one place at a time — has a delay proportional to '
          + 'the distance, which is both slow and a timing side channel: an attacker who can '
          + 'measure how long a shift took learns the operand. Constant-time behaviour is a '
          + 'property of the structure, not of the code. The same block with the wrap-around '
          + 'wired in becomes a rotator, which is why rotate is as cheap as shift on most '
          + 'machines and free in a cryptographic primitive.',
        example: 'An 8-bit barrel shifter is 24 gates and 288 transistors at depth 9, verified '
          + 'on all 2 048 input vectors.'
      },
      {
        term: 'Exhaustive verification is available here, and it changes what "tested" means',
        plain: 'A block with eleven inputs has 2 048 possible vectors; drive them all.',
        formal: 'for a combinational block, correctness is a finite statement over 2^n vectors',
        readAs: 'the number of possible input vectors is two raised to the power of the input count.',
        detail: 'The model must be written from the specification in arithmetic rather than '
          + 'derived from the circuit, or it agrees by construction and proves nothing. That is '
          + 'the single most transferable idea in this section: an oracle that shares structure '
          + 'with the implementation is not an oracle. Where the space is too large — twenty '
          + 'inputs is a million vectors and thirty-two is four billion — the honest report says '
          + 'so rather than implying coverage it did not have.',
        example: 'The demo checks every one of the 2 048 vectors of the barrel shifter, and '
          + 'refuses the 16:1 multiplexer at 20 inputs, saying why.'
      },
      {
        term: 'Each block\'s cost shape becomes a limit somewhere in a real machine',
        plain: 'Depth is time, width is area, and both show up as design limits.',
        formal: 'forwarding sources, read ports and interrupt sources each add to a block on a critical path',
        detail: 'A pipeline forwards from three places rather than ten because each source is '
          + 'another input on a multiplexer in front of the ALU. A register file has two read '
          + 'ports because a third duplicates a multiplexer tree per bit. An interrupt '
          + 'controller has a priority chain, so its latency grows with the number of sources. '
          + 'None of these appear as reasons in a manual — only as numbers — and all of them '
          + 'are the cost curves on this page.',
        example: 'The demo\'s table names, for each block, the datapath it sits in and the '
          + 'failure its cost causes.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
