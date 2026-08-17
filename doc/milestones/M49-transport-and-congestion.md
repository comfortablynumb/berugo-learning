# M49 — Transport: TCP, UDP, QUIC and congestion control

> **Track** Networking · **Depends on** M48, M24 · **Sections** 10 · **Effort** L

**Outcome.** Reliable transport built from scratch over the lossy simulated link from M48: sliding
windows, the TCP state machine, every major congestion-control algorithm running side by side on the
same bottleneck, and QUIC's rethink of the whole layer. The milestone's recurring measurement is the
throughput/latency/fairness triangle under a shared bottleneck.

**Shared machinery introduced.** `machines/net/transport.js` — a transport framework (segments,
timers, state machines, retransmission) that any protocol implementation plugs into;
`machines/net/bottleneck.js` — a shared-link scenario with a configurable buffer, queueing
discipline and competing flows, reporting per-flow throughput, RTT, loss and Jain's fairness index;
`viz/sequence-plot-view.js` — the time-sequence and congestion-window plots.

---

## Sections

### 49.1 The transport layer's job
- **Covers** — multiplexing and demultiplexing with ports, the socket abstraction, connectionless
  versus connection-oriented service, UDP as a thin wrapper and when that is exactly right, checksums
  and their weakness, message versus stream semantics, and the guarantees a transport can and cannot
  provide over an unreliable network.
- **Demo** — the same application data sent over UDP and over a reliable transport across a lossy
  link: message loss, reordering and duplication are visible for UDP and repaired for the reliable
  protocol, with the added latency and overhead of the repair measured.
- **Diagram** — mermaid diagram of demultiplexing by the four-tuple to sockets.
- **Lab** — implement demultiplexing by four-tuple with a connection table; tests assert correct
  delivery for overlapping port reuse, wildcard listeners and connection lookup precedence.
- **Senior insight** — the four-tuple is the identity of a connection, which is why a client behind
  NAT is limited to about 64k connections per destination and why connection reuse matters at scale.

### 49.2 Reliable delivery
- **Covers** — the reliability problem, stop-and-wait and its throughput limit (one segment per
  RTT), the bandwidth-delay product as the required window, sliding windows, go-back-N versus
  selective repeat, sequence-number space and wraparound, cumulative versus selective
  acknowledgement, duplicate detection, and the timer versus feedback trade-off.
- **Demo** — window explorer: stop-and-wait, go-back-N and selective repeat over a link with
  adjustable bandwidth, latency and loss, with throughput plotted against window size and the
  BDP-derived optimum marked.
- **Diagram** — mermaid sequence diagram of go-back-N retransmitting a whole window after one loss.
- **Lab** — implement selective repeat with a receive buffer and correct sequence-space wraparound;
  tests assert in-order delivery of every byte under 10% loss and reordering, and that the sequence
  space handles wraparound without ambiguity.
- **Senior insight** — the window must be at least the bandwidth-delay product or the link idles;
  that single formula explains why a fast transcontinental link with default buffers delivers a
  fraction of its capacity.

