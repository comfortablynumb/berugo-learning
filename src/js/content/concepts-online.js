/** Concepts for competitive analysis, page replacement and online scheduling (M21.1-M21.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'competitive-analysis': [
      {
        term: 'The competitive ratio is a maximum, not an average',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["an adversary picks the<br/>worst input it can"] --> B["your cost, against the cost of<br/>someone who knew the future"]',
            '    B --> C["the ratio on THAT input"]',
            '    C --> D["c-competitive means no input<br/>pushes it past c"]',
            '    D --> E["a typical case that is far better<br/>changes the number not at all"]'
          ].join('\n'),
          caption: 'It is a worst-case promise, so a good average is not evidence for it and a good benchmark is not evidence against it.'
        },
        plain: 'An algorithm is c-competitive when no input pushes it past c times the offline optimum.',
        formal: 'ALG is c-competitive when ALG(σ) ≤ c·OPT(σ) + b for every request sequence σ and some constant b',
        readAs: 'The algorithm costs at most c times the offline optimum plus a constant, on ' +
          'every request sequence rather than on average over them.',
        detail: [
          'The quantifier is the whole content. A mean ratio over inputs nobody chose says nothing ' +
            'about the input an adversary would choose.',
          'The demo shows the gap directly. "Buy immediately" has a better MEAN ratio than the ' +
            'break-even rule, and a worst case ten times worse.',
          'The additive constant matters too. It is why a bound can look violated on a small ' +
            'instance and hold in the limit, which is exactly what happens to first-fit in the ' +
            'bin-packing section.'
        ],
        example: 'The demo sweeps every season length and reports the maximum. That is 1.9000 for ' +
          'the break-even rule, against a mean of 1.6300.'
      },
      {
        term: 'Ski rental is the whole problem in two lines',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["rent for 1 a day,<br/>or buy once for B"] --> B{"how long is the season?"}',
            '    B -->|"you knew: short"| C["rent throughout"]',
            '    B -->|"you knew: long"| D["buy on day one"]',
            '    B -->|"you do not know"| E["rent until you have spent B,<br/>then buy"]',
            '    E --> F["never worse than twice<br/>the cost of knowing"]'
          ].join('\n'),
          caption: 'Every online problem in this milestone is this one wearing a different hat: commit early and risk waste, or commit late and risk paying twice.'
        },
        plain: 'Rent at 1 a day or buy once for B, and the season ends when the adversary says.',
        formal: 'OPT = min(days, B); renting until day B and then buying costs at most (B − 1) + B',
        detail: [
          'Every "keep it warm or tear it down" decision is this problem. Keep a connection open or ' +
            'reconnect, keep a cache hot or refill it, keep a VM running or reboot it.',
          'The structure is always the same: a recurring cost against a one-off one, with an unknown ' +
            'horizon.',
          'Recognising it means the answer is known rather than guessed.'
        ],
        example: 'At a purchase price of 10 the demo measures the break-even rule at 1.9000, with ' +
          'the worst case falling exactly on day 10.'
      },
      {
        term: 'Break-even is optimal among deterministic rules, and 2 − 1/B is tight',
        plain: 'Rent until you have spent what buying costs, then buy.',
        formal: 'the worst case is the season ending on the purchase day: (B − 1 + B)/B = 2 − 1/B',
        readAs: 'The worst ratio is B minus one plus B, all over B, which is two minus one over B.',
        detail: [
          'The lower bound meets the upper bound, so the problem is closed. For any deterministic ' +
            'rule the adversary knows the buy day and ends the season there, so no rule does better.',
          'That is worth knowing before spending a week on a cleverer heuristic.',
          'The demo attains the bound at every purchase price rather than approaching it, which is ' +
            'what "tight" means.'
        ],
        example: 'At purchase prices of 2, 4, 10, 25 and 100 the demo measures 1.5000, 1.7500, ' +
          '1.9000, 1.9600 and 1.9900. That is 2 − 1/B in every row.'
      },
      {
        term: 'Randomisation helps against an oblivious adversary and not an adaptive one',
        plain: 'A coin the opponent cannot see is worth something; one they watch is not.',
        formal: 'buying on day i with probability proportional to ((B − 1)/B)^(B − i) gives e/(e − 1) ≈ 1.582 against an oblivious adversary',
        readAs: 'Buy on day i with probability proportional to B minus one over B, raised to the ' +
          'power B minus i, and the expected ratio is e over e minus one.',
        detail: [
          'An oblivious adversary fixes the whole input before the algorithm runs. An adaptive one ' +
            'chooses each request after seeing what the algorithm just did.',
          'Against the second, a randomised strategy is no better than the best deterministic one ' +
            'and usually worse. The opponent simply ends the season the day the coin says to buy.',
          'Which adversary you face is a modelling claim about your own system, and it is the claim ' +
            'that decides whether randomisation is an improvement.'
        ],
        example: 'The demo measures 1.5625 against the oblivious adversary and 3.1428 against the ' +
          'adaptive one. The deterministic rule is 1.9000.'
      },
      {
        term: 'The offline optimum is the denominator, and sometimes it is NP-hard',
        plain: 'A ratio needs something to be a ratio to, and it should be the real optimum.',
        formal: 'optimal offline list update with free moves is NP-hard, so the reference here is the best STATIC order',
        detail: [
          'Where the exact optimum is cheap, as in ski rental and small scheduling instances, the ' +
            'demo computes it.',
          'Where it is not, it uses an explicit lower bound or a named weaker reference, and says ' +
            'which.',
          'That distinction is not pedantry. A ratio against a lower bound is an over-estimate of ' +
            'the true ratio, so an algorithm scored that way looks worse than it is. A bound ' +
            'checked that way always looks satisfied.'
        ],
        example: 'The list-update table is scored against the best static order and labelled as ' +
          'such, because the true offline optimum for that problem is NP-hard.'
      },
      {
        term: 'Move-to-front is 2-competitive and pays one move per access for it',
        plain: 'Put every accessed item at the front, and the cost is at most twice the best reordering.',
        formal: 'the potential-function proof: MTF(σ) ≤ 2·OPT(σ) − |σ|, with the potential being the number of inversions',
        readAs: 'Move-to-front costs at most twice the offline optimum minus the number of ' +
          'requests, proved by counting inversions between the two lists.',
        detail: [
          'The proof is the classic amortised argument, and it is worth knowing because of the ' +
            'potential it uses.',
          'That potential is the number of inversions between the algorithm’s list and the ' +
            'optimum’s, and it is the same device that prices splay trees and union-find.',
          'The practical content is different. The guarantee holds always, and whether the policy is ' +
            'worth its moves depends entirely on whether the distribution changes.'
        ],
        example: 'On the demo’s reverse sweep, built to defeat it, move-to-front measures 1.8964 ' +
          'against the best static order. That is the bound being approached.'
      },
      {
        term: 'An online policy can beat the best static offline order',
        plain: 'Because a static order cannot follow a working set that moves.',
        formal: 'on a bursty trace, MTF costs 0.31× the best static order — the reference is offline and still worse',
        detail: [
          'This is the result that makes the whole comparison interesting rather than a ranking.',
          '"Offline" means knowing the whole sequence in advance, and it does not mean unbeatable. A ' +
            'static order chosen with perfect knowledge is still one order, and a sequence whose ' +
            'hot set moves has no single best order.',
          'Adaptation is a purchase, and the thing it buys is exactly this.'
        ],
        example: 'On the demo’s bursty family the ratios are 0.3113 for move-to-front, 0.7278 for ' +
          'transpose, and 1.0000 for the static reference.'
      },
      {
        term: 'Which policy wins depends on whether the distribution moves',
        plain: 'Transpose beats move-to-front on a stationary trace and loses badly on a bursty one.',
        formal: 'transpose moves an item one position per access; MTF moves it to the front, so MTF adapts faster and overshoots more',
        detail: [
          'Transpose is conservative. It needs many accesses to promote an item, so it settles near ' +
            'the static optimum and stays there.',
          'Move-to-front is aggressive. One access is enough, so it tracks a moving working set and ' +
            'is thrown off by a single anomalous request.',
          'Neither is better in the abstract, and the demo runs three request families precisely so ' +
            'that no single row can be quoted as the answer.'
        ],
        example: 'On the Zipf family the demo measures transpose at 1.0679 and move-to-front at ' +
          '1.2399. On the bursty family it measures 0.7278 and 0.3113.'
      }
    ],

    'page-replacement': [
      {
        term: 'Belady’s rule is optimal and needs the future',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["evict the resident item whose<br/>next use is furthest away"] --> B["provably the fewest misses possible"]',
            '    B --> C["and it needs to know the<br/>rest of the trace"]',
            '    C --> D["so it can never be implemented"]',
            '    D --> E["it is the yardstick every real<br/>policy is measured against"]'
          ].join('\n'),
          caption: 'An unimplementable algorithm is still useful: without it there is no way to say how much of a policy\'s miss rate was avoidable.'
        },
        plain: 'Evict the resident item whose next use is furthest away.',
        formal: 'OPT is optimal offline; no online policy matches it, and it is the denominator every hit rate should carry',
        detail: 'It is not an algorithm, it is a ceiling — and having the ceiling is what turns a ' +
          'hit rate into a statement. The same LRU cache reads 46% on one trace and 0% on ' +
          'another, and only the optimum on each trace says which of those is a failure of the ' +
          'policy and which is a property of the workload. Computing it costs a pass over the ' +
          'trace to build each key’s future positions and a binary search per eviction.',
        example: 'On the demo’s mixed trace Belady reaches 72.6% and LRU reaches 58.7%, which is ' +
          '80.9% of what was available.'
      },
      {
        term: 'LRU is k-competitive, and a loop attains it',
        plain: 'A cycle one entry longer than the cache gives LRU zero hits.',
        formal: 'LRU is k-competitive for a cache of k pages, and no deterministic policy is better; the bound is attained by a cyclic reference of k + 1 pages',
        detail: 'Every item in the loop is evicted exactly one step before it is needed again, so ' +
          'the hit rate is not merely low, it is zero — while an optimal offline policy keeps ' +
          'k − 1 of the pages resident and hits on nearly all of them. Recognising that shape in ' +
          'a real workload is worth doing: a batch job iterating a table slightly larger than the ' +
          'buffer pool produces exactly it.',
        example: 'On the demo’s loop trace LRU, FIFO and CLOCK all measure 0.0% while Belady ' +
          'measures 82.7%.'
      },
      {
        term: 'The scan is the failure every later policy answers',
        plain: 'One pass over cold data evicts the whole working set and gains nothing.',
        formal: 'a scan of s > k items evicts every resident page in k steps while producing zero future hits',
        detail: 'Recency cannot express "this item is new and will never come back", because a ' +
          'new item is maximally recent. That is not a tuning problem — it is the definition of ' +
          'the policy — so the answer has to come from somewhere else: a second sighting, a ' +
          'frequency count, or a ghost list. Every policy invented after LRU is one of those ' +
          'three answers.',
        example: 'The demo’s resistance table: LRU keeps 45% of its Zipf hit rate when a sweep ' +
          'is added, and ARC keeps 66%.'
      },
      {
        term: 'CLOCK is LRU for hardware that cannot afford a list',
        plain: 'One reference bit per page and a hand that sweeps, clearing bits as it goes.',
        formal: 'on a miss the hand advances past set bits, clearing them, and takes the first slot whose bit is clear',
        detail: 'Setting a bit is something a memory-management unit does in hardware on every ' +
          'access; splicing a linked list is a memory write the operating system would have to ' +
          'make on every page touch, which is unaffordable. That constraint — not a difference in ' +
          'quality — is why operating systems use CLOCK and application caches use LRU, and the ' +
          'demo shows the two within a fraction of a per cent of each other on every trace.',
        example: 'On the demo’s mixed trace CLOCK measures 58.7% and LRU measures 58.7%.'
      },
      {
        term: 'ARC adapts by keeping ghosts, and it has no dial',
        plain: 'Two cache lists and two lists of keys recently evicted from each.',
        formal: 'a hit in B1 raises p by max(1, |B2|/|B1|); a hit in B2 lowers it by max(1, |B1|/|B2|)',
        readAs: 'A hit in the first ghost list raises the target by at least one, scaled by the ' +
          'ratio of the two ghost list sizes, and a hit in the second lowers it the same way.',
        detail: 'The ghost lists hold keys with no data, so they cost almost nothing and carry ' +
          'exactly the information a cache lacks: which of its recent evictions was a mistake. ' +
          'A hit in the recency ghost list says recency was starved; a hit in the frequency one ' +
          'says the opposite. Nothing is configured, and the same code behaves like LRU on a ' +
          'recency workload and like LFU on a frequency one.',
        example: 'On the demo’s Zipf trace ARC adjusts its target thousands of times and settles ' +
          'near 6; on the mixed trace it adjusts zero times and stays at 0.'
      },
      {
        term: 'A target of zero is an adaptation, not a stuck dial',
        plain: 'If evicted keys never come back, recency is correctly worth nothing.',
        formal: 'p moves only on a ghost hit; a trace whose cold keys are never re-requested produces none',
        detail: 'This is the reading that is easy to get wrong, and getting it wrong turns a ' +
          'correct measurement into a bug report. On a trace where the cold keys are swept once ' +
          'and never seen again, a key evicted from the recency list never turns up in the ghost ' +
          'list, ARC is never told that recency was starved, and it correctly values recency at ' +
          'zero — which is why it reaches 99.9% of the optimum on exactly that trace.',
        example: 'The demo’s mixed trace: 0 adaptations, p at 0.0, and 72.5% against Belady’s 72.6%.'
      },
      {
        term: 'W-TinyLFU admits by frequency, with a tie going to the incumbent',
        plain: 'A candidate must beat the victim it would replace on an approximate count.',
        formal: 'admit the window’s eviction only when sketch(candidate) > sketch(victim); the sketch halves every counter each sample period',
        detail: 'The halving is what separates it from plain LFU: without decay a favourite from ' +
          'last week is unevictable, and the sketch has no key list to walk so the decay has to ' +
          'be a shift over the counter array. The tie-break is the other half and it is what ' +
          'makes the policy scan-resistant — a one-hit wonder never beats an incumbent it has ' +
          'never outnumbered, so it is refused admission rather than admitted and then evicted.',
        example: 'On the demo’s loop trace, where every recency policy scores 0.0%, W-TinyLFU ' +
          'measures 81.9% against Belady’s 82.7%.'
      },
      {
        term: 'The working-set curve is what a capacity decision is made from',
        plain: 'Hit rate against cache size, with the knee visible.',
        formal: 'a single hit rate at a single size is one point on a curve whose shape is the answer',
        detail: 'Two purchases are available and the curve separates them. The vertical gap ' +
          'between a policy and the optimum is what a better policy could win; the slope of the ' +
          'optimum is what more memory could win. A policy already at 99% of the ceiling cannot ' +
          'be improved by a better policy at all, and a ceiling that is still climbing steeply ' +
          'says memory is the cheaper purchase.',
        example: 'On the demo’s mixed trace the optimum goes from 36.6% at 10 entries to 72.6% ' +
          'at 400, and LRU goes from 18.7% to 72.6%.'
      }
    ],

    'online-scheduling': [
      {
        term: 'List scheduling is the whole online algorithm',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a job arrives"] --> B["put it on the<br/>least-loaded machine"]',
            '    B --> C["decide now, never revisit"]',
            '    C --> A',
            '    C --> D["never worse than 2 − 1/m<br/>times the best offline schedule"]'
          ].join('\n'),
          caption: 'One rule, no lookahead and no rebalancing, and it is within a factor of two of a scheduler that knew every job in advance.'
        },
        plain: 'Put the arriving job on the least-loaded machine, now.',
        formal: 'Graham (1966): the makespan is at most (2 − 1/m) times the optimal makespan',
        readAs: 'The finish time is at most two minus one over m times the best possible finish ' +
          'time, for m machines.',
        detail: 'The proof is two lines and worth carrying: the machine that finishes last was ' +
          'the least loaded when its final job arrived, so every other machine held at least ' +
          'that much, so the total is at least m times it — and adding the last job back gives ' +
          'the bound. Nothing about the arrival order or the job sizes is used, which is why the ' +
          'result holds for every input rather than typical ones.',
        example: 'Over 40 instances scored against exact optima the demo measures a worst ratio ' +
          'of 1.5000 against a bound of 1.7500.'
      },
      {
        term: 'The bound is tight and its instance is a recognisable arrival pattern',
        plain: 'Many tiny jobs, then one enormous one.',
        formal: 'm(m − 1) jobs of size 1 followed by one job of size m: the online makespan is 2m − 1 against an optimum of m',
        detail: 'The small jobs fill every machine evenly to m − 1 and the big one has nowhere ' +
          'good to go, so the online rule pays 2m − 1 while an optimal assignment puts the big ' +
          'job alone and spreads the rest. This is not a theoretical curiosity: a burst of small ' +
          'requests followed by one expensive one is an ordinary arrival pattern, and it is ' +
          'exactly the shape that makes a live load balancer produce one very slow machine.',
        example: 'At four machines the demo measures 1.7500 on that family, which is 2 − 1/4 ' +
          'exactly, and LPT solves the same instance perfectly.'
      },
      {
        term: 'LPT is the same rule with the future revealed',
        plain: 'Sort the jobs longest first, then run the greedy rule.',
        formal: 'LPT is (4/3 − 1/(3m))-competitive against the offline optimum',
        readAs: 'Longest-processing-time first costs at most four thirds minus one over three m ' +
          'times the optimum.',
        detail: 'The gap between 2 − 1/m and 4/3 − 1/(3m) is exactly what being online costs on ' +
          'this problem, and it is a useful number to have because it bounds what any amount of ' +
          'prediction could buy. Placing the large jobs first is also the practical lesson: ' +
          'where a scheduler can see even part of the queue, admitting the awkward items while ' +
          'there is still room is most of the benefit.',
        example: 'The demo measures LPT at a worst ratio of 1.0455 against exact optima where ' +
          'the online rule measures 1.5000.'
      },
      {
        term: 'Random assignment leaves a maximum load of about log n over log log n',
        plain: 'Throwing n balls into n bins gives the busiest bin several, not one.',
        formal: 'the maximum load is (1 + o(1))·log n / log log n with high probability',
        readAs: 'The busiest bin holds about the logarithm of n divided by the logarithm of the ' +
          'logarithm of n.',
        detail: 'This is the baseline any load balancer without feedback is measured against, and ' +
          'it is worse than intuition suggests: the mean load is 1 and the maximum keeps growing ' +
          'with n. The demo measures it climbing from 4.33 to 6.83 as the bin count goes from 100 ' +
          'to 25 600, which is a 256-fold change in size for a maximum that has not stopped ' +
          'rising.',
        example: 'At 25 600 bins the demo measures a maximum of 6.83 against a mean of exactly 1.'
      },
      {
        term: 'Two choices collapses it to about log log n',
        plain: 'Sample two bins, put the ball in the less loaded one.',
        formal: 'the maximum load becomes log log n / log 2 + O(1); d choices gives log log n / log d',
        readAs: 'The busiest bin holds about the logarithm of the logarithm of n divided by the ' +
          'logarithm of two, and with d samples the base becomes d.',
        detail: 'A bin only grows past height h when BOTH samples were already at h, so the ' +
          'probability of reaching each successive level SQUARES rather than multiplying — and ' +
          'squaring at every level is what turns a logarithm into a log-logarithm. That is the ' +
          'whole argument, it fits in a sentence, and the change to the code is one extra sample ' +
          'and a comparison.',
        example: 'At 25 600 bins the demo measures 3.08 for two choices against 6.83 for one — a ' +
          'ratio of 2.22 that grows with n.'
      },
      {
        term: 'Three choices is not another exponential improvement',
        plain: 'Cubing instead of squaring buys a constant, not an exponent.',
        formal: 'd choices gives log log n / log d, so going from d = 2 to d = 3 divides by log 3 / log 2 ≈ 1.58',
        detail: 'The benefit per extra sample falls off sharply after the second, which is why ' +
          'the technique is named after two rather than ten. It also means the engineering ' +
          'question is settled: sample two, and spend any further effort on making the load ' +
          'signal current rather than on sampling more backends.',
        example: 'At 25 600 bins the demo measures 6.83, 3.08 and 3.00 for one, two and three ' +
          'choices.'
      },
      {
        term: 'Consistent hashing answers a different question and is measured on two axes',
        plain: 'It is not balancing load; it is keeping the assignment stable when machines change.',
        formal: 'removing one of m machines moves about 1/m of the keys, against nearly all of them under hashing modulo m',
        detail: 'Reporting only the load imbalance makes consistent hashing look strictly worse ' +
          'than random assignment, which is the standard misreading. The property it exists for ' +
          'is that a machine leaving disturbs only the keys that machine owned — random ' +
          'assignment and modulo hashing cannot promise that at all — and the imbalance is the ' +
          'price of that promise rather than a defect in the construction.',
        example: 'The demo measures 6.16% of keys moving when one of sixteen machines leaves, ' +
          'against an ideal of 6.25%.'
      },
      {
        term: 'Virtual nodes trade memory for balance',
        plain: 'More ring points per machine make the load more even and the ring bigger.',
        formal: 'with v points per machine the imbalance falls roughly as 1/√v',
        readAs: 'The imbalance falls roughly as one over the square root of the number of points ' +
          'per machine.',
        detail: 'One point per machine leaves the busiest holding several times the mean, because ' +
          'the arc it owns is a single random interval and random intervals are very uneven. ' +
          'Adding points averages several intervals per machine, and the averaging follows the ' +
          'usual square-root law. The cost is the ring size, which has to be searched on every ' +
          'lookup and held in memory on every client.',
        example: 'The demo measures imbalances of 4.470, 1.850, 1.351, 1.226 and 1.085 at 1, 4, ' +
          '16, 64 and 256 points per machine.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
