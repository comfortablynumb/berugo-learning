/** Concepts for latches, state machines and memory arrays (M33.6-M33.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'sequential-logic-and-state': [
      {
        term: 'Feedback is memory, and it stops the netlist being a DAG',
        diagram: {
          definition: [
            'flowchart LR',
            '    S(["set"]) --> N1["NOR"]',
            '    R(["reset"]) --> N2["NOR"]',
            '    N2 --> Q["q"]',
            '    N1 --> NQ["not q"]',
            '    Q -->|"feeds back"| N1',
            '    NQ -->|"feeds back"| N2',
            '    Q -.->|"two stable states:<br/>q=0 and q=1"| ST["which one depends<br/>on what happened earlier"]'
          ].join('\n'),
          caption: 'Two cross-coupled NOR gates. The cycle is the memory: the pair has two '
            + 'stable configurations and holds whichever one it was last driven into.'
        },
        plain: 'Two cross-coupled gates have two stable states and hold the one they were driven to.',
        formal: 'q = not (r or notQ); notQ = not (s or q) — a cycle, not a tree',
        detail: [
          'Every circuit before this one could be evaluated in a single topological pass.',
          'A latch cannot. The simulator has to relax it to a fixed point, and the answer depends '
            + 'on where it started.',
          'That is not an implementation detail. It is the definition of state.',
          'It is why a truth table stops being a complete description the moment a wire feeds '
            + 'backwards.'
        ],
        example: 'In the demo\'s SR sequence, steps 2 and 4 apply identical inputs — set and '
          + 'reset both low — and leave q at 0 and then at 1.'
      },
      {
        term: 'The SR latch is the smallest memory and it has a forbidden input',
        plain: 'Set forces q high, reset forces it low, neither holds, both is illegal.',
        formal: 'set and reset both high drives q and not-q to the same value, which is not a state',
        detail: [
          'Releasing both together leaves the pair to settle wherever its delays send it, which '
            + 'is a race with no defined winner.',
          'That is a real non-determinism inside a circuit made of deterministic parts.',
          'Two gates and eight transistors is the whole cost.',
          'That is why the SR latch is still used for arbitration and debouncing, and why every '
            + 'other storage cell on this page is built out of one.'
        ],
        example: 'The SR latch is 2 gates and 8 transistors; driving both inputs high makes the '
          + 'demo\'s complementary-outputs metric report failure.'
      },
      {
        term: 'A D latch removes the forbidden input and adds transparency',
        plain: 'One data input, one enable, and the output follows the data while the enable is high.',
        formal: 'q follows d while enable = 1, and holds when enable = 0',
        detail: [
          'It is a genuine trade rather than a strict improvement.',
          'The illegal combination is gone, and in exchange there is a window during which the '
            + 'stored value is whatever the data line happens to be, glitches included.',
          'Latch-based design exploits that transparency deliberately, letting logic borrow time '
            + 'across the boundary.',
          'It pays for that with timing analysis that is much harder to get right.'
        ],
        example: 'The D latch is 5 gates and 22 transistors; in the demo\'s sequence its output '
          + 'follows the data falling to 0 while the enable is still high.'
      },
      {
        term: 'A flip-flop is two latches with opposite enables and is never transparent',
        plain: 'The master follows while the clock is low, the slave while it is high.',
        formal: 'q takes the value d held at the rising edge, and no path is open end to end',
        detail: [
          'That is the property the whole of synchronous design rests on.',
          'Every storage element in the machine samples at the same instant, so the logic between '
            + 'them has a whole clock period to settle and its glitches are invisible.',
          'The cost is roughly twice a latch: the demo measures 11 gates against 5, and a real '
            + 'library about 24 transistors against 12.',
          'That is why latches survive where area matters more than simplicity.'
        ],
        example: 'In the demo\'s sequence the flip-flop ignores the data falling to 0 while the '
          + 'clock is high, where the D latch follows it.'
      },
      {
        term: 'Setup and hold are constraints on the data, and only one is fixed by a slower clock',
        plain: 'Stable for a setup time before the edge and a hold time after it.',
        formal: 'setup: the longest path must arrive early enough. hold: the shortest path must not arrive too early.',
        detail: [
          'A setup violation means the logic did not finish, and slowing the clock always fixes '
            + 'it.',
          'A hold violation means a path is too fast: the next value overwrites the one being '
            + 'captured.',
          'Slowing the clock changes nothing at all there, because both edges move together.',
          'The only fix is to insert buffers whose purpose is to be slow, which is the one place '
            + 'in engineering where the answer is to make something worse.'
        ],
        example: 'The demo\'s timing table names, for each constraint, what violating it does '
          + 'and which fixes do not work.'
      },
      {
        term: 'Metastability is a probability, not a bug to be removed',
        plain: 'Data changing inside the aperture can leave the flip-flop balanced between states.',
        formal: 'the probability of still being undecided decays exponentially with the time allowed',
        readAs: 'the chance of still being undecided falls off exponentially with the time you allow it.',
        detail: [
          'There is no circuit that decides an arbitrarily close race in bounded time.',
          'The standard result is that any bistable element has an unbounded settling time for '
            + 'some input timing.',
          'The engineering answer is to allow more time: two flip-flops in series, so the second '
            + 'sees a settled value.',
          'The other half of the answer is to quote a mean time between failures rather than a '
            + 'guarantee. Every clock-domain crossing is this calculation.'
        ],
        example: 'The demo cannot show a metastable event, because the simulator is discrete — '
          + 'which is itself worth knowing about simulation.'
      },
      {
        term: 'A register is n flip-flops on one clock, and the enable must not gate the clock',
        plain: 'Recirculate the old value through a multiplexer when the write enable is low.',
        formal: 'd_next = enable ? d : q, with the clock untouched',
        detail: [
          'Gating the clock saves a multiplexer per bit and introduces skew.',
          'The gated clock arrives later than the ungated one, so two registers no longer sample '
            + 'at the same instant.',
          'Modern designs do gate clocks, because it is the main lever for dynamic power. They do '
            + 'it with dedicated cells and careful analysis rather than an AND gate somebody '
            + 'added.',
          'The demo\'s register recirculates, which is the version that is always safe.'
        ],
        example: 'A 4-bit register is 52 gates — 13 per bit — and matches its reference on all '
          + 'six clocked cycles the demo drives.'
      },
      {
        term: 'Read-during-write has two correct answers, and the design must pick one',
        plain: 'A port read before the edge sees the old value; after the edge, the new one.',
        formal: 'the same cycle yields different data depending on which side of the edge it is sampled',
        detail: [
          'Both are legitimate and both appear in real register files.',
          'The demo makes the ambiguity concrete by reporting the same cycle read twice.',
          'The two columns differ on exactly the cycles where a port reads the register being '
            + 'written.',
          'That is the hardware form of a read-write race. It is why a pipeline that reads its '
            + 'operands in the same cycle a previous instruction writes them needs a forwarding '
            + 'path.'
        ],
        example: 'On the demo\'s six-cycle schedule, 3 cycles read the register being written, '
          + 'and on those the before-edge and after-edge readings differ.'
      }
    ],
    'hardware-state-machines': [
      {
        term: 'Every synchronous machine is a register and two blocks of logic',
        plain: 'State register, next-state logic, output logic. There is no other shape.',
        formal: 'state\' = next(state, input); output = out(state) or out(state, input)',
        readAs: 'the next state is a function of the state and the input; the output is a function of the state, and for a Mealy machine of the input too.',
        detail: 'A control unit, a cache controller, a bus interface and a traffic light are the '
          + 'same circuit with different tables in the middle. Recognising that means a state '
          + 'machine is never a new kind of design problem — it is a table, and everything else '
          + 'is mechanical. The clock period is the longest path through the next-state logic '
          + 'plus the flip-flop overheads, so a machine with deeply nested conditions in one '
          + 'state is a machine with a slow clock.',
        example: 'The demo\'s 1101 detector, binary encoded, is 3 flip-flops and 26 gates with '
          + '11 gate delays of logic between two edges.'
      },
      {
        term: 'Synthesis from a transition table is mechanical',
        plain: 'Each flip-flop input is a Boolean function of the state bits and the input.',
        formal: 'the next-state function of bit k is a truth table over the state bits and the inputs',
        detail: 'Those functions come straight out of the table, get minimised by the algorithm '
          + 'from three sections earlier, and become gates. Nothing about the step requires '
          + 'judgement, which is exactly why a language can describe the machine and a tool can '
          + 'build it — and why the interesting decisions are the ones the tool cannot make: '
          + 'how many states, what encoding, and where the outputs come from.',
        example: 'The demo synthesises the same five-state machine three ways and checks every '
          + 'one against the transition table over all 256 strings of length 8.'
      },
      {
        term: 'The state encoding is free to choose and expensive to choose badly',
        diagram: {
          definition: [
            'flowchart TD',
            '    M["five states, one transition table"] --> B["binary<br/>3 flip-flops, 26 gates<br/>logic depth 11"]',
            '    M --> H["one-hot<br/>5 flip-flops, 30 gates<br/>logic depth 7"]',
            '    M --> G["gray<br/>3 flip-flops, 20 gates<br/>logic depth 7"]',
            '    B -.->|"3 unused codes"| U["a glitch can land there,<br/>and nothing defines the way out"]',
            '    H -.->|"no unused codes,<br/>but many illegal ones"| I["any pattern with two bits set"]'
          ].join('\n'),
          caption: 'One machine, three encodings, identical behaviour and three different '
            + 'circuits — all measured by the demo over the same 256 test strings.'
        },
        plain: 'Binary is the fewest flip-flops; one-hot is the shallowest decode.',
        formal: 'binary needs ceil(log2 k) bits for k states; one-hot needs k',
        readAs: 'binary encoding needs the ceiling of the base-two logarithm of the number of states.',
        detail: 'On an FPGA flip-flops come free with every lookup table and logic levels are '
          + 'the scarce resource, so one-hot usually wins. In an ASIC with hundreds of states a '
          + 'flip-flop per state is real area, so binary with decoded outputs wins. Gray coding '
          + 'changes one bit per step where the state order allows it, which matters when '
          + 'something outside the clock domain samples the state — a counter crossing into '
          + 'another clock, for instance.',
        example: 'Binary is 3 flip-flops at logic depth 11; one-hot is 5 at depth 7; gray is 3 '
          + 'at depth 7 with 20 gates. All three produce identical output on 256 strings.'
      },
      {
        term: 'Moore outputs are stable; Mealy outputs are early',
        plain: 'A Moore output depends on the state; a Mealy output depends on the state and the input.',
        formal: 'Moore: out(state). Mealy: out(state, input)',
        detail: 'A Moore output changes just after the clock edge and is quiet for the rest of '
          + 'the period, which makes it safe to send anywhere. A Mealy output responds within '
          + 'the same cycle and inherits every glitch on the input, which makes it the wrong '
          + 'thing to send to another clock domain, a chip pin, or anything that latches on a '
          + 'level. Mealy machines often need fewer states, and that is the trade rather than '
          + 'an argument for either.',
        example: 'The demo\'s Moore detector needs a fifth state to be in while it reports; the '
          + 'Mealy version reports on the transition and returns to an earlier state.'
      },
      {
        term: 'The clock period is the longest path between two flip-flops',
        plain: 'Clock-to-q plus next-state logic plus setup, all inside one period.',
        formal: 'period >= clock-to-q + logic + setup',
        readAs: 'the period must be at least the flip-flop delay plus the logic plus the setup time.',
        detail: 'Static timing analysis measures that path structurally, over every input '
          + 'pattern at once, which is why "the simulation passed" is not a timing argument. '
          + 'Notice that the input-to-output path a combinational tool reports is not the same '
          + 'number: a Moore machine whose output is a wire off the register has a one-delay '
          + 'output path and an eleven-delay register-to-register path, and only the second '
          + 'sets the clock.',
        example: 'The binary machine\'s period is 14: 11 of logic plus 3 of flip-flop overhead.'
      },
      {
        term: 'Splitting a slow state is the standard fix, and it costs a cycle',
        plain: 'Fewer levels of logic per state, more states.',
        formal: 'the same computation across two periods instead of one longer period',
        detail: 'This is pipelining applied to control rather than to data, and it has the same '
          + 'shape: throughput improves, latency gets worse, and the overhead per stage puts a '
          + 'floor under how far it goes. It is also the reason a protocol engine written as '
          + 'one state with a large conditional expression synthesises badly — the tool cannot '
          + 'split it for you, because splitting changes the cycle-by-cycle behaviour the '
          + 'specification pinned down.',
        example: 'The demo\'s encodings differ by 4 gate delays of logic, which is the same '
          + 'magnitude a state split would buy on this machine.'
      },
      {
        term: 'Unused state codes are a hazard, not a warning',
        plain: 'Five states in three bits leaves three patterns the machine should never hold.',
        formal: '2^ceil(log2 k) - k unreachable codes, with no defined transitions',
        readAs: 'the number of unused codes is two to the bit count, minus the number of real states.',
        detail: 'A glitch, a single-event upset or an incomplete reset can land the register in '
          + 'one of them, and a machine with no defined transition out can stay there forever. '
          + 'Safety-critical designs make every unused code jump to reset, which costs gates. '
          + 'The software analogue is an enum value that arrived from a deserialiser: the type '
          + 'says it cannot happen, the bits say otherwise, and the honest answer is a default '
          + 'branch.',
        example: 'Binary encoding of the demo\'s five states leaves 3 unused codes; one-hot '
          + 'leaves none of that kind and many patterns with two bits set.'
      },
      {
        term: 'The netlist is the claim and the transition table is the judge',
        plain: 'Run both on every string and compare symbol by symbol.',
        formal: 'for every input string up to length L, the gate output must equal the table output',
        detail: 'The abstract machine walks a table; the netlist clocks flip-flops. They share '
          + 'no code, so agreement is evidence rather than tautology, and disagreement always '
          + 'means the netlist is wrong. One subtlety decides whether the comparison works at '
          + 'all: the gate output must be read BEFORE the clock edge, where a downstream '
          + 'register would sample it. Reading after the edge shifts the whole output by one '
          + 'cycle and looks like an off-by-one in the machine.',
        example: 'All three encodings produce 0 mismatches over the 256 strings of length 8.'
      }
    ],
    'memory-arrays': [
      {
        term: 'A memory is a decoder, some storage and a multiplexer',
        plain: 'Writing decodes an address into an enable; reading selects with a tree.',
        formal: 'write: enable_i = (address = i) and write_enable. read: out = mux(address, cells)',
        detail: 'Both blocks were measured two sections ago, which is the point: a memory is '
          + 'not a new kind of circuit. It is the decoder and the multiplexer arranged around '
          + 'some cells, and its cost curves are theirs. Once that is clear, every memory '
          + 'structure in a machine — a cache, a TLB, a branch predictor table, a register file '
          + '— is the same picture with different numbers.',
        example: 'A 4-by-4-bit register file is 244 gates, of which 36 are decode and read '
          + 'multiplexing and the rest are the 16 storage cells.'
      },
      {
        term: 'Capacity is the cheap dimension and ports are the expensive one',
        plain: 'Doubling the registers adds cells; adding a read port duplicates every read tree.',
        formal: 'gates grow with capacity, and with capacity x width x ports',
        detail: 'That asymmetry is why a three-operand instruction set needs two read ports and '
          + 'one write port, why a third read port for a fused multiply-add is a real '
          + 'architectural decision, and why a wide out-of-order machine spends an enormous '
          + 'share of its area on the register file and its bypass network. It also explains '
          + 'banking: splitting the array and accepting occasional conflicts is cheaper than '
          + 'building ports that never conflict.',
        example: 'From 2 to 8 registers at the same width, access logic goes from 10% of the '
          + 'gates to 18% — and a third read port would roughly double the read side.'
      },
      {
        term: 'Which half dominates depends on what a cell costs',
        plain: 'A flip-flop bit is about thirteen gates; an SRAM cell is six transistors.',
        formal: 'flip-flop about 20 transistors per bit; SRAM 6; DRAM 1 plus a capacitor',
        detail: 'Built from flip-flops, as the demo builds it, the cells dominate and the '
          + 'access logic is a fifth of the total at most. Swap in six-transistor SRAM cells — '
          + 'which is what a real array does, at the price of needing sense amplifiers and a '
          + 'special layout — and the same access logic becomes the larger half. The general '
          + 'point is that "storage is cheap, access is expensive" is a claim about a '
          + 'technology, not a law.',
        example: 'The demo measures 15.3 gates per stored bit in a 4-by-4 file, of which about '
          + '13 per bit is the flip-flop and its recirculating multiplexer.'
      },
      {
        term: 'SRAM is six transistors and no refresh',
        plain: 'Two cross-coupled inverters and two access transistors.',
        formal: 'a bistable pair driven onto bit lines through pass transistors, read by sense amplifiers',
        detail: 'It is the same bistable cell as the latch at the start of this milestone, '
          + 'built as compactly as a process allows and read differentially so that a small '
          + 'voltage difference is enough. Being static, it needs no refresh and holds while '
          + 'powered. Being six transistors rather than one, it is expensive per bit — which is '
          + 'exactly why caches are measured in megabytes and main memory in gigabytes.',
        example: 'Six transistors against about twenty for a flip-flop is the factor of three '
          + 'that separates a register file from a cache.'
      },
      {
        term: 'DRAM trades transistors for refresh, and everything odd follows from that',
        plain: 'One transistor and one capacitor per bit, and the charge leaks.',
        formal: 'a read discharges the cell, so every read is followed by a write-back; rows must be refreshed periodically',
        detail: 'Reading destroys the row, so the sense amplifiers rewrite it; charge leaks, so '
          + 'the whole array is read and rewritten thousands of times a second. Every strange '
          + 'thing about DRAM timing — row activation, precharge, the row buffer, refresh '
          + 'stalls — is a consequence of those two facts, and so is the density that makes it '
          + 'main memory.',
        example: 'One transistor per bit against six for SRAM is the factor that decides which '
          + 'level of the hierarchy each technology occupies.'
      },
      {
        term: 'The array is a grid, so an access is a row and then a column',
        plain: 'Activating a row brings a whole page into the sense amplifiers; columns are then cheap.',
        formal: 'row activation is the expensive step; subsequent column accesses in the same row are not',
        detail: 'This is where the memory hierarchy\'s locality assumption physically comes '
          + 'from. A sequential access pattern is not merely cache-friendly; one level further '
          + 'down it is row-buffer-friendly, and a random pattern pays a row activation per '
          + 'access. It is also why memory controllers reorder requests: grouping accesses to '
          + 'the same row is worth more than servicing them in order.',
        example: 'The demo\'s technology table sets the transistor costs side by side, which is '
          + 'what makes the hierarchy\'s levels predictable rather than arbitrary.'
      },
      {
        term: 'Content-addressable memory inverts the interface and pays for it',
        plain: 'Compare the search key against every entry at once.',
        formal: 'a comparator per entry, all switching on every lookup',
        detail: 'A CAM is what a fully associative cache and a TLB are built from, and its cost '
          + 'is a comparator per entry plus the power to run them all simultaneously. That is '
          + 'why associativity is a small number rather than a large one, and why a set-'
          + 'associative cache — a decoder to pick a set, then a few comparators — is the '
          + 'design that actually ships. Choosing between "index by address" and "search by '
          + 'value" is a cost decision, not a semantic one.',
        example: 'The demo\'s port table places CAM beside the multiplexer-based read port, '
          + 'where its per-entry comparator cost is visible.'
      },
      {
        term: 'The reference is a variable, and the gates must agree with it',
        plain: 'One JavaScript array models the file; the netlist must match it every cycle.',
        formal: 'write on the edge, and a read in the same cycle returns the value stored before it',
        detail: 'The model is four lines and shares nothing with the netlist, which is what '
          + 'makes agreement informative. It also forces the read-during-write decision to be '
          + 'stated: this model returns the old value, so the before-edge reading matches and '
          + 'the after-edge reading does not. A model that fudged that would hide the very '
          + 'question the section exists to raise.',
        example: 'Six clocked cycles, 6 of 6 matching the reference on the before-edge reading '
          + 'and 3 of 6 differing between the two readings.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
