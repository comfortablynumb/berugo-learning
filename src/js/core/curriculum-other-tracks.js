/**
 * Every remaining track: how to use this site, and the seven tracks whose milestones are still planned.
 *
 * Track data only - no API. `core/curriculum.js` assembles these into the one
 * ordered syllabus every view renders from, and it is still the single source
 * of truth; this file exists because the syllabus outgrew a thousand lines and
 * will keep growing as milestones land. Splitting per track rather than per
 * milestone keeps the seam in a place that does not move.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CurriculumOtherTracks = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  return [
    {
      id: 'using-this-site',
      title: 'How to use this site',
      summary: 'What this is, how it runs your code, and the JavaScript everything here is built on.',
      groups: [
        {
          id: 'M00',
          title: 'Foundation',
          summary: 'What this is, how it runs your code, and the JavaScript it runs on.',
          sections: [
            {
              id: 'home',
              kind: 'page',
              title: 'Home',
              summary: 'The curriculum map and how to use it.'
            },
            {
              id: 'code-engine',
              kind: 'section',
              title: 'How this platform runs your code',
              summary: 'The worker sandbox, the message protocol, budgets and how exercises are graded.',
              tags: ['runner', 'workers', 'measurement', 'platform']
            },
            {
              id: 'js-systems',
              kind: 'section',
              title: 'JavaScript as a systems language',
              summary: 'Typed arrays, endianness, IEEE 754, int32 coercion, BigInt and Math.imul.',
              tags: ['typed arrays', 'bits', 'floating point', 'bigint', 'endianness']
            },
            {
              id: 'settings',
              kind: 'page',
              title: 'Progress and settings',
              summary: 'Theme, animation, progress export and reset.'
            }
          ]
        }
      ]
    },
    {
      id: 'architecture',
      title: 'Computer architecture',
      summary: 'From a gate to an out-of-order core, and the memory hierarchy underneath it.',
      groups: [],
      planned: [
        { id: 'M33', title: 'Digital logic and sequential circuits', sections: 10 },
        { id: 'M34', title: 'ISA, assembly, datapath and control', sections: 10 },
        { id: 'M35', title: 'Pipelining, hazards and branch prediction', sections: 9 },
        { id: 'M36', title: 'Superscalar, out-of-order execution and speculation', sections: 9 },
        { id: 'M37', title: 'Caches and the memory hierarchy', sections: 10 },
        { id: 'M38', title: 'Cache coherence and memory consistency', sections: 9 },
        { id: 'M39', title: 'Linking, loading and the ABI', sections: 9 },
        { id: 'M40', title: 'GPUs, SIMD and domain-specific accelerators', sections: 9 }
      ]
    },
    {
      id: 'operating-systems',
      title: 'Operating systems',
      summary: 'Processes, synchronisation, virtual memory, file systems, I/O and isolation.',
      groups: [],
      planned: [
        { id: 'M41', title: 'Processes, threads and scheduling', sections: 10 },
        { id: 'M42', title: 'Synchronisation, deadlock and the classic problems', sections: 10 },
        { id: 'M43', title: 'Virtual memory, paging and allocators', sections: 11 },
        { id: 'M44', title: 'File systems and crash consistency', sections: 10 },
        { id: 'M45', title: 'I/O, interrupts, event loops and async runtimes', sections: 10 },
        { id: 'M46', title: 'Virtualisation, containers and isolation', sections: 9 },
        { id: 'M47', title: 'Concurrency and parallelism in practice', sections: 11 }
      ]
    },
    {
      id: 'automata-and-compilers',
      title: 'Automata, languages and compilers',
      summary: 'Regular and context-free languages, computability, types, and a compiler you build.',
      groups: [],
      planned: [
        { id: 'M24', title: 'Regular languages and finite automata', sections: 11 },
        { id: 'M25', title: 'Context-free languages and parsing', sections: 12 },
        { id: 'M26', title: 'Computability and complexity theory', sections: 10 },
        { id: 'M27', title: 'Lambda calculus, type systems and semantics', sections: 11 },
        { id: 'M28', title: 'Compiler front end — build a language', sections: 9 },
        { id: 'M29', title: 'IR, SSA and optimisation', sections: 10 },
        { id: 'M30', title: 'Code generation, bytecode VMs and JIT', sections: 10 },
        { id: 'M31', title: 'Garbage collection and runtime memory', sections: 9 },
        { id: 'M32', title: 'Program analysis, SAT/SMT and verification', sections: 11 }
      ]
    },
    {
      id: 'networking',
      title: 'Networking',
      summary: 'Link layer to the web stack, with the protocols simulated rather than described.',
      groups: [],
      planned: [
        { id: 'M48', title: 'Link layer, IP and routing', sections: 9 },
        { id: 'M49', title: 'Transport: TCP, UDP, QUIC and congestion control', sections: 10 },
        { id: 'M50', title: 'DNS, TLS and the web protocol stack', sections: 10 }
      ]
    },
    {
      id: 'data-systems',
      title: 'Data systems',
      summary: 'Storage engines, query processing and transactions, built rather than configured.',
      groups: [],
      planned: [
        { id: 'M51', title: 'Storage engines and indexes', sections: 10 },
        { id: 'M52', title: 'Query processing and optimisation', sections: 10 },
        { id: 'M53', title: 'Transactions, isolation and recovery', sections: 10 }
      ]
    },
    {
      id: 'distributed-systems',
      title: 'Distributed systems',
      summary: 'Time, replication, consensus, partitioning and the failure modes they exist for.',
      groups: [],
      planned: [
        { id: 'M54', title: 'Distributed time, consistency and replication', sections: 10 },
        { id: 'M55', title: 'Consensus and fault tolerance', sections: 9 },
        { id: 'M56', title: 'Partitioning, membership, gossip and CRDTs', sections: 10 },
        { id: 'M57', title: 'Stream processing and resilience engineering', sections: 10 }
      ]
    },
    {
      id: 'engineering-practice',
      title: 'Engineering practice',
      summary: 'Performance, security, architecture, observability and the data types that bite.',
      groups: [],
      planned: [
        { id: 'M58', title: 'Performance engineering and queueing theory', sections: 10 },
        { id: 'M59', title: 'Security engineering and side channels', sections: 11 },
        { id: 'M60', title: 'Software architecture, API and schema design', sections: 11 },
        { id: 'M61', title: 'Testing, debugging and observability', sections: 10 },
        { id: 'M62', title: 'Systems data: Unicode, time, serialisation, RNG and IDs', sections: 10 }
      ]
    },
    {
      id: 'practice-and-mastery',
      title: 'Practice and mastery',
      summary: 'Capstones that assemble the tracks, and the arena that keeps them fresh.',
      groups: [],
      planned: [
        { id: 'M63', title: 'Build-your-own-X capstones', sections: 12 },
        { id: 'M64', title: 'Challenge arena, progress and spaced repetition', sections: 8 }
      ]
    }
  ];
}));
