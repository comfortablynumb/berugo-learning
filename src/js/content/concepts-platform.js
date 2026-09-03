/** Concepts for the platform sections. */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'code-engine': [
      {
        term: 'Sandbox',
        diagram: {
          definition: [
            'flowchart LR',
            '    P["the page<br/>DOM · storage · network"] -->|"source and input"| W["Web Worker<br/>your code runs here"]',
            '    W -->|"results and operation<br/>counts"| P',
            '    W --> N["what it cannot reach from inside:<br/>the DOM, storage, the network"]'
          ].join('\n'),
          caption: 'The only channel is messages. Code that hangs, loops forever or throws cannot take the page down with it, which is what makes running a stranger\'s code safe.'
        },
        plain: 'Your code runs in a Web Worker with no access to the page, storage or the network.',
        formal: 'new Function(capabilities…, code) inside a dedicated worker',
        detail: [
          'Isolation here is structural. It is not a blacklist someone has to keep up to date. ' +
            'A dedicated worker gets its own global scope, and that scope has no document, no ' +
            'localStorage and no page. There is nothing to forbid, because there is nothing there.',
          'Your code is compiled with new Function rather than eval, so it cannot see the scope it ' +
            'was compiled from. It is handed exactly four capabilities as parameters: log, a ' +
            'seeded rng, the ops counters and assert.',
          'A list of host names — require, window, document, fetch, importScripts and the rest — ' +
            'is declared as unbound parameters, so inside your function they read as undefined. ' +
            'That part is hygiene rather than a boundary. globalThis still reaches everything, and ' +
            'closing that would need a parser. The boundary is the worker.'
        ],
        example: 'A lab that tries document.body sees a ReferenceError, not the page.'
      },
      {
        term: 'Wall-clock budget',
        plain: 'Each run gets a deadline. Overrunning it terminates the worker, which is the only ' +
          'reliable way to stop an infinite loop.',
        formal: 'terminate() after timeoutMs; the worker is then replaced',
        detail: [
          'A while (true) {} loop never yields, never checks a flag and never returns to an event ' +
            'loop. Nothing running inside the worker can stop it.',
          'The host can. It starts a timer when it posts the run, and if that timer fires first it ' +
            'calls terminate() on the worker and reports a timeout. The worker is then discarded ' +
            'and a fresh one takes its place, because a terminated worker keeps no usable state. ' +
            'The default budget is 2 seconds.',
          'The cost of this design is that a timeout tells you the run did not finish, and nothing ' +
            'more. There is no stack to show, because there is no live worker left to ask.'
        ],
        example: 'A quadratic scan over 20 000 items exceeds a 1.2 s budget and reports "timed out".'
      },
      {
        term: 'Step budget',
        plain: 'A cap on instrumented operations. It is enforced from inside, so it can only count ' +
          'work that passes through the instrumented primitives.',
        formal: 'ops.count(name) throws StepBudgetExceeded past the limit',
        readAs: 'Every counted operation adds one to a running total, and the first call past the ' +
          'limit raises an error instead of doing its job.',
        detail: [
          'Every instrumented primitive adds one to a running total. Past the limit, the next call ' +
            'throws StepBudgetExceeded instead of returning. You get a named error at the ' +
            'operation that went over, which is far more useful than a terminated worker.',
          'It only sees work routed through ops. A loop that compares with < directly, or one that ' +
            'does no work at all, passes the step budget untouched. The wall clock has to catch ' +
            'that instead.',
          'The two limits are complementary on purpose: the step budget explains, the wall clock ' +
            'guarantees. The default limit is 5 × 10⁷ operations — fifty million.'
        ],
        example: 'A runaway sort that keeps calling ops.cmp stops with a step-budget error.'
      },
      {
        term: 'Instrumented primitive',
        plain: 'A counted operation the harness provides. The platform counts these instead of ' +
          'rewriting your code to guess at its cost.',
        formal: 'ops.cmp, ops.swap, ops.view(array).get/set',
        detail: [
          'The alternative is to parse your code and insert counters. That has to decide what ' +
            'counts as a comparison in a language where < is also string collation, and where ' +
            'a[i] can run a getter.',
          'Counted primitives move the decision to the exercise author, where it belongs. The lab ' +
            'says which operations it charges for, and the count is exact rather than inferred. ' +
            'Wrapping an array in ops.view(array) counts its reads and writes one at a time. ' +
            'That is what lets a lab tell an algorithm that scans twice from one that scans once.',
          'The trade is that uninstrumented work is invisible. A lab that grades on counts has to ' +
            'name the primitives it expects the answer to go through.'
        ],
        example: 'The binary-search lab asserts at most ⌈log₂ n⌉ + 1 calls to ops.cmp — the ' +
          'number of times you can halve n before reaching one item, rounded up, plus one.'
      },
      {
        term: 'Seeded determinism',
        plain: 'Every run receives a seeded generator, so two runs with the same seed produce the ' +
          'same input and the same trace.',
        formal: 'rng = Random.seeded(seed)',
        detail: [
          'Math.random() cannot be reproduced. That makes every measurement a fresh sample of a ' +
            'different input, and every bug a story about what probably happened.',
          'The sandbox passes in a seeded generator instead. Each graded test gets seed + ' +
            'position, so tests do not share a stream and cannot be reordered into a different ' +
            'meaning.',
          'The practical effect is that a difference between two runs has exactly one cause: your ' +
            'edit. It also makes a failing case portable. The seed is the whole repro, so the same ' +
            'input replays here, in the node suite, and on someone else\'s machine.'
        ],
        example: 'Change one line, run again, and any difference in the result is your change.'
      },
      {
        term: 'Median of runs',
        plain: 'A timing is reported as a median over repeated runs with the count shown, never as ' +
          'a single sample.',
        formal: 'median(t₁…tₙ) with n displayed',
        readAs: 'Take the n timings, sort them, and report the one in the middle. Then print n ' +
          'beside it, so a reader can see how many runs that middle came from.',
        detail: [
          'A browser timing is a noisy sample. JIT warm-up, garbage collection and whatever else ' +
            'the machine is doing all land on it. So does timer quantisation: the clock ticks in ' +
            'steps, so it rounds.',
          'That noise is one-sided. Interference only ever makes a run slower, never faster. The ' +
            'median throws the slow tail away where the mean chases it, so half above and half ' +
            'below is the honest summary.',
          'Showing n is the other half of the contract. "3.2 ms (median of 15)" can be argued ' +
            'with, because the reader can see how much evidence is behind it. A bare number ' +
            'cannot.'
        ],
        example: '"3.2 ms (median of 15)" rather than "3.2 ms".'
      },
      {
        term: 'Backend parity',
        plain: 'The worker and the inline fallback run the same execution core, so a lab cannot pass ' +
          'in one and fail in the other for reasons of its own.',
        formal: 'both backends call Sandbox.execute(request, emit)',
        detail: [
          'Two backends exist because they answer different needs. The worker gives isolation and ' +
            'a real timeout. The inline backend gives a synchronous call the node test suite can ' +
            'grade against without a browser.',
          'If each had its own execution path, the suite would be testing something the learner ' +
            'never runs. Instead both post the identical message protocol to one Sandbox.execute, ' +
            'so a disagreement can only come from the exercise.',
          'There are two guarantees the inline backend cannot honour: the wall clock is not ' +
            'enforced, and host globals are shadowed rather than absent. Both come back in ' +
            'result.warnings rather than being passed over. A fallback that quietly weakens a ' +
            'guarantee is worse than one that refuses to run.'
        ],
        example: 'The node suite grades every exercise inline; the browser grades it in the worker; ' +
          'a disagreement is a bug in the exercise, not in the backend.'
      },
      {
        term: 'Self-contained test',
        plain: 'A graded test is serialised to source text and rebuilt inside the sandbox, so it can ' +
          'use its two arguments and nothing else from the file it was written in.',
        formal: "String(spec.assert) → new Function('return (' + src + ')')()",
        readAs: 'Turn the test function back into its source text and send the text across to the ' +
          'worker. Compile it into a function again on the other side. The arrow is "becomes": ' +
          'what arrives is a new function built from the same characters, and nothing else.',
        detail: [
          'A worker is a separate realm, and the only thing that crosses to it is data. A function ' +
            'is not data. It carries a closure, and a closure cannot be posted.',
          'So each test is turned into source text, sent across, and rebuilt on the far side with ' +
            'new Function. That compiles it in the worker\'s global scope, not in the file it was ' +
            'written in.',
          'Everything the test needs has to arrive through its two parameters: the learner\'s ' +
            'exported entry point, and an api object carrying assert, ops, log, a per-test seeded ' +
            'rng and Random. The failure is loud, but it reads oddly the first time. A helper ' +
            'defined right beside the test is simply not defined once the test crosses the ' +
            'boundary.'
        ],
        example: 'A test that calls a helper defined beside it throws "helper is not defined" once it ' +
          'crosses into the worker.'
      },
      {
        term: 'Counted, not timed',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["grade on elapsed time"] --> B["a fast laptop passes<br/>a slow one fails<br/>the same code"]',
            '    C["grade on operation counts"] --> D["the same verdict on every machine"]',
            '    D --> E["because a count is a property of<br/>the algorithm, not of the hardware"]'
          ].join('\n'),
          caption: 'A timing measures your machine as much as your code. A count measures only the code, which is the thing being graded.'
        },
        plain: 'Grading asserts operation counts rather than elapsed time, because a count is a ' +
          'property of the algorithm and a time is a property of the machine that ran it.',
        formal: 'assert on ops.snapshot(), not on durationMs',
        detail: [
          'Timing-based grading has to pick a threshold, and any threshold is wrong on some ' +
            'machine. Too tight and a correct answer fails on a busy laptop. Too loose and a ' +
            'quadratic solution passes on a fast one.',
          'An operation count has no such dial. "At most ⌈log₂ n⌉ + 1 comparisons" — the number ' +
            'of halvings it takes to reach a single item, rounded up, plus one — is a claim about ' +
            'the algorithm. It holds on every machine, at every processor speed, under every JIT.',
          'So a failed assertion says something true about your code, rather than something true ' +
            'about the afternoon. Times are still measured and shown, because constants matter. ' +
            'They are just never what decides a pass.'
        ],
        example: 'The binary-search lab asserts at most ⌈log₂ n⌉ + 1 comparisons; the same code on a slower ' +
          'laptop still passes.'
      }
    ],
    'js-systems': [
      {
        term: 'ArrayBuffer and views',
        diagram: {
          definition: [
            'flowchart TD',
            '    B["ArrayBuffer — 8 raw bytes"] --> U8["Uint8Array<br/>8 elements"]',
            '    B --> U32["Uint32Array<br/>2 elements"]',
            '    B --> F64["Float64Array<br/>1 element"]',
            '    U32 --> W["all three read the same bytes —<br/>write through one and<br/>the others see it immediately"]'
          ].join('\n'),
          caption: 'The buffer is storage. A view is an opinion about what those bytes mean, and several opinions can share one buffer.'
        },
        plain: 'A buffer is raw bytes; a typed array or DataView is an interpretation of those bytes. ' +
          'Several views can share one buffer.',
        formal: 'new Float64Array(buffer) aliases the same memory as new Uint8Array(buffer)',
        detail: 'An ArrayBuffer has no type at all — it is a length in bytes and nothing more. Every ' +
          'read and write goes through a view, and views over the same buffer are aliases, not ' +
          'copies: writing through the Float64Array changes what the Uint8Array reads back on the ' +
          'next line. That is the whole mechanism behind bit-level work in JavaScript, and it is how ' +
          'a language with one numeric type gets to inspect a float\'s exponent. It also means ' +
          'aliasing bugs are available to you in a language that otherwise has none, and that a view ' +
          'must respect alignment: a Float64Array can only start at a byte offset divisible by 8.',
        example: 'Write a float, read its eight bytes, and flip the sign bit by hand.'
      },
      {
        term: 'Endianness',
        plain: 'The order bytes are stored in. Typed arrays use the platform order; DataView lets ' +
          'you choose, which is what a wire format needs.',
        formal: 'view.getUint32(0, littleEndian)',
        detail: 'A four-byte integer has to be laid out somehow, and the two answers — least ' +
          'significant byte first, or most significant first — are both in use. Typed arrays take ' +
          'whatever the platform does, which is little-endian on x86 and on ARM as configured ' +
          'everywhere you are likely to run this, so code that reads its own memory never notices. ' +
          'Code that reads someone else\'s does: network protocols and most file formats are ' +
          'big-endian, and a Uint32Array over those bytes silently produces reversed numbers. ' +
          'DataView is the fix — every accessor takes an explicit littleEndian flag, so the byte ' +
          'order is stated in the code rather than inherited from the machine.',
        example: '0x01020304 is 04 03 02 01 in memory on x86 and ARM.'
      },
      {
        term: 'Number is a float64',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["integers up to 2⁵³"] --> B["every one exactly representable"]',
            '    C["integers above 2⁵³"] --> D["the gap between neighbouring<br/>doubles is now larger than 1"]',
            '    D --> E["so n and n + 1 can be<br/>the very same number"]'
          ].join('\n'),
          caption: 'There is no integer type here. Past 2⁵³ the doubles run out of room and counting silently stops working — no error, just a value that will not move.'
        },
        plain: 'Every JavaScript number is an IEEE 754 double, so integers are exact only up to 2⁵³.',
        formal: 'Number.MAX_SAFE_INTEGER = 2⁵³ − 1 = 9007199254740991',
        readAs: 'Two multiplied by itself 53 times, minus one: 9 007 199 254 740 991, a little over ' +
          'nine quadrillion. Up to there every whole number has its own exact representation; past ' +
          'it they start sharing one.',
        detail: 'A double stores a number in three parts: a sign, an exponent saying roughly how ' +
          'big it is, and a mantissa — the significant digits, written in binary. The mantissa is 52 ' +
          'stored bits plus one leading bit that is always 1 and so is never written down, which ' +
          'gives 53 bits of precision. That is exactly enough to name every whole number up to 2⁵³, ' +
          'and past it the values start skipping: above 2⁵³ only even ' +
          'numbers are representable, above 2⁵⁴ only multiples of four, and so on. Nothing warns you ' +
          'at the boundary — 2⁵³ + 1 simply rounds to 2⁵³ and compares equal to it. This is why ' +
          'database ids, nanosecond timestamps and 64-bit counters cannot ride in a Number, and why ' +
          'BigInt exists. Below the boundary the guarantee is genuinely exact, so ordinary integer ' +
          'arithmetic is safe; it is the size of the values, not the operations, that decides.',
        example: '2⁵³ + 1 === 2⁵³ evaluates to true.'
      },
      {
        term: 'int32 coercion',
        plain: 'Bitwise operators convert to signed 32-bit first; >>> converts to unsigned 32-bit.',
        formal: 'ToInt32 for & | ^ << >> ~, ToUint32 for >>>',
        readAs: 'Before any of the operators & | ^ << >> or ~ looks at your value, the language ' +
          'quietly converts it to a signed 32-bit integer; >>> converts it to an unsigned one ' +
          'instead. "Signed" means the top bit is read as a minus sign rather than as part of the ' +
          'number.',
        detail: 'Every bitwise operator starts by truncating its operands to 32 bits, which is why ' +
          'they behave like a different language from the arithmetic around them. The conversion ' +
          'wraps modulo 2³² — it keeps only the remainder after dividing by 2³², which in bits just ' +
          'means keeping the last 32 of them — and then reads the top bit as a sign, so a value ' +
          'above 2³¹ − 1 ' +
          'comes back negative — the classic surprise being a hash that goes negative the moment it ' +
          'sets its high bit. The unsigned shift >>> is the one exception, and it is the standard ' +
          'idiom for getting an unsigned reading back: x >>> 0. Truncation also silently discards ' +
          'anything above bit 31, so a value built up past 2³² keeps only its low word.',
        example: '(2 ** 31) | 0 is −2147483648, and (−1) >>> 0 is 4294967295.'
      },
      {
        term: 'Math.imul',
        plain: 'True 32-bit integer multiplication. Plain * goes through float64 and loses the low ' +
          'bits that hashing depends on.',
        formal: 'Math.imul(a, b) ≡ (a · b) mod 2³² as a signed int32',
        readAs: 'Math.imul(a, b) gives the same answer as multiplying a by b and then throwing away ' +
          'everything except the last 32 bits, read back with the top bit as a sign. "mod 2³²" is ' +
          '"the remainder after dividing by 2³²", which in binary is exactly that truncation.',
        detail: 'Multiplying two 32-bit values produces up to 64 bits of product, and a double can ' +
          'only hold 53 of them exactly — so plain * rounds, and what it throws away is the low end. ' +
          'For a hash function that is fatal: mixing works precisely by carrying low-bit entropy ' +
          'upward, and a rounded product corrupts the bits the next step depends on. Math.imul does ' +
          'the multiply as the hardware does it, keeping the low 32 bits and discarding the high ' +
          'ones, which is exactly what a mod-2³² mixer wants. Every murmur- or xxhash-style step in ' +
          'this platform is written with it, and swapping in * changes the avalanche result — ' +
          'avalanche being the property a hash is judged on: flip one bit of the input and about ' +
          'half the output bits should flip.',
        example: 'Every mixing step in a murmur-style hash is a Math.imul.'
      },
      {
        term: 'Structured clone vs transfer',
        plain: 'Posting a buffer to a worker copies it; transferring moves it and empties the sender.',
        formal: 'postMessage(buf, [buf]) transfers ownership',
        detail: 'postMessage cannot share memory, so by default it deep-copies the message with the ' +
          'structured clone algorithm — which is fine for a small object and quietly O(n) for a ' +
          '50 MB buffer, on both sides. Listing the buffer in the transfer list instead moves ' +
          'ownership: no bytes are copied, and the sender\'s buffer is detached, so its byteLength ' +
          'becomes 0 and every view over it throws on access. That detachment is the point of the ' +
          'design — it is what makes zero-copy safe without shared mutable state — and it is also the ' +
          'bug people hit, because the sender usually still holds a reference it expects to work.',
        example: 'After a transfer, the original buffer\'s byteLength is 0.'
      },
      {
        term: 'ulp and Number.EPSILON',
        plain: 'The gap between neighbouring doubles grows with magnitude. Number.EPSILON is that gap ' +
          'just above 1 — it is not a universal tolerance.',
        formal: 'ulp(x) = 2^(⌊log₂|x|⌋ − 52); Number.EPSILON = 2⁻⁵²',
        readAs: 'The gap between x and the next representable number along is two raised to the ' +
          'power of (the exponent of x, minus 52) — where the exponent is how many times you can ' +
          'halve x before landing between 1 and 2. Number.EPSILON is that same gap measured at ' +
          'x = 1, which works out at 2⁻⁵², about 2.22 × 10⁻¹⁶.',
        detail: 'Floating point does not space its values evenly. It has a fixed 52 bits of ' +
          'precision to spend wherever the number happens to sit, so the gap between one ' +
          'representable value and the next is a fixed fraction of the value rather than a fixed ' +
          'amount — which means the gap doubles every time the magnitude does. Near 1 it is 2⁻⁵², ' +
          'which is what Number.EPSILON names; near 10⁹ it is about ' +
          '1.19 × 10⁻⁷, roughly a billion times larger. Comparing with Math.abs(a − b) < ' +
          'Number.EPSILON therefore means "bit-identical" at large magnitudes — it rejects even ' +
          'adjacent doubles — and means "wildly loose" near zero. A tolerance that works across ' +
          'magnitudes has to scale with the operands, or be expressed in ulps directly.',
        example: 'Near 10⁹ the neighbours are 1.19 × 10⁻⁷ apart, so |a − b| ≤ 2.2 × 10⁻¹⁶ is never ' +
          'true there, even for adjacent values.'
      },
      {
        term: 'Round half to even',
        plain: 'When a result falls exactly between two representable values, IEEE takes the one whose ' +
          'last mantissa bit is 0 rather than always rounding up.',
        formal: 'roundTiesToEven — the default IEEE 754 rounding mode',
        detail: 'Always rounding a tie upward introduces a systematic bias: over a long summation the ' +
          'errors accumulate in one direction instead of cancelling. Ties-to-even removes the bias by ' +
          'choosing the neighbour with an even final mantissa bit, which is up half the time and down ' +
          'the other half. It is also the explanation for the most famous result in the language: ' +
          '0.1 and 0.2 are each stored slightly off, their exact sum lands precisely on the midpoint ' +
          'between two doubles, and the even neighbour is the one above 0.3. The lesson is that ' +
          '0.1 + 0.2 !== 0.3 is not sloppiness — it is a deterministic rule doing exactly what it says.',
        example: 'It is why 0.1 + 0.2 lands above 0.3: the exact sum is a tie, and the upper ' +
          'neighbour is the one with the even mantissa.'
      },
      {
        term: 'SameValueZero',
        plain: 'The equality Map and Set use for keys: like ===, except NaN matches NaN and +0 matches −0.',
        formal: 'SameValueZero(x, y)',
        detail: 'JavaScript has four equality relations and they disagree in exactly the corners that ' +
          'matter for a hash table. Strict === says NaN !== NaN, which would make a NaN key ' +
          'impossible to look up once stored; Object.is says +0 is not −0, which would split one ' +
          'numeric key in two. SameValueZero is the compromise the collections use: NaN matches ' +
          'itself so keys are always retrievable, and the two zeroes are one key so arithmetic that ' +
          'produces −0 does not lose your entry. Knowing which relation applies is what lets you ' +
          'predict whether a lookup will hit — includes uses it too, while indexOf still uses ===.',
        example: 'new Map([[NaN, 1]]).get(NaN) is 1, while NaN === NaN is false.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
