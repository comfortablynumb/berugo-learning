/** Reference entries for the platform sections. */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'code-engine': {
      summary: 'Learner code runs in a Web Worker behind a message protocol, with a wall-clock budget ' +
        'enforced by termination and a step budget enforced by instrumented primitives.',
      intuition: 'The platform can only make honest claims about cost if it measures something real. ' +
        'Rewriting your code to count its operations would be both fragile and a lie about what ran, ' +
        'so the harness instead hands the algorithm counted primitives and reports what passed through ' +
        'them. Anything it cannot count - a bare loop with no instrumented call - is bounded the only ' +
        'way an outside observer can bound it: a deadline and a terminate().',
      formulation: {
        equations: [
          {
            label: 'Host to backend',
            expr: "{ type: 'run', id, request: { code, entry, tests, seed, mode, opsLimit } }",
            terms: [
              { sym: 'entry', meaning: 'the function name the sandbox returns after compiling your code' },
              { sym: 'tests', meaning: 'each test serialised as source text, rebuilt inside the sandbox' },
              { sym: 'mode', meaning: "'grade' runs the tests; 'run' calls the entry once" }
            ]
          },
          {
            label: 'Backend to host',
            expr: "{ type: 'log' | 'test' | 'metric' | 'done', id, … }",
            terms: [
              { sym: 'log', meaning: 'a console line captured inside the sandbox' },
              { sym: 'done', meaning: 'the final result: ok, tests, metrics, logs, durationMs' }
            ]
          }
        ],
        derivation: [
          'A test is serialised with Function.prototype.toString and rebuilt in the sandbox, so it must ' +
            'be self-contained: it may use its two arguments and nothing else from the file it was ' +
            'written in.',
          'The inline backend runs the identical Sandbox.execute, so the two backends cannot drift; it ' +
            'is what the node unit tests use, and it reports that it enforces no timeout.'
        ]
      },
      invariants: [
        {
          name: 'Learner code never runs on the main thread when a worker is available',
          why: 'A runaway loop must not freeze the page; only a worker can be terminated.',
          breaks: 'On file:// origins, where workers cannot start - the runner falls back to inline and ' +
            'says so in result.warnings.'
        },
        {
          name: 'Every displayed number names its counter or its run count',
          why: 'A number without a unit cannot be compared or refuted.',
          breaks: 'Nowhere by design; a readout without a unit is a review failure.'
        },
        {
          name: 'The same seed produces the same run',
          why: 'Comparing two runs is only meaningful if the input did not change between them.',
          breaks: 'If a lab uses Math.random directly instead of the injected rng.'
        }
      ],
      complexity: [
        { operation: 'Worker start (first run)', average: '~5-20 ms', worst: '~50 ms', note: 'Once per session; the worker is reused' },
        { operation: 'Round trip per run', average: '< 1 ms', worst: '~5 ms', note: 'structuredClone of the request and result' },
        { operation: 'Timeout detection', average: 'timeoutMs', worst: 'timeoutMs', note: 'Watchdog on the host, then terminate()' },
        { operation: 'Instrumented op', average: 'O(1)', worst: 'O(1)', note: 'One counter increment plus a budget check' }
      ],
      failureModes: [
        {
          symptom: '"timed out" with no test results',
          cause: 'The run exceeded its wall-clock budget and the worker was terminated mid-flight.',
          fix: 'Reduce the work, or raise timeoutMs for that exercise if the cost is inherent.'
        },
        {
          symptom: 'A test fails with "… is not defined"',
          cause: 'The test closed over something in the authoring file; only its two arguments survive ' +
            'serialisation.',
          fix: 'Move the value inside the test function.'
        },
        {
          symptom: 'Two runs of an unchanged lab disagree',
          cause: 'Something in the lab used an unseeded source of randomness or the wall clock.',
          fix: 'Use the injected rng, and report timings as a median with the run count.'
        },
        {
          symptom: 'An exercise passes in the node suite and fails in the browser, or the reverse',
          cause: 'The test leaned on something only one backend has - elapsed time, a host global, or ' +
            'the inline backend\'s missing wall-clock timeout.',
          fix: 'Assert counted operations rather than milliseconds, and declare ' +
            "starterFailure: 'timeout' when the starter can only fail by running too long."
        }
      ],
      inTheWild: [
        { system: 'Browser devtools snippets', how: 'Same new Function compilation, without the isolation' },
        { system: 'CI test runners', how: 'Process-level timeout and kill, for the same reason as terminate()' },
        { system: 'Benchmark harnesses (JMH, Criterion)', how: 'Repeated runs and a reported distribution, never one sample' }
      ],
      sources: [
        { title: 'MDN — Using Web Workers', where: 'developer.mozilla.org' },
        { title: 'Statistically Rigorous Java Performance Evaluation', where: 'Georges, Buytaert, Eeckhout (OOPSLA 2007)' },
        { title: 'How NOT to Measure Latency', where: 'Gil Tene' }
      ]
    },

    'js-systems': {
      summary: 'JavaScript has the primitives systems work needs - typed arrays, DataView, 32-bit ' +
        'integer operators, BigInt - and knowing exactly where each one stops being exact is the ' +
        'prerequisite for the architecture, OS and compiler tracks.',
      intuition: 'Almost every "JavaScript cannot do systems programming" objection is really "I did ' +
        'not know about typed arrays". A buffer is bytes, a view is an interpretation, and the numeric ' +
        'tower is one float64 with two integer escape hatches: the 32-bit bitwise operators and BigInt. ' +
        'The boundaries are sharp and worth memorising, because every simulator in this platform is ' +
        'built on top of them.',
      formulation: {
        equations: [
          {
            label: 'Representable double',
            expr: 'value = (−1)^s × (1 + m / 2⁵²) × 2^(e − 1023)',
            terms: [
              { sym: 's', meaning: 'sign bit' },
              { sym: 'e', meaning: 'biased exponent, 11 bits' },
              { sym: 'm', meaning: 'mantissa, 52 bits, with an implicit leading 1 for normals' }
            ]
          },
          {
            label: 'Spacing at a magnitude',
            expr: 'ulp(x) = 2^(⌊log₂|x|⌋ − 52)',
            terms: [
              { sym: 'ulp', meaning: 'the gap to the next representable double' }
            ]
          },
          {
            label: 'Bitwise coercion',
            expr: 'a & b ≡ ToInt32(a) & ToInt32(b);  a >>> b ≡ ToUint32(a) >>> (b mod 32)',
            terms: [
              { sym: 'ToInt32', meaning: 'wrap into [−2³¹, 2³¹)' },
              { sym: 'ToUint32', meaning: 'wrap into [0, 2³²)' }
            ]
          }
        ],
        derivation: [
          'Integers are exact while |x| < 2⁵³ because the spacing is below 1 there; at 2⁵³ the spacing ' +
            'becomes 2 and consecutive integers stop being representable.',
          'Math.imul exists because a * b goes through float64 and loses the low bits precisely when ' +
            'the product exceeds 2⁵³ - which is every mixing step of a hash function.'
        ]
      },
      invariants: [
        {
          name: 'A view never copies the buffer',
          why: 'Views are interpretations of the same bytes; writing through one is visible through all.',
          breaks: 'After a transfer to a worker, when the sender\'s buffer is detached and byteLength is 0.'
        },
        {
          name: 'Bitwise operators are 32-bit',
          why: 'The spec coerces operands with ToInt32 or ToUint32 before operating.',
          breaks: 'Silently, above 2³¹: (2 ** 31) | 0 is negative, which is a real bug in hash code.'
        },
        {
          name: 'Integer arithmetic is exact below 2⁵³',
          why: 'The ulp is smaller than 1 in that range.',
          breaks: 'At and above 2⁵³, where ids and timestamps in nanoseconds live.'
        }
      ],
      complexity: [
        { operation: 'Typed array element access', average: 'O(1)', worst: 'O(1)', note: 'Bounds-checked; no boxing' },
        { operation: 'DataView get/set', average: 'O(1)', worst: 'O(1)', note: 'Slower than a typed array; buys explicit endianness' },
        { operation: 'structuredClone of n bytes', average: 'O(n)', worst: 'O(n)', note: 'Transfer is O(1) but detaches the source' },
        { operation: 'BigInt add of k limbs', average: 'O(k)', worst: 'O(k)', note: 'Not constant time - never for secrets (M23)' }
      ],
      failureModes: [
        {
          symptom: 'Large ids compare equal when they should not',
          cause: 'They exceeded 2⁵³ and were rounded to the same double.',
          fix: 'Carry the id as a string or BigInt end to end.'
        },
        {
          symptom: 'A hash function produces negative values or clusters',
          cause: 'Bitwise operators returned a signed int32, or * was used instead of Math.imul.',
          fix: 'Finish with >>> 0 and mix with Math.imul.'
        },
        {
          symptom: 'Reading a buffer after posting it to a worker yields nothing',
          cause: 'It was transferred, not copied, so the sender\'s buffer is detached.',
          fix: 'Copy before transferring, or do not transfer if the sender still needs it.'
        },
        {
          symptom: 'A float comparison is always true, or always false, depending on the data',
          cause: 'An absolute epsilon was used at a magnitude where the ulp is far larger or far ' +
            'smaller than it - 2⁻⁵² means nothing at 10⁹, where neighbours are 2⁻²³ apart.',
          fix: 'Scale the tolerance: |a − b| ≤ ε · max(|a|, |b|), or compare the bit patterns directly.'
        },
        {
          symptom: 'Deserialising a struct throws RangeError: start offset of Float64Array should be ' +
            'a multiple of 8',
          cause: 'A typed-array view was created at an offset that is not a multiple of its element ' +
            'size; views are alignment-checked, DataView is not.',
          fix: 'Read the field with DataView, or pad the layout so each field starts on its own ' +
            'alignment (M02).'
        }
      ],
      inTheWild: [
        { system: 'WebAssembly memory', how: 'Linear memory is exactly an ArrayBuffer with typed-array views' },
        { system: 'Protocol parsers', how: 'DataView with an explicit littleEndian flag per field' },
        { system: 'V8 Smis', how: 'Small integers are unboxed; leaving that range changes representation' }
      ],
      sources: [
        { title: 'What Every Computer Scientist Should Know About Floating-Point Arithmetic', where: 'Goldberg, 1991' },
        { title: 'ECMA-262 — ToInt32, ToUint32, Math.imul', where: 'tc39.es/ecma262' },
        { title: 'MDN — ArrayBuffer, DataView, Atomics', where: 'developer.mozilla.org' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
