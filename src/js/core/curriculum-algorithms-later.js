/**
 * The algorithms track, second half: M17 onward.
 *
 * Track data only - no API, and no track object either. `curriculum-algorithms.js`
 * splices these groups onto the end of the algorithms track it declares, so the
 * syllabus stays one ordered list while the file stays under a thousand lines.
 * The seam is at a milestone boundary rather than mid-track, so nothing but the
 * line count moves when the next milestone lands.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CurriculumAlgorithmsLater = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  return [
    {
      id: 'M17',
      title: 'Numbers, bits and floating point',
      summary: 'The representation layer every other track silently assumes, turned into measurements.',
      sections: [
        {
          id: 'integer-representation',
          title: 'Integer representation',
          summary: 'Carry and overflow are different flags, and which one was the bug is decided by the types in your source rather than by the hardware.',
          tags: ['twos complement', 'carry', 'overflow', 'sign extension', 'saturating', 'wrapping', 'trapping', 'endianness', 'int32 coercion', 'int min']
        },
        {
          id: 'bit-manipulation',
          title: 'The bit-manipulation toolkit',
          summary: 'The showpiece bit-scan trick does more work than the loop it replaces on random data, and nine times less in the worst case.',
          tags: ['popcount', 'swar', 'de bruijn', 'count trailing zeros', 'count leading zeros', 'gray code', 'bit reversal', 'branchless', 'bit fields', 'hackers delight']
        },
        {
          id: 'bitsets-and-swar',
          title: 'Bitsets and SWAR algorithms',
          summary: 'A bitset is not compact, it is compact above a density, and the crossing is far sparser than anybody guesses.',
          tags: ['bitset', 'bitboard', 'word parallelism', 'density', 'set operations', 'sieve', 'typed arrays', 'cache', 'iteration', 'chess']
        },
        {
          id: 'ieee-754',
          title: 'IEEE 754',
          summary: 'A double is not an approximation of a real number, it is a specific rational one, and the demo prints all fifty-five digits of it.',
          tags: ['ieee 754', 'binary64', 'mantissa', 'exponent bias', 'subnormal', 'nan', 'signed zero', 'ulp', 'machine epsilon', 'spacing', 'max safe integer']
        },
        {
          id: 'floating-point-hazards',
          title: 'Floating-point hazards',
          summary: 'Four orderings of one array give four different totals, and none of them is the bug.',
          tags: ['cancellation', 'absorption', 'non associativity', 'kahan', 'neumaier', 'pairwise summation', 'welford', 'variance', 'quadratic formula', 'error accumulation']
        },
        {
          id: 'fixed-and-decimal',
          title: 'Fixed point, decimal and rational arithmetic',
          summary: 'A million transactions summed as doubles are out by a ten-thousandth of a cent; applying a tax rate loses ten dollars.',
          tags: ['fixed point', 'decimal', 'integer cents', 'rational', 'bankers rounding', 'half even', 'rounding policy', 'money', 'scaled integer', 'gcd growth']
        },
        {
          id: 'arbitrary-precision',
          title: 'Arbitrary-precision arithmetic',
          summary: 'Karatsuba crosses over at three different sizes depending on which column you count, and wall clock is not one of them.',
          tags: ['bignum', 'limbs', 'karatsuba', 'schoolbook', 'knuth algorithm d', 'add back', 'montgomery', 'modpow', 'bigint', 'crossover']
        },
        {
          id: 'modular-arithmetic',
          title: 'Modular arithmetic and number theory',
          summary: 'On a Carmichael number the Fermat test is not probabilistic, it is wrong for every base, and Miller-Rabin below 2 to the 64 is not probabilistic either.',
          tags: ['modular arithmetic', 'extended euclid', 'modular inverse', 'chinese remainder', 'miller rabin', 'carmichael', 'fermat test', 'pollard rho', 'sieve', 'linear sieve']
        },
        {
          id: 'random-generation',
          title: 'Random number generation',
          summary: 'Every generator here passes a histogram, RANDU included, and one of them satisfies a linear identity exactly on every triple it emits.',
          tags: ['prng', 'lcg', 'randu', 'xorshift', 'pcg', 'splitmix', 'mersenne twister', 'modulo bias', 'rejection sampling', 'fisher yates', 'chi squared']
        },
        {
          id: 'integer-algorithms',
          title: 'Integer algorithms in practice',
          summary: 'The columns that make an identifier cheap to index are exactly the columns that make it informative to a stranger.',
          tags: ['uuid', 'ulid', 'snowflake', 'sequential ids', 'index locality', 'buffer pool', 'clock regression', 'monotonic', 'bit packing', 'information leakage']
        }]
    },

    {
      id: 'M18',
      title: 'Numerical methods, transforms and optimisation',
      summary: 'Error and conditioning tracked at every step, so "the algorithm is wrong" can be told apart from "the problem is ill-conditioned".',
      sections: [
        {
          id: 'conditioning-and-error',
          title: 'Conditioning, stability and error',
          summary: 'The residual sits at machine precision across nine orders of conditioning while the answer loses every correct digit, and nothing warns the caller.',
          tags: ['condition number', 'forward error', 'backward error', 'residual', 'stability', 'hilbert matrix', 'digits lost', 'machine epsilon', 'relative error', 'error bound']
        },
        {
          id: 'root-finding',
          title: 'Root finding',
          summary: 'Newton converges to a genuine root from nine starting points and it is the wrong one from three of them, with no error raised.',
          tags: ['bisection', 'newton', 'secant', 'brent', 'false position', 'fixed point', 'convergence order', 'basin of attraction', 'bracketing', 'contraction']
        },
        {
          id: 'linear-systems',
          title: 'Linear systems',
          summary: 'A pivot of 1e-18 is small and never zero, so no check fires and the answer comes back wrong in its first component by 100 percent.',
          tags: ['gaussian elimination', 'partial pivoting', 'growth factor', 'lu decomposition', 'cholesky', 'jacobi', 'gauss seidel', 'sor', 'conjugate gradient', 'preconditioning', 'never invert']
        },
        {
          id: 'least-squares',
          title: 'Least squares, QR and the SVD',
          summary: 'Forming A-transpose-A squares the condition number exactly, which is half your digits gone before any solving happens.',
          tags: ['normal equations', 'qr', 'gram schmidt', 'householder', 'svd', 'pseudo inverse', 'eckart young', 'low rank', 'numerical rank', 'ridge', 'vandermonde']
        },
        {
          id: 'eigenvalues',
          title: 'Eigenvalues and the QR algorithm',
          summary: 'The Wilkinson polynomial has roots at 1 through 20 and a fifteenth-digit nudge to one coefficient moves one of them by most of a whole unit.',
          tags: ['power iteration', 'spectral gap', 'shifted inverse', 'qr algorithm', 'hessenberg', 'characteristic polynomial', 'wilkinson polynomial', 'similarity transformation', 'eigenvector', 'krylov']
        },
        {
          id: 'interpolation',
          title: 'Interpolation and approximation',
          summary: 'Five times the data makes the polynomial fit six hundred times worse, and moving the same nodes to the Chebyshev positions fixes it.',
          tags: ['runge phenomenon', 'chebyshev nodes', 'lagrange', 'barycentric', 'cubic spline', 'monotone interpolation', 'overshoot', 'bezier', 'de casteljau', 'knots']
        },
        {
          id: 'differentiation-and-autodiff',
          title: 'Differentiation, integration and autodiff',
          summary: 'The best a forward difference can ever do is eight correct digits out of sixteen, and no step size gets under that floor.',
          tags: ['finite difference', 'step size', 'truncation error', 'richardson', 'complex step', 'trapezoid', 'simpson', 'gauss legendre', 'adaptive quadrature', 'forward mode', 'reverse mode', 'tape', 'adjoint']
        },
        {
          id: 'differential-equations',
          title: 'Differential equations and simulation',
          summary: 'Over 200 000 steps the fourth-order method loses energy monotonically and the second-order one does not, which is why games use the second-order one.',
          tags: ['euler', 'midpoint', 'rk4', 'verlet', 'symplectic', 'energy drift', 'convergence order', 'stiffness', 'stability limit', 'implicit euler', 'leapfrog']
        },
        {
          id: 'fourier-transforms',
          title: 'Fourier transforms and signal processing',
          summary: 'A pure tone smeared across the whole spectrum is not a resolution problem, and 1100 Hz sampled at 1 kHz is indistinguishable from 100 Hz forever after.',
          tags: ['dft', 'fft', 'butterfly', 'bit reversal', 'twiddle factor', 'windowing', 'spectral leakage', 'hann', 'blackman', 'aliasing', 'nyquist', 'convolution theorem', 'ntt']
        },
        {
          id: 'optimisation',
          title: 'Optimisation',
          summary: 'Gradient descent goes from two iterations to nine thousand as the conditioning worsens, and Newton takes two at every point on that range.',
          tags: ['convexity', 'gradient descent', 'step size', 'stability limit', 'momentum', 'line search', 'armijo', 'bfgs', 'newton method', 'coordinate descent', 'affine invariance', 'conditioning']
        }]
    },

    {
      id: 'M19',
      title: 'Randomised and approximation algorithms',
      summary: 'Two ways past a problem you cannot solve exactly and quickly - flip coins, or settle for provably close - and the guarantee is the content in both.',
      sections: [
        {
          id: 'randomised-design',
          title: 'Randomised algorithm design',
          summary: 'The smallest Carmichael number fools the Fermat test on 57 percent of bases and Miller-Rabin on 1.43 percent, and only one of those amplifies to anything usable.',
          tags: ['monte carlo', 'las vegas', 'one sided error', 'amplification', 'miller rabin', 'carmichael', 'geometric distribution', 'expectation', 'concentration', 'random input']
        },
        {
          id: 'random-contraction',
          title: 'Random contraction and Karger min cut',
          summary: 'A cycle on twelve vertices has exactly sixty-six minimum cuts, contraction finds every one of them, and each turns up at the bound to within a percent.',
          tags: ['karger', 'contraction', 'min cut', 'supernode', 'repetition', 'karger stein', 'success probability', 'counting bound', 'cycle graph', 'brute force oracle']
        },
        {
          id: 'monte-carlo-estimation',
          title: 'Monte Carlo estimation and variance reduction',
          summary: 'A grid beats sampling by nine orders of magnitude in one dimension and loses from six onwards, at the identical point budget.',
          tags: ['sampling', 'confidence interval', 'antithetic', 'control variate', 'stratified', 'importance sampling', 'quasi monte carlo', 'van der corput', 'discrepancy', 'dimension independence']
        },
        {
          id: 'markov-chain-monte-carlo',
          title: 'Markov chain Monte Carlo',
          summary: 'A chain accepting 93 percent of its proposals is the worst one in the table, and it reports an answer two hundred and fifty of its own standard errors from the truth.',
          tags: ['metropolis hastings', 'detailed balance', 'gibbs', 'burn in', 'autocorrelation', 'effective sample size', 'mixing time', 'proposal width', 'gelman rubin', 'multimodal']
        },
        {
          id: 'fingerprinting',
          title: 'Fingerprinting and identity testing',
          summary: 'Checking a claimed matrix product costs a tenth of computing it, catches a single wrong entry half the time per round, and never once raises a false alarm.',
          tags: ['freivalds', 'schwartz zippel', 'polynomial identity', 'one sided error', 'fingerprint', 'rolling hash', 'merkle tree', 'verification', 'finite field', 'trust but verify']
        },
        {
          id: 'approximation-ratios',
          title: 'Approximation algorithms and ratios',
          summary: 'The algorithm with a proven factor of two averages 1.52 and the one with no bound at all averages 1.03, and both facts matter.',
          tags: ['approximation ratio', 'vertex cover', 'maximal matching', 'set cover', 'harmonic bound', 'metric tsp', 'christofides', 'k centre', 'list scheduling', 'tight instance']
        },
        {
          id: 'lp-relaxation',
          title: 'LP relaxation and rounding',
          summary: 'Every basic solution of the vertex-cover relaxation came back with each coordinate at zero, one half or one, over a hundred and fifty instances.',
          tags: ['integer program', 'linear relaxation', 'simplex', 'half integral', 'integrality gap', 'randomised rounding', 'max sat', 'primal dual', 'duality', 'lower bound']
        },
        {
          id: 'approximation-schemes',
          title: 'PTAS, FPTAS and the limits of approximation',
          summary: 'Asked for half the optimum the scheme returns 99.6 percent of it from a table twenty-six times smaller, and asked for 99 percent it costs twice the exact algorithm.',
          tags: ['ptas', 'fptas', 'profit scaling', 'pseudo polynomial', 'knapsack', 'epsilon', 'apx hard', 'pcp theorem', 'hardness of approximation', 'greedy trap']
        },
        {
          id: 'derandomisation',
          title: 'Derandomisation',
          summary: 'Half of five hundred random assignments fall below the bound they satisfy in expectation, and thirty-two carefully chosen ones cannot.',
          tags: ['conditional expectations', 'probabilistic method', 'max cut', 'pairwise independence', 'small sample space', 'k wise independent', 'parity', 'max sat', 'deterministic', 'reproducibility']
        }]
    },
    {
      id: 'M20',
      title: 'NP-completeness, reductions and metaheuristics',
      summary: 'How to recognise a hard problem, prove it hard, and then ship something anyway - with the certificate, the round trip and the budget all measured.',
      sections: [
        {
          id: 'decision-problems',
          title: 'Decision problems, P, NP and certificates',
          summary: 'Checking a Hamiltonian certificate costs thirty steps at every size; proving there is none costs twenty-eight thousand.',
          tags: ['decision problem', 'certificate', 'verifier', 'p vs np', 'co np', 'np hard', 'np complete', 'proof of work', 'easy to check', 'search versus verify']
        },
        {
          id: 'reductions',
          title: 'Reductions',
          summary: 'Forward, solve, backward — and the fourth step nobody writes, which is the only one that catches a gadget of the wrong shape.',
          tags: ['many one reduction', 'gadget', 'clause triangle', 'independent set', 'clique', 'set cover', 'partition', 'turing reduction', 'round trip', 'direction of the arrow']
        },
        {
          id: 'sat-zoo',
          title: 'SAT and the NP-complete zoo',
          summary: 'A Horn formula of forty-two variables never branches at all, and a pigeonhole formula of the same size branches exactly two times six factorial minus one.',
          tags: ['cook levin', '3 sat', 'karp chain', 'horn sat', '2 sat', 'xor sat', 'pigeonhole', 'schaefer dichotomy', 'unit propagation', 'dependency resolution']
        },
        {
          id: 'beyond-np',
          title: 'Beyond NP',
          summary: 'The same clauses under five prefixes: a SAT solver calls every one satisfiable and three of the five sentences are false.',
          tags: ['pspace', 'qbf', 'quantifier alternation', 'two player game', 'polynomial hierarchy', 'sigma two', 'counting class', 'exptime', 'strategy', 'certificate size']
        },
        {
          id: 'parameterised-algorithms',
          title: 'Exact exponential and parameterised algorithms',
          summary: 'Edge branching measures a base of 2.0030, degree branching measures 1.4991, and kernelisation makes a graph fourteen times bigger shrink to the same fourteen edges.',
          tags: ['fixed parameter tractable', 'branch and reduce', 'branching factor', 'kernelisation', 'buss kernel', 'vertex cover', 'treewidth', 'tree decomposition', 'w hierarchy', 'safe reduction rule']
        },
        {
          id: 'metaheuristics',
          title: 'Heuristics and metaheuristics',
          summary: 'Eight methods, one budget, and plain 2-opt reaches the best tour in the table using six per cent of it.',
          tags: ['local search', 'two opt', 'or opt', 'simulated annealing', 'tabu search', 'genetic algorithm', 'ant colony', 'grasp', 'evaluation budget', 'best so far curve']
        },
        {
          id: 'using-solvers',
          title: 'Using solvers instead of algorithms',
          summary: 'Six unit clauses take the search from one thousand four hundred and thirty-nine nodes to one.',
          tags: ['encoding', 'at most one', 'pairwise', 'commander', 'sequential counter', 'symmetry breaking', 'cardinality constraint', 'model then solve', 'clause count', 'dpll statistics']
        },
        {
          id: 'hardness-in-practice',
          title: 'Hardness in practice',
          summary: 'The hardness peak is measured rather than quoted, and the shortest restart cutoff in the table makes the mean four times worse than no restarts at all.',
          tags: ['phase transition', 'clause ratio', 'typical case', 'heavy tailed runtime', 'restarts', 'cutoff', 'walksat', 'backdoor', 'industrial instances', 'median not mean']
        },
        {
          id: 'reduction-workshop',
          title: 'Reduction workshop',
          summary: 'A roster that satisfies every hard constraint and gives one nurse five shifts and another two, because fairness is an objective and a clause cannot carry one.',
          tags: ['modelling', 'nurse rostering', 'validation', 'soft constraint', 'hard constraint', 'infeasibility', 'unsat versus timeout', 'formulation catalogue', 'assumptions', 'ship the validator']
        }]
    },
    {
      id: 'M21',
      title: 'Online, external-memory and cache-oblivious algorithms',
      summary: 'Cost models other than the RAM model - what changes when the future is unknown, the data does not fit, or the cache is real.',
      sections: [
        {
          id: 'competitive-analysis',
          title: 'Online algorithms and competitive analysis',
          summary: 'Rent until you have spent what buying costs and you never pay more than 2 - 1/B times the best decision hindsight could make, at every purchase price, exactly.',
          tags: ['online algorithm', 'competitive ratio', 'ski rental', 'adversary model', 'oblivious', 'adaptive', 'randomised strategy', 'list update', 'move to front', 'offline optimum']
        },
        {
          id: 'page-replacement',
          title: 'Caching and page-replacement policies',
          summary: 'A loop one entry larger than the cache takes LRU, FIFO and CLOCK to zero hits while the offline optimum gets four in five.',
          tags: ['belady', 'lru', 'lfu', 'clock', 'arc', 'two queue', 'w tinylfu', 'scan resistance', 'working set curve', 'admission policy']
        },
        {
          id: 'online-scheduling',
          title: 'Online scheduling and load balancing',
          summary: 'Sampling two machines instead of one is a one-line change and it takes the maximum load from climbing with n to nearly flat.',
          tags: ['list scheduling', 'graham bound', 'lpt', 'power of two choices', 'balls in bins', 'consistent hashing', 'virtual nodes', 'makespan', 'load balancing', 'tail load']
        },
        {
          id: 'bin-packing',
          title: 'Bin packing and resource allocation',
          summary: 'The same jobs packed on one axis and on two: the offline advantage disappears with the second axis, and the bins full on one axis only are what a cluster reports as spare.',
          tags: ['first fit', 'best fit', 'next fit', 'first fit decreasing', 'fragmentation', 'two dimensional packing', 'vm placement', 'cluster scheduling', 'stranded capacity', 'lower bound']
        },
        {
          id: 'external-memory',
          title: 'The external-memory model',
          summary: 'External merge sort matches its closed form to four decimal places at every memory and block size, and the peak held equals the budget exactly.',
          tags: ['dam model', 'block transfers', 'external merge sort', 'scan bound', 'sorting bound', 'b tree', 'fan out', 'sort merge join', 'nested loop join', 'query planner']
        },
        {
          id: 'cache-oblivious',
          title: 'Cache-oblivious algorithms',
          summary: 'The best tile changes four times across four cache sizes; the recursive version has no tile at all and stays within a third of the retuned reference everywhere.',
          tags: ['cache oblivious', 'recursive subdivision', 'van emde boas layout', 'matrix transpose', 'matrix multiplication', 'tiling', 'tall cache', 'tuned versus portable', 'implicit blocking', 'layout']
        },
        {
          id: 'streaming-model',
          title: 'The streaming model',
          summary: 'An exact distinct count dies four hundred items into a stream of two hundred thousand; a sketch answers to a per cent in sixteen bytes.',
          tags: ['one pass', 'sublinear space', 'hyperloglog', 'quantile sketch', 'rank error', 'space budget', 'impossibility', 'two passes', 'turnstile', 'cash register']
        },
        {
          id: 'work-and-span',
          title: 'Parallel models and work-span analysis',
          summary: 'The measured schedule stops shortening at seventeen steps and the processor count keeps rising: the span is a floor no hardware moves.',
          tags: ['work and span', 'brent theorem', 'prefix scan', 'blelloch', 'hillis steele', 'work efficiency', 'greedy schedule', 'amdahl', 'gustafson', 'utilisation']
        },
        {
          id: 'choosing-a-cost-model',
          title: 'Choosing a cost model',
          summary: 'Four predictions of one sort, four orders of magnitude apart, all of them correct arithmetic and at most one of them about the runtime.',
          tags: ['cost model', 'ram model', 'cache aware', 'external memory', 'parallel model', 'binding resource', 'bytes fetched', 'access pattern', 'model validation', 'measure first']
        }]
    },
    {
      id: 'M22',
      title: 'Compression, information theory and error correction',
      summary: 'Why data compresses at all, every major family measured on one set of corpora, and the coding theory that keeps bits intact.',
      sections: [
        {
          id: 'information-and-entropy',
          title: 'Information and entropy',
          summary: 'There is no single entropy of a file - there is one number per model, and a compression ratio without one is a claim with no denominator.',
          tags: ['entropy', 'shannon', 'source coding theorem', 'conditional entropy', 'cross entropy', 'kl divergence', 'mutual information', 'order-k model', 'estimator bias', 'incompressible']
        },
        {
          id: 'prefix-codes-and-huffman',
          title: 'Prefix codes and Huffman coding',
          summary: 'Optimal among codes that spend whole bits - which on a 99/1 source means spending twelve times the entropy and being unable to do better.',
          tags: ['prefix code', 'kraft inequality', 'huffman', 'canonical huffman', 'code lengths', 'adaptive huffman', 'table transmission', 'whole bit penalty', 'greedy merge', 'optimality']
        },
        {
          id: 'arithmetic-coding-and-ans',
          title: 'Arithmetic coding and ANS',
          summary: 'The whole message as one number: an overhead of about one bit per message rather than one bit per symbol, and the counter that is fatal to omit.',
          tags: ['arithmetic coding', 'interval subdivision', 'renormalisation', 'underflow', 'adaptive model', 'range coder', 'rans', 'tans', 'fractional bits', 'state machine']
        },
        {
          id: 'dictionary-compression',
          title: 'Dictionary compression: LZ77 and friends',
          summary: 'Level nine is not a different algorithm - it is the same one walking more of the hash chain, at eleven times the work for a fifth better ratio.',
          tags: ['lz77', 'lzss', 'sliding window', 'hash chains', 'match finding', 'lazy matching', 'search depth', 'lz78', 'lzw', 'compression level']
        },
        {
          id: 'general-purpose-codecs',
          title: 'Real-world general-purpose codecs',
          summary: 'Six codecs on six corpora and the ranking changes on every one - which is why a benchmark with a single corpus produces a winner and no information.',
          tags: ['deflate', 'gzip', 'zlib', 'zstd', 'brotli', 'block types', 'stored block', 'pareto frontier', 'decode speed', 'round trip']
        },
        {
          id: 'context-modelling',
          title: 'Context modelling and prediction',
          summary: 'A plain order-k model gets worse after order two and PPM keeps improving: same input, same orders, and the only difference is what happens on a miss.',
          tags: ['context model', 'order-k', 'ppm', 'escape', 'exclusion', 'context mixing', 'paq', 'sparsity', 'cross entropy', 'compression as prediction']
        },
        {
          id: 'transform-compression',
          title: 'Transform-based compression: BWT and friends',
          summary: 'The transform outputs exactly the entropy of its input to four decimal places, and the stage after it halves the file.',
          tags: ['burrows wheeler', 'permutation', 'move to front', 'run length', 'bzip2', 'block size', 'lf mapping', 'preprocessing', 'weak model', 'reversible']
        },
        {
          id: 'lossy-compression',
          title: 'Lossy compression and the rate-distortion trade',
          summary: 'Re-saving at the same quality on the same grid costs nothing after one round; shift the grid three pixels and the damage never stops.',
          tags: ['rate distortion', 'quantisation', 'dct', 'jpeg', 'energy compaction', 'psnr', 'ssim', 'generation loss', 'perceptual model', 'quality factor']
        },
        {
          id: 'domain-specific-compression',
          title: 'Domain-specific compression',
          summary: 'Sorting the column is worth more than the encoding choice, and a metric held at full double precision throws away nine tenths of its own compressibility.',
          tags: ['delta coding', 'zigzag', 'varint', 'bit packing', 'frame of reference', 'simple-8b', 'dictionary encoding', 'run length', 'gorilla', 'columnar']
        },
        {
          id: 'checksums-and-crc',
          title: 'Error detection: checksums and CRC',
          summary: 'A byte sum catches every single-bit flip and no byte swap at all, and four appended bytes make any CRC come out to any value you choose.',
          tags: ['checksum', 'parity', 'internet checksum', 'fletcher', 'adler-32', 'crc', 'polynomial division', 'burst errors', 'detection guarantee', 'not integrity']
        },
        {
          id: 'error-correction',
          title: 'Error correction: Hamming, Reed-Solomon and erasure coding',
          summary: 'The same parity repairs twice as many erasures as errors, and an erasure code buys 3x durability at 1.5x storage by reading k fragments to rebuild one.',
          tags: ['hamming code', 'syndrome', 'secded', 'ecc memory', 'reed solomon', 'finite field', 'erasure coding', 'replication', 'read amplification', 'correction limit']
        }]
    },
    {
      id: 'M23',
      title: 'Applied cryptography and constant-time programming',
      summary: 'Cryptography as an engineer uses it: which primitive answers which requirement, and the specific ways real deployments break.',
      sections: [
        {
          id: 'threat-models-and-primitives',
          title: 'Threat models and primitive selection',
          summary: 'Six published test vectors checked at render time, and a map from requirement to primitive where every path ends at an audited library call.',
          tags: ['threat model', 'kerckhoffs', 'confidentiality', 'integrity', 'authenticity', 'non-repudiation', 'security parameter', 'primitive selection', 'test vectors', 'do not roll your own']
        },
        {
          id: 'randomness-for-cryptography',
          title: 'Randomness for cryptography',
          summary: 'One observed output recovers the whole state of a statistical generator and predicts its next values exactly, while that same output measures 7.9553 bits of entropy per byte.',
          tags: ['csprng', 'statistical prng', 'entropy pool', 'lcg state recovery', 'dev urandom', 'getrandom', 'fork safety', 'boot entropy', 'duplicate keys', 'silent failure']
        },
        {
          id: 'hash-functions-and-macs',
          title: 'Hash functions and MACs',
          summary: 'A tag for hash(secret + message) is forged live without the secret, the same attack fails against HMAC, and the birthday bound is computed rather than quoted.',
          tags: ['preimage', 'second preimage', 'collision', 'birthday bound', 'merkle damgard', 'length extension', 'sponge', 'sha-3', 'hmac', 'keyed hashing']
        },
        {
          id: 'password-hashing',
          title: 'Password hashing and key derivation',
          summary: 'PBKDF2 is tuned to a 250 ms budget in this browser, and raising the memory parameter from 4 MiB to 512 MiB divides the attacker rate by 128 at no cost to the defender.',
          tags: ['password hashing', 'salt', 'pepper', 'bcrypt', 'scrypt', 'argon2', 'pbkdf2', 'memory hardness', 'cost tuning', 'rehash on login']
        },
        {
          id: 'symmetric-encryption',
          title: 'Symmetric encryption and block cipher modes',
          summary: 'The ECB picture keeps its shape at 26 distinct blocks out of 144, a padding oracle decrypts a CBC message in 2 749 yes-or-no questions, and five edited bytes rewrite a CTR plaintext.',
          tags: ['block cipher', 'aes', 'key schedule', 'ecb', 'cbc', 'ctr', 'padding oracle', 'bit flipping', 'malleability', 'chacha20']
        },
        {
          id: 'authenticated-encryption',
          title: 'Authenticated encryption',
          summary: 'One repeated nonce hands over the second plaintext in full and then a forged tag that AES-GCM accepts, and the birthday bound puts a message ceiling on random 96-bit nonces.',
          tags: ['aead', 'aes-gcm', 'ghash', 'chacha20-poly1305', 'encrypt then mac', 'nonce reuse', 'associated data', 'misuse resistance', 'gcm-siv', 'tag forgery']
        },
        {
          id: 'public-key-cryptography',
          title: 'Public-key cryptography',
          summary: 'The same eavesdropper breaks Diffie-Hellman in 872 steps at 13 bits and gives up at 31, and one chosen-ciphertext query recovers a textbook RSA plaintext.',
          tags: ['rsa', 'factoring', 'oaep', 'malleability', 'diffie hellman', 'discrete log', 'elliptic curve', 'scalar multiplication', 'ecdh', 'key sizes']
        },
        {
          id: 'signatures-and-pki',
          title: 'Signatures, certificates and PKI',
          summary: 'Two ECDSA signatures that share a nonce give up the private key in four modular operations, and a real validator runs nine checks over five chains broken one way each.',
          tags: ['ecdsa', 'nonce reuse', 'rfc 6979', 'eddsa', 'certificate chain', 'basic constraints', 'name matching', 'revocation', 'ocsp', 'certificate transparency']
        },
        {
          id: 'protocol-construction',
          title: 'Protocol construction',
          summary: 'Steal a session state at message 3 and the double ratchet keeps every earlier message closed and reopens the conversation at message 6, with both numbers measured rather than claimed.',
          tags: ['protocol', 'key agreement', 'authentication', 'forward secrecy', 'post-compromise security', 'double ratchet', 'replay protection', 'downgrade attack', 'tls 1.3', 'transcript binding']
        },
        {
          id: 'constant-time-programming',
          title: 'Constant-time programming and side channels',
          summary: 'An early-exit comparison gives up a 4-byte token in 1 024 guesses instead of 4.3 billion, separating right from wrong bytes by 4.5 deviations; the masked version separates them by 0.088.',
          tags: ['timing attack', 'constant time', 'bit mask', 'branchless select', 'cache timing', 'table lookup', 'blinding', 'compiler reintroduction', 'side channel', 'measurement']
        },
        {
          id: 'applied-constructions',
          title: 'Applied constructions',
          summary: 'Every 3-subset of five Shamir shares reconstructs the secret exactly and two shares leave every candidate consistent, while one entry in a billion is proved with 30 hashes and 960 bytes.',
          tags: ['shamir secret sharing', 'lagrange interpolation', 'information theoretic', 'commitment', 'merkle tree', 'inclusion proof', 'hash chain', 'verifiable random function', 'zero knowledge', 'post-quantum hybrid']
        }]
    }
  ];
}));
