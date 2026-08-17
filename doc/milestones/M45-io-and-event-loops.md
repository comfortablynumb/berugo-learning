# M45 — I/O, interrupts, event loops and async runtimes

> **Track** Operating systems · **Depends on** M41, M44 · **Sections** 10 · **Effort** L

**Outcome.** How data actually moves between a program and the world, from the interrupt up to the
JavaScript event loop, with each concurrency model for servers built and measured against the same
load. This is the milestone that explains why an event loop beats a thread per connection, and where
that stops being true.

**Shared machinery introduced.** `machines/os/io-sim.js` — devices, interrupts, DMA, driver queues
and a network interface, integrated with the M41 kernel and M44 block device;
`machines/server-lab.js` — a load generator (open and closed models, configurable arrival
distributions) driving any server implementation, reporting throughput, latency percentiles,
saturation behaviour and resource use; `viz/eventloop-view.js` — queue-state timeline.

---

## Sections

### 45.1 Devices, drivers and DMA
- **Covers** — the device model, memory-mapped registers and port I/O (from M34), programmed I/O
  versus DMA, descriptor rings, doorbell registers, the driver's role and the layering below it,
  device state machines, and the cost accounting of a single I/O operation from the CPU's point of
  view.
- **Demo** — device timeline: issue an I/O with programmed I/O and watch the CPU copy every byte,
  then with DMA and watch it sleep while the device transfers, with CPU cycles consumed reported for
  each.
- **Diagram** — mermaid sequence diagram of a DMA transfer with the completion interrupt.
- **Lab** — implement a descriptor-ring driver with doorbell notification; tests assert correct
  transfer, no descriptor reuse before completion, and correct behaviour when the ring is full.
- **Senior insight** — DMA is why a machine can saturate a 100 Gb/s NIC without spending all its
  cycles copying; it is also why device drivers must reason about memory ordering with a device that
  is not a CPU (linking to M38).

### 45.2 Interrupts and deferred work
- **Covers** — the interrupt path from device to handler, interrupt vectors and controllers,
  top-half and bottom-half split, softirqs/tasklets/workqueues, interrupt coalescing and its
  latency/throughput trade, interrupt storms and livelock, NAPI-style polling under load, interrupt
  affinity and steering, and measuring interrupt cost.
- **Demo** — receive-livelock reproduction: raise the packet rate until interrupt handling consumes
  all CPU and useful throughput collapses to zero, then enable NAPI-style polling and watch
  throughput recover and stay flat.
- **Diagram** — mermaid diagram of the interrupt path with the top-half/bottom-half boundary.
- **Lab** — implement interrupt coalescing with a packet-count and timeout threshold; tests assert
  reduced interrupt count at high load, bounded added latency at low load, and no packet loss.
- **Senior insight** — receive livelock is the canonical example of a system that gets *slower* as
  input increases; the fix (switch from interrupts to polling under load) is the same shape as
  backpressure in M57.

### 45.3 Blocking and non-blocking I/O
- **Covers** — the blocking system-call model and its simplicity, `O_NONBLOCK` and `EAGAIN`,
  partial reads and writes and the loop every network program needs, the difference between "no data
  yet" and "end of stream", blocking on disk versus blocking on network (and why non-blocking file
  I/O barely exists on some systems), timeouts, and cancellation.
- **Demo** — the same client written blocking and non-blocking against a slow server, with the
  syscall sequence traced and the thread's state shown; a partial-write scenario shows exactly where
  the naive version loses data.
- **Diagram** — mermaid flowchart of the non-blocking write loop with `EAGAIN` handling.
- **Lab** — implement a correct non-blocking write loop handling partial writes and `EAGAIN`; tests
  assert all bytes are eventually written in order under an adversarial device that accepts one byte
  at a time.
- **Senior insight** — "write returned less than I asked for" is the bug that survives every local
  test and appears the first time a real network is slow; the loop is four lines and it is skipped
  constantly.

### 45.4 I/O multiplexing
- **Covers** — the readiness model, `select` and its fd-set limits, `poll` and its O(n) rescan,
  `epoll`/`kqueue` with registered interest and O(1) readiness delivery, level-triggered versus
  edge-triggered semantics and the drain requirement, the thundering-herd problem and `EPOLLEXCLUSIVE`,
  epoll internals (the interest set and the ready list), and multiplexing across threads.
- **Demo** — scalability comparison: `select`, `poll` and `epoll` handling 10 to 10 000 connections
  with a small active fraction, showing per-event cost flat for epoll and linear for the others;
  edge-triggered mode with a missing drain loop is shown stalling a connection.