### 49.3 TCP: connection management
- **Covers** — the segment format, the three-way handshake and what each step establishes, initial
  sequence numbers and why they are randomised, the full state machine (from M24's automata),
  connection teardown, TIME_WAIT and its purpose and cost, simultaneous open, half-open connections,
  SYN floods and SYN cookies, and keepalives.
- **Demo** — state-machine walkthrough: both endpoints' TCP states shown as the handshake, data
  transfer and teardown proceed, with segments animated; then packet loss during teardown produces a
  half-open connection and the keepalive detects it.
- **Diagram** — mermaid state diagram of the TCP connection state machine.
- **Lab** — implement the TCP state machine including simultaneous open and TIME_WAIT; tests assert
  the state transitions match the specification for every fixture packet sequence, including
  retransmitted handshake segments.
- **Senior insight** — TIME_WAIT exists to absorb delayed duplicates and to make the final ACK
  reliable; "too many TIME_WAIT sockets" is a symptom of connection churn, and the fix is connection
  reuse, not tuning the timeout down.

### 49.4 Flow control
- **Covers** — the receive window and the distinction from congestion control, window advertisement,
  zero-window and window probes, silly-window syndrome from both ends, window scaling for
  high-BDP paths, Nagle's algorithm, delayed acknowledgements, and the Nagle-plus-delayed-ACK
  interaction that adds 40 ms of latency to request/response workloads.
- **Demo** — the interaction reproduced: a small-write request/response pattern with Nagle and
  delayed ACK both enabled shows the periodic stall clearly in the time-sequence plot; disabling
  either removes it, and the trade-off in packet count is shown.
- **Diagram** — mermaid sequence diagram of the Nagle/delayed-ACK deadlock and its timeout resolution.
- **Lab** — implement Nagle's algorithm and delayed ACKs, then reproduce and fix the interaction;
  tests assert the stall occurs with both enabled and does not with the fix, measured from the
  simulated timeline.
- **Senior insight** — `TCP_NODELAY` is the standard fix, and understanding *why* means knowing that
  Nagle waits for an ACK that delayed-ACK is waiting to piggyback; two individually sensible
  optimisations composing into a bug is the general lesson.

### 49.5 Congestion control: the classics
- **Covers** — congestion collapse and the history that motivated it, AIMD and its convergence to
  fairness, slow start and its exponential growth, congestion avoidance, the congestion window and
  its interaction with the receive window, fast retransmit on duplicate ACKs, fast recovery, Tahoe
  versus Reno versus NewReno, retransmission-timeout computation with Jacobson's algorithm, and the
  loss-as-congestion-signal assumption.
- **Demo** — the congestion-window plot: cwnd over time through slow start, congestion avoidance,
  fast recovery and timeout, with each phase labelled and the corresponding events marked; two flows
  sharing a bottleneck show AIMD converging to a fair split.
- **Diagram** — mermaid diagram of the AIMD sawtooth with the phases annotated.
- **Lab** — implement NewReno including fast recovery and partial ACK handling; tests assert
  correct cwnd trajectories against reference traces and recovery from multiple losses in one window
  without a timeout.
- **Senior insight** — TCP interprets loss as congestion, which is correct on a wired link and wrong
  on a wireless one; that single assumption is why mobile transports needed different algorithms.

### 49.6 Modern congestion control
- **Covers** — CUBIC's window growth function and why it suits high-BDP paths, the bufferbloat
  problem and standing queues, delay-based signals (Vegas), BBR's model of bottleneck bandwidth and
  round-trip propagation time, explicit congestion notification, active queue management (RED,
  CoDel, FQ-CoDel) and fair queueing, pacing, and inter-protocol fairness.
- **Demo** — the bottleneck laboratory: Reno, CUBIC and BBR flows sharing a link with an adjustable
  buffer, showing throughput, queueing delay and fairness; a deep buffer produces bufferbloat with
  visible latency inflation, and enabling CoDel or FQ collapses the queue while preserving
  throughput.
- **Diagram** — mermaid diagram of a standing queue in a deep buffer versus a managed queue.
- **Lab** — implement CoDel's target/interval control law; tests assert the queueing delay converges
  to the target under sustained load and that throughput is not degraded beyond a stated bound.
- **Senior insight** — bufferbloat is a *latency* pathology caused by buffers that were sized for
  throughput; the reason your video call degrades when a backup starts is a queue nobody thought of
  as a shared resource.

### 49.7 Loss recovery in practice
- **Covers** — selective acknowledgement and how it changes recovery, the reordering-versus-loss
  ambiguity, DSACK for detecting spurious retransmission, RACK's time-based loss detection, tail
  loss probes, F-RTO, the initial-window debate, pacing to avoid bursts, and how recovery decisions
  dominate short-flow completion time.
- **Demo** — short-flow completion times under loss with different recovery mechanisms: a tail loss
  on a 10-segment flow costs a full RTO without a tail loss probe and a fraction of that with one,
  shown on the timeline and in a completion-time distribution.
- **Diagram** — mermaid sequence diagram of a tail loss and the probe that avoids the RTO.
- **Lab** — implement SACK-based recovery with a scoreboard; tests assert only the missing segments
  are retransmitted (verified against the loss pattern) and that recovery completes without a
  timeout for all fixture loss patterns.
- **Senior insight** — for short flows, which is most web traffic, the completion time is decided by
  loss recovery and the initial window, not by steady-state congestion control; optimising the
  wrong one is common.

### 49.8 QUIC and the move to user space
- **Covers** — QUIC's motivation (handshake latency, HOL blocking, ossification, deployability),
  running over UDP, integrated TLS 1.3 and the 1-RTT/0-RTT handshakes with 0-RTT's replay caveat,
  streams and per-stream flow control removing head-of-line blocking, connection IDs and migration
  across network changes, loss recovery redesigned with monotonic packet numbers, and the CPU cost of
  user-space transport.
- **Demo** — a lossy link carrying multiplexed streams over TCP and over QUIC: one lost segment
  stalls every TCP-multiplexed stream and only its own QUIC stream, with the per-stream completion
  times shown; a connection migration across an address change continues without interruption.
- **Diagram** — mermaid diagram of head-of-line blocking at the TCP layer versus per-stream QUIC
  delivery.
- **Lab** — implement per-stream flow control and multiplexed delivery over the datagram layer;
  tests assert independent stream progress under loss and correct aggregate connection-level flow
  control.
- **Senior insight** — HTTP/2 over TCP solved application-layer HOL blocking and inherited it at the
  transport layer; QUIC exists because the fix was impossible without replacing TCP, and TCP could
  not be changed because of middleboxes (M48).

### 49.9 Sockets and tuning
- **Covers** — the socket API in detail (bind, listen, backlog, accept, the SYN and accept queues),
  buffer sizing from the BDP, autotuning, `TCP_NODELAY`/`TCP_CORK`, keepalive parameters,
  `SO_REUSEADDR` and `SO_REUSEPORT`, connection pooling and its interaction with TIME_WAIT and
  ephemeral-port exhaustion, and which tunables are worth touching versus cargo cult.
- **Demo** — the tuning laboratory: adjust buffer sizes, backlog and Nagle against a fixed workload
  and see throughput, latency and drop behaviour change; the backlog overflow scenario shows
  connection attempts silently dropped and the resulting client-side timeouts.
- **Diagram** — mermaid diagram of the SYN queue and accept queue with the overflow points marked.
- **Lab** — size the send buffer, backlog and pool for a stated workload and target; tests assert the
  configuration meets the throughput and latency targets and that no connection is dropped at the
  specified arrival rate.
- **Senior insight** — an overflowing accept queue drops SYNs silently, so the client sees a
  timeout and the server sees nothing; that asymmetry is why "the server looks healthy" during a
  connection-storm incident.

### 49.10 Building and evaluating a transport
- **Covers** — assembling the milestone: a complete reliable protocol with congestion control over
  the lossy link, an evaluation methodology (throughput, latency, fairness, convergence, stability),
  competing-flow experiments, RTT-unfairness, incremental deployability, and reporting results with
  the scenario parameters stated.
- **Demo** — the evaluation suite: the learner's protocol against reference implementations across a
  scenario matrix (low/high BDP, shallow/deep buffer, lossy, competing flows, RTT asymmetry) with a
  results table and the fairness index per scenario.
- **Diagram** — mermaid flowchart of the evaluation matrix and the metrics collected per cell.
- **Lab** — implement a complete transport (reliability, flow control, congestion control) and pass
  the evaluation suite's thresholds; graded on correctness first, then on the throughput/latency/
  fairness scores across the matrix.
- **Senior insight** — a congestion-control algorithm that maximises its own throughput while
  starving competing flows will win every single-flow benchmark; fairness must be a graded criterion
  or the evaluation rewards exactly the wrong behaviour.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/net/transport.js` | Segments, timers, retransmission, state-machine framework |
| `src/js/machines/net/tcp.js` | Full TCP: state machine, flow control, SACK, recovery |
| `src/js/algorithms/congestion/` | Tahoe, Reno, NewReno, CUBIC, Vegas, BBR |
| `src/js/algorithms/aqm.js` | Drop-tail, RED, CoDel, FQ-CoDel, ECN marking |
| `src/js/machines/net/quic.js` | Datagram framing, streams, per-stream flow control, migration |
| `src/js/machines/net/bottleneck.js` | Shared-link scenarios, competing flows, fairness metrics |
| `src/js/machines/net/sockets.js` | Socket API, SYN/accept queues, buffer sizing, options |
| `src/js/viz/sequence-plot-view.js` | Time-sequence plots, cwnd traces, RTT and queue occupancy |

---

## Acceptance criteria

- [ ] The reliable-delivery implementation delivers every byte in order under 10% loss, reordering
      and duplication, asserted byte-for-byte across randomised link conditions.
- [ ] The TCP state machine's transitions match the specification for every fixture packet sequence,
      including simultaneous open and retransmitted handshakes.
- [ ] Congestion-control implementations reproduce reference cwnd trajectories for standard loss
      scenarios.
- [ ] Every multi-flow experiment reports Jain's fairness index alongside throughput; a
      throughput-only result fails review.
- [ ] The bufferbloat demo shows measured latency inflation with a deep buffer and its removal by
      AQM.
- [ ] QUIC's per-stream independence under loss is asserted by comparing per-stream completion times
      against the TCP-multiplexed baseline.
- [ ] The evaluation matrix's parameters are printed with every result table.

---

## Sources

- Kurose, Ross — *Computer Networking: A Top-Down Approach*
- Stevens — *TCP/IP Illustrated, Volume 1*
- Jacobson — *Congestion avoidance and control*
- Ha, Rhee, Xu — *CUBIC: a new TCP-friendly high-speed TCP variant*
- Cardwell et al. — *BBR: congestion-based congestion control*
- Nichols, Jacobson — *Controlling queue delay* (CoDel)
- Cheng, Cardwell, Dukkipati, Jha — RACK-TLP loss detection
- Iyengar, Thomson — RFC 9000 (QUIC); Thomson, Turner — RFC 9001
- Gettys, Nichols — *Bufferbloat: dark buffers in the internet*
