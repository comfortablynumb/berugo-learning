# M41 — Processes, threads and scheduling

> **Track** Operating systems · **Depends on** M34 · **Sections** 10 · **Effort** L

**Outcome.** A working scheduler simulator on top of the BRV32 machine: processes with real address
spaces, context switches with measured cost, and every major scheduling policy runnable on the same
workloads with latency distributions rather than averages. The milestone answers "why is my process
slow when the CPU is 40% idle".

**Shared machinery introduced.** `machines/os/kernel-sim.js` — a small kernel over the M34 CPU with
traps, a process table, address spaces (using M37's TLB) and a timer interrupt;
`machines/os/scheduler-lab.js` — pluggable policies driven by generated or recorded workloads
(CPU-bound, interactive, mixed, bursty), reporting throughput, latency percentiles, fairness and
context-switch overhead; `viz/gantt-view.js` — the scheduling timeline.

---

## Sections

### 41.1 What a process is
- **Covers** — the process as address space plus execution context plus resources, the process
  control block and what it holds, process states and the transitions between them, creation
  (`fork` and its copy-on-write, `exec`, `posix_spawn`, `CreateProcess`), the process tree, exit
  status, zombies and orphans, and the resource-limit and accounting fields nobody reads until they
  matter.
- **Demo** — process explorer: create, fork and exec processes in the simulator, watch the PCB
  fields, the address space and the process tree update; leave a child unreaped and watch the zombie
  appear in the table.
- **Diagram** — mermaid state diagram of process states with the transition causes labelled.
- **Lab** — implement `fork` with copy-on-write address-space duplication; tests assert the child
  sees a private copy after writing, that no page is copied until written (checked with the page
  counter), and that the parent is unaffected.
- **Senior insight** — `fork` in a multithreaded process copies only the calling thread, which is
  why a `fork` without an immediate `exec` in a threaded program can deadlock on a lock held by a
  thread that no longer exists.

### 41.2 Threads
- **Covers** — threads as schedulable entities sharing an address space, the thread control block,
  kernel threads versus user threads versus M:N models with their trade-offs, thread creation cost,
  stack allocation per thread and the memory it implies, thread-local storage (from M39), green
  threads and goroutines, and the shared-state hazards that motivate M42.
- **Demo** — thread-model comparison: the same workload under 1:1, N:1 and M:N models with creation
  cost, context-switch cost, blocking behaviour (one blocking thread stalls all in N:1) and total
  throughput reported.
- **Diagram** — mermaid diagram of the three threading models mapping user threads to kernel threads.
- **Lab** — implement user-level thread switching with explicit context save/restore in the
  simulator; tests assert correct interleaved execution and that the total switch cost is
  measurably below kernel-thread switching.
- **Senior insight** — the N:1 model's fatal flaw is that any blocking system call stalls every
  thread; every language runtime with green threads (Go, Erlang, modern Java) had to make its I/O
  layer non-blocking to work around exactly that.

### 41.3 Context switching
- **Covers** — what a context switch actually saves and restores, the direct cost (registers, stack,
  page-table base) versus the indirect cost (cold caches, TLB flush, branch predictor pollution),
  address-space switching and ASIDs/PCIDs, kernel-entry cost including post-Spectre mitigations,
  and measuring switch cost properly.
- **Demo** — switch-cost measurement: ping-pong two processes and measure direct cost, then measure
  the cache-warmth recovery curve after a switch, showing the indirect cost dwarfing the direct one
  for cache-heavy workloads.
- **Diagram** — mermaid sequence diagram of a timer-interrupt-driven context switch through the
  kernel.
- **Lab** — implement the context-switch path (save, pick, restore) and measure it; tests assert the
  saved/restored state is complete (verified by an equality check on all architectural state) and
  report the measured cost in cycles.
- **Senior insight** — the reason a thread pool sized to 4× the core count performs worse than one
  sized to the core count is almost entirely this indirect cost; the direct cost is small enough to
  mislead everyone who measures only it.

### 41.4 Scheduling fundamentals
- **Covers** — the metrics (throughput, turnaround, waiting time, response time, fairness,
  predictability) and the fact that they conflict, FCFS and the convoy effect, SJF/SRTF optimality
  for average turnaround and its unimplementable requirement, round robin and the quantum choice,
  the workload-dependence of every policy, and preemption.
- **Demo** — policy playground: run FCFS, SJF, SRTF and RR on the same workload with a Gantt chart
  and a metric table; the quantum slider on RR shows response time and switch overhead trading
  against each other.
- **Diagram** — mermaid diagram of the convoy effect: one long job blocking many short ones.
- **Lab** — implement round robin with a configurable quantum and measure the response-time/overhead
  curve; tests assert fairness (no starvation) and that the measured overhead matches the switch
  count times the measured switch cost.
- **Senior insight** — SJF is optimal and impossible: it needs the future. Every practical scheduler
  is an attempt to *estimate* job length from recent behaviour, which is why interactive processes
  are detected by their sleep pattern.

### 41.5 Priorities and multilevel feedback
- **Covers** — static and dynamic priorities, starvation and aging, the multilevel feedback queue
  and how it approximates SJF from observed behaviour, interactivity heuristics, priority boosting,
  gaming the scheduler (the yield-before-quantum trick), and the historical Linux O(n) → O(1) →
  CFS progression.
- **Demo** — MLFQ visualiser: jobs moving between queues as they consume or yield their quanta, with
  the boost period visible; a "gaming" job is included that exploits the heuristic and is then
  defeated by accounting for total usage rather than per-slice behaviour.
- **Diagram** — mermaid diagram of the MLFQ levels with the demotion and boost arrows.
- **Lab** — implement MLFQ with aging and a boost period; tests assert that CPU-bound jobs sink,
  interactive jobs stay near the top, no job starves over a long run, and the gaming job gains no
  advantage.
- **Senior insight** — every heuristic scheduler can be gamed by a workload that knows the rules,
  which is why multi-tenant systems moved to proportional-share accounting instead of behaviour
  detection.

### 41.6 Proportional share and CFS
- **Covers** — the fair-share idea, weights and nice values as ratios, lottery and stride
  scheduling, the completely fair scheduler's virtual runtime and red-black tree (from M04), the
  minimum granularity parameter, latency targets, group scheduling for containers, and EEVDF as the
  successor.
- **Demo** — CFS simulator: processes with different weights running with their virtual runtimes
  displayed and the red-black tree shown, demonstrating that CPU shares track weights exactly; a
  latency-target slider shows the fairness/overhead trade.
- **Diagram** — mermaid diagram of the vruntime-ordered tree with the leftmost node selected next.
- **Lab** — implement virtual-runtime accounting with weights; tests assert the CPU share of each
  process converges to its weight ratio within a tolerance over a long run, including when processes
  sleep and wake.
- **Senior insight** — the sleeper-fairness rule (a waking task's vruntime is clamped rather than
  restored) is what stops a long-sleeping process from monopolising the CPU on wake; it is also the
  reason a task that sleeps a lot gets good latency.

### 41.7 Real-time scheduling
- **Covers** — hard versus soft real time, periodic task models, rate-monotonic scheduling and its
  utilisation bound, earliest-deadline-first and its optimality, schedulability analysis, priority
  inversion with the Mars Pathfinder case, priority inheritance and priority ceiling protocols, and
  why general-purpose systems avoid real-time priorities.
- **Demo** — a task set with periods and deadlines scheduled by RM and EDF, with deadline misses
  highlighted and the schedulability test's prediction shown next to the observed result; a priority
  inversion is then constructed and fixed by inheritance, with the blocking time measured.
- **Diagram** — mermaid diagram of a priority inversion: high priority blocked by low, medium
  preempting.
- **Lab** — implement priority inheritance in the mutex; tests assert bounded blocking time for the
  high-priority task in the inversion fixture and that the unmodified mutex exhibits unbounded
  blocking.
- **Senior insight** — priority inversion is not an exotic real-time problem; it happens in any
  system with priorities and shared locks, including thread pools with priority queues, and it looks
  like a random stall.

### 41.8 Multiprocessor scheduling
- **Covers** — per-CPU run queues versus a global queue, load balancing and its frequency, cache and
  NUMA affinity (from M37), the migration cost decision, work stealing at the OS level, gang
  scheduling for parallel jobs, scheduling domains and topology awareness, and energy-aware
  scheduling on heterogeneous cores.
- **Demo** — multi-core scheduling with a topology: migrations shown on the Gantt chart with their
  cache-warmth cost, a balance-interval slider trading balance quality against migration overhead,
  and a heterogeneous mode placing tasks on big or little cores by their measured demand.
- **Diagram** — mermaid diagram of scheduling domains over a two-socket topology.
- **Lab** — implement load balancing with a migration-cost threshold; tests assert improved
  makespan versus no balancing and that the balancer does not thrash (migration count bounded) under
  an oscillating load.
- **Senior insight** — the balancer's job is not to equalise queue lengths, it is to minimise
  completion time including migration cost; a perfectly balanced system that migrated everything is
  usually slower than a slightly unbalanced one.

### 41.9 Scheduling in containers and the cloud
- **Covers** — cgroup CPU shares, quota and period, throttling and the latency spikes it causes,
  the CPU-limit versus CPU-request distinction, noisy neighbours and interference, oversubscription
  economics, latency-critical versus batch co-location, and how a runtime's thread-pool sizing
  interacts badly with an unnoticed CPU quota.
- **Demo** — quota simulator: a multithreaded workload under a CPU quota, with throttling periods
  visible as flat spots in progress and the resulting p99 latency spike; adjusting the period length
  and thread count shows the classic "more threads made it slower" effect.
- **Diagram** — mermaid diagram of a quota period with the task throttled after exhausting its
  budget.
- **Lab** — compute the correct thread-pool size for a given CPU quota and verify by simulation;
  tests assert that the chosen size avoids throttling while maintaining throughput, and that the
  naive core-count-based size does not.
- **Senior insight** — a runtime that sizes its pool from the host core count inside a container
  with a 2-CPU quota creates dozens of runnable threads for two CPUs of budget; the symptom is
  throttling and terrible tail latency, and it is one of the most common cloud performance bugs.

### 41.10 Measuring and tuning
- **Covers** — run-queue length and load average (and what load average actually measures), CPU
  utilisation versus saturation, scheduling latency and its distribution, tracing scheduler events,
  identifying whether a workload is CPU-bound, I/O-bound or lock-bound, and the tuning decisions
  worth making versus the ones that are folklore.
- **Demo** — the diagnosis dashboard: three unlabelled workloads with their scheduler traces, and a
  guided walkthrough classifying each by its run-queue, wait-time and off-CPU profile, then applying
  the correct fix and re-measuring.
- **Diagram** — mermaid decision flowchart from symptom to scheduler-related cause.
- **Lab** — diagnose three workloads from their traces and propose a fix for each; graded against the
  measured improvement when the fix is applied in the simulator.
- **Senior insight** — high CPU utilisation with low throughput usually means saturation, not
  capacity; the queueing-theory version of this argument is in M58, and the two sections are meant
  to be read together.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/os/kernel-sim.js` | Process table, address spaces, traps, timer, syscall layer |
| `src/js/machines/os/process.js` | PCB, fork with COW, exec, exit/reap, process tree |
| `src/js/machines/os/threads.js` | TCBs, 1:1 / N:1 / M:N models, user-level switching |
| `src/js/machines/os/context-switch.js` | Save/restore path with direct and indirect cost modelling |
| `src/js/machines/os/schedulers/` | FCFS, SJF, SRTF, RR, MLFQ, CFS, lottery/stride, RM, EDF |
| `src/js/machines/os/smp-scheduler.js` | Per-CPU queues, balancing, affinity, heterogeneous cores |
| `src/js/machines/os/cgroup-cpu.js` | Shares, quota, period, throttling |
| `src/js/machines/os/scheduler-lab.js` | Workload generators, metrics, percentile reporting |
| `src/js/viz/gantt-view.js` | Scheduling timeline with migrations, preemptions and throttling |

---

## Acceptance criteria

- [ ] Every scheduler implements one interface and runs on identical workloads; comparisons are
      never across different workload generations.
- [ ] Latency is always reported as a distribution (p50/p95/p99/max); a mean-only readout fails
      review.
- [ ] Copy-on-write `fork` is verified by page-copy counting, not by inspection.
- [ ] Context-switch completeness is asserted by comparing full architectural state before and after
      a save/restore round trip.
- [ ] CFS weight ratios are asserted to hold within tolerance over long runs including sleep/wake
      cycles.
- [ ] The priority-inheritance test asserts a bounded blocking time, and the unmodified mutex fails
      the same bound.
- [ ] The container-quota lab reproduces throttling with measured stall periods and the fix removes
      them.

---

## Sources

- Arpaci-Dusseau, Arpaci-Dusseau — *Operating Systems: Three Easy Pieces*
- Silberschatz, Galvin, Gagne — *Operating System Concepts*
- Love — *Linux Kernel Development*; Bovet, Cesati — *Understanding the Linux Kernel*
- Liu, Layland — *Scheduling algorithms for multiprogramming in a hard-real-time environment*
- Sha, Rajkumar, Lehoczky — *Priority inheritance protocols*
- Waldspurger, Weihl — *Lottery scheduling: flexible proportional-share resource management*
- Linux kernel documentation on CFS, EEVDF and cgroup v2 CPU control