- **Diagram** — mermaid diagram of the epoll interest set and ready list with an event moving
  between them.
- **Lab** — implement an epoll-style readiness interface with both trigger modes; tests assert no
  missed events in level-triggered mode and that edge-triggered mode with a correct drain loop is
  equivalent, while a partial drain loses events.
- **Senior insight** — edge-triggered is faster and unforgiving: one missed drain leaves a connection
  hung forever with no error anywhere, which is why level-triggered is the right default until you
  have measured that it matters.

### 45.5 Asynchronous I/O
- **Covers** — readiness versus completion models, POSIX AIO and why it disappointed, Windows IOCP,
  `io_uring`'s submission and completion rings, batched submission and reduced syscalls, polled
  mode, registered buffers and files, the ordering and cancellation semantics, and the programming-
  model differences from readiness-based loops.
- **Demo** — ring-based I/O: submissions and completions moving through the two rings with batching
  visible, syscalls counted per operation for a readiness loop versus a completion ring, and the
  throughput difference at high operation rates.
- **Diagram** — mermaid diagram of the submission and completion rings shared between user space and
  kernel.
- **Lab** — implement a completion-ring interface with batched submission and out-of-order
  completion; tests assert every submission produces exactly one completion with correct correlation
  data, including under cancellation.
- **Senior insight** — the win is not asynchrony, it is *batching*: amortising the user/kernel
  transition across many operations is what makes ring-based I/O fast, and the same argument governs
  every syscall-heavy hot path.

### 45.6 Event loops
- **Covers** — the reactor and proactor patterns, the anatomy of an event loop (timers, pending
  callbacks, poll, check, close), timer management with the wheels from M05, the run-to-completion
  model, blocking the loop and its symptoms, the thread pool behind "async" file I/O in libuv, and
  fairness between event sources.
- **Demo** — the loop visualiser: each phase and its queue shown per tick with the callbacks
  executed; a CPU-heavy callback is injected and the resulting latency spike across every other
  connection is measured and displayed.
- **Diagram** — mermaid state diagram of the event loop's phases in one iteration.
- **Lab** — implement the event loop's phase ordering with timers and I/O callbacks; tests assert
  timer callbacks fire in deadline order, that no phase starves another, and that a slow callback's
  effect on other callbacks' latency matches the model's prediction.
- **Senior insight** — an event loop turns a scheduling problem into a cooperative one: every
  callback is a scheduling decision made by the programmer, and a single 50 ms callback is a 50 ms
  latency floor for everything else on that loop.

### 45.7 JavaScript concurrency in depth
- **Covers** — the task and microtask queues and their relative priority, promise resolution
  semantics and the microtask drain, `async`/`await` desugaring into promise chains and continuation
  state machines (linking to M30), microtask starvation of rendering and I/O, `queueMicrotask`
  versus `setTimeout(0)` versus `setImmediate`, and how Web Workers change the picture.
- **Demo** — queue inspector: a program's tasks and microtasks visualised per tick with execution
  order, plus a microtask-starvation demo where a recursive promise chain prevents any task or
  render from ever running.
- **Diagram** — mermaid diagram of one tick: task, microtask drain, render, repeat.
- **Lab** — predict and then verify the exact output order of a program mixing `setTimeout`,
  promises, `async`/`await` and `queueMicrotask`; tests assert the predicted order matches the
  engine's actual behaviour.
- **Senior insight** — microtasks drain completely before the next task, so an unbounded promise
  chain starves everything else; this is the JavaScript version of priority inversion and it is
  invisible in a CPU profile that only shows self time.

### 45.8 Zero-copy and efficient data movement
- **Covers** — where copies come from in a naive I/O path, `sendfile` and `splice`, scatter-gather
  I/O with `readv`/`writev`, buffer ownership and lifetime, ring buffers for streaming (from M02),
  memory-mapped I/O trade-offs (from M43), transferables and `SharedArrayBuffer` as the browser's
  zero-copy story, and measuring copies rather than guessing at them.
- **Demo** — copy counter: a file-to-socket transfer traced through user space with each copy shown
  (disk → page cache → user buffer → socket buffer → NIC), then the same transfer with `sendfile`
  removing two copies, with CPU cost measured for both.
- **Diagram** — mermaid diagram of the copy path with and without the zero-copy path.
- **Lab** — implement a zero-copy transfer path in the simulator using buffer handoff rather than
  copying; tests assert data integrity and a measured copy count reduction to the theoretical
  minimum.
- **Senior insight** — at high throughput, copies are the cost: a 10 GB/s copy loop is a full core.
  Counting copies in a data path is a faster diagnosis than profiling it.

### 45.9 Server concurrency models
- **Covers** — thread per connection and its memory and switch costs, thread pools with a bounded
  queue, event-driven single-threaded servers, event-driven with a worker pool for CPU work,
  multiple loops with `SO_REUSEPORT`, the C10K problem and the C10M follow-up, and how each model
  behaves at saturation rather than at low load.
- **Demo** — the model bake-off: each server model under the same load ramp, with throughput,
  latency percentiles, memory and CPU plotted; the thread-per-connection model's memory curve and
  the event-driven model's tail-latency behaviour under CPU-heavy requests both become visible.
- **Diagram** — mermaid diagram comparing the four models' request paths.
- **Lab** — implement the event-driven-with-worker-pool model and tune the pool size; tests assert
  that CPU-heavy requests no longer block the loop and that the chosen pool size meets a stated
  latency target under the fixture load.
- **Senior insight** — the models differ mostly in *where* the queue is: threads queue in the
  scheduler, event loops queue in the ready list, pools queue explicitly. Making the queue explicit
  is what lets you bound it, which is the backpressure argument in M57.

### 45.10 Building and measuring a server
- **Covers** — putting the milestone together: accept loop, connection state machines, parsing
  incrementally (linking to M25), timeouts at every stage, graceful shutdown and connection draining,
  slow-client handling, load-generator design (open versus closed models and the coordinated-omission
  trap), and reporting a latency distribution honestly.
- **Demo** — the complete server running under load with a live dashboard: connection states,
  queue depths, per-stage latency breakdown and percentile distributions; a coordinated-omission
  toggle shows the same run reported with and without the correction, and the p99 differs by an
  order of magnitude.
- **Diagram** — mermaid state diagram of a connection's lifecycle including timeouts and draining.
- **Lab** — implement graceful shutdown: stop accepting, drain in-flight requests with a deadline,
  then close; tests assert no request is lost, no connection is closed mid-response, and that the
  deadline is honoured even with a stuck client.
- **Senior insight** — coordinated omission is why most published latency numbers are wrong: a
  closed-loop generator stops sending while the server is slow, so it never measures the queue it
  caused. Fixing the generator often changes p99 by 10×.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/os/io-sim.js` | Devices, interrupts, DMA, descriptor rings, NIC model |
| `src/js/machines/os/interrupts.js` | Vectors, top/bottom halves, coalescing, NAPI-style polling |
| `src/js/machines/os/readiness.js` | select/poll/epoll semantics with both trigger modes |
| `src/js/machines/os/completion-ring.js` | Submission/completion rings, batching, cancellation |
| `src/js/machines/event-loop.js` | Phases, timers, callback queues, blocking detection |
| `src/js/machines/js-queues.js` | Task/microtask model matching the browser's semantics |
| `src/js/machines/servers/` | Thread-per-connection, pool, event-driven, hybrid implementations |
| `src/js/machines/server-lab.js` | Load generator (open/closed), percentile reporting, omission correction |
| `src/js/viz/eventloop-view.js` | Queue timeline with phase boundaries |
| `src/js/viz/latency-view.js` | Percentile and histogram rendering, reused by M49 and M58 |

---

## Acceptance criteria

- [ ] Every server model is measured under the *same* load generator with an open-model arrival
      process; closed-model results are labelled as such.
- [ ] Latency is reported as a distribution with coordinated-omission correction available and its
      state visible in the readout.
- [ ] The receive-livelock demo reproduces the throughput collapse and the polling fix restores it,
      both asserted from measurements.
- [ ] Edge-triggered readiness with an incomplete drain is shown to lose events, as a test.
- [ ] Completion-ring correlation is asserted: exactly one completion per submission, correct
      user data, correct cancellation semantics.
- [ ] The JavaScript queue-order lab's predictions are verified against real engine behaviour, not
      only against the simulator.
- [ ] Graceful shutdown loses no in-flight request under the fixture load, asserted per request.

---

## Sources

- Arpaci-Dusseau, Arpaci-Dusseau — *Operating Systems: Three Easy Pieces*, I/O chapters
- Mogul, Ramakrishnan — *Eliminating receive livelock in an interrupt-driven kernel*
- Banga, Mogul, Druschel — *A scalable and explicit event delivery mechanism*
- Kegel — *The C10K problem*
- Axboe — the io_uring design documents
- Schmidt — *Reactor: an object behavioral pattern for demultiplexing and dispatching handles*
- libuv and Node.js event-loop documentation
- Tene — *How not to measure latency* (coordinated omission)
