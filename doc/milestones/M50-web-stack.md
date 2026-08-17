# M50 — DNS, TLS and the web protocol stack

> **Track** Networking · **Depends on** M49, M23 · **Sections** 10 · **Effort** L

**Outcome.** Everything between typing a URL and receiving bytes, implemented and measured: name
resolution, the TLS handshake, all three HTTP versions, caching and CDNs, real-time protocols and
the diagnosis workflow that turns "the site is slow" into a specific layer and a specific fix.

**Shared machinery introduced.** `machines/web/` — DNS resolver and authoritative servers, a TLS
handshake state machine over the M23 primitives, HTTP/1.1, HTTP/2 and HTTP/3 implementations over
the M49 transports, a caching layer and a CDN topology model; `viz/waterfall-view.js` — the request
waterfall with per-phase breakdown (DNS, connect, TLS, TTFB, transfer), reused in M58.

---

## Sections

### 50.1 DNS
- **Covers** — the name hierarchy and delegation, resolver types (stub, recursive, authoritative),
  the resolution walk from root to authoritative, record types and their uses, TTL and caching
  layers, negative caching, glue records, CNAME rules and the apex problem, DNS as a load-balancing
  and failover mechanism with its TTL-bound reaction time, DNSSEC, and DoH/DoT.
- **Demo** — resolution tracer: resolve a name and watch each query and referral from root down,
  with caches populating and TTLs counting down; change a record and observe exactly how long stale
  answers persist at each cache layer.
- **Diagram** — mermaid sequence diagram of an iterative resolution from root to authoritative.
- **Lab** — implement the recursive resolver with cache and TTL handling, including negative
  caching; tests assert correct resolution for the fixture zone, correct expiry behaviour, and loop
  protection for CNAME chains.
- **Senior insight** — DNS failover is bounded below by TTL plus resolver misbehaviour: some
  resolvers and runtimes cache beyond TTL, which is why "we'll just change DNS" is never a
  fast-recovery plan.

### 50.2 TLS
- **Covers** — what TLS provides and does not, the 1.2 handshake versus 1.3's one round trip, cipher
  suites and negotiation, certificate chains and validation (from M23), SNI and its privacy
  implications (and ECH), ALPN for protocol selection, session resumption and tickets, 0-RTT and its
  replay exposure, mutual TLS, and the handshake's contribution to first-byte latency.
- **Demo** — handshake walkthrough: every message in a 1.3 handshake with its purpose and the keys
  derived at each step, timed against the RTT budget; a 1.2 handshake is shown alongside so the
  extra round trip is visible, and resumption removes it.
- **Diagram** — mermaid sequence diagram of the TLS 1.3 handshake with key derivation points.
- **Lab** — implement the handshake state machine with key-schedule derivation using M23's
  primitives; tests assert the derived keys match reference test vectors and that each
  malformed-handshake fixture is rejected at the correct step.
- **Senior insight** — 0-RTT data is replayable by design, so it must be restricted to idempotent
  requests; enabling it globally on an API is a correctness bug that looks like a performance
  optimisation.

### 50.3 HTTP/1.1
- **Covers** — the message format, methods and their semantics (safe, idempotent, cacheable),
  status-code families and the ones that are routinely misused, headers and their parsing pitfalls,
  connection reuse with keep-alive, pipelining and why it failed, chunked transfer encoding,
  head-of-line blocking at the connection level, connection-count workarounds and domain sharding,
  and request smuggling as a parsing-disagreement vulnerability.
- **Demo** — connection-reuse comparison: the same page fetched with connection-per-request, with
  keep-alive and with six parallel connections, shown on the waterfall with the connection setup
  cost visible per request.
- **Diagram** — mermaid diagram of six requests over one connection (HOL) versus six connections.
- **Lab** — implement an incremental HTTP/1.1 parser handling chunked encoding and header
  continuation; tests assert correct parsing of the fixture messages *and* rejection of the request-
  smuggling fixtures where `Content-Length` and `Transfer-Encoding` disagree.
- **Senior insight** — request smuggling exists because two parsers in a chain disagree about
  message boundaries; the defence is to reject ambiguity rather than to guess, which is a general
  rule for any protocol handled by more than one implementation.

### 50.4 HTTP/2
- **Covers** — the binary framing layer, streams and multiplexing over one connection, frame types
  and flow control at both stream and connection level, HPACK header compression with its dynamic
  table (and the CRIME/HPACK-bomb concerns), stream priority and its practical failure, server push
  and why it was removed, and TCP-level head-of-line blocking remaining underneath.
- **Demo** — multiplexing viewer: many requests over one connection with frames interleaved on the
  wire, HPACK's table state shown as headers compress across requests, and a lost TCP segment
  stalling every stream at once.
- **Diagram** — mermaid diagram of interleaved frames from multiple streams on one connection.
- **Lab** — implement HPACK encoding and decoding with the dynamic table; tests assert round-trip
  fidelity against RFC test vectors and correct table eviction behaviour at the size limit.
- **Senior insight** — HTTP/2 removed application-layer HOL blocking and left transport-layer HOL
  blocking in place, so on a lossy network it can be *worse* than six HTTP/1.1 connections; that
  finding is what motivated QUIC.

### 50.5 HTTP/3
- **Covers** — mapping HTTP semantics onto QUIC streams, QPACK's solution to header compression
  without head-of-line blocking, the loss of the ordered-stream assumption, connection migration for
  mobile clients, discovery via Alt-Svc and HTTPS records, deployment considerations (UDP blocking,
  CPU cost), and when each HTTP version is actually the right choice.
- **Demo** — the three versions fetching the same page over identical lossy links, with waterfalls
  side by side and completion times compared; loss rate is adjustable and the crossover where HTTP/3
  wins is visible.
- **Diagram** — mermaid diagram of HTTP/3's mapping of requests to independent QUIC streams.
- **Lab** — implement QPACK's static-table lookup and encoder-stream-free encoding path; tests
  assert correct decoding with no cross-stream ordering dependency, verified by decoding streams in
  a shuffled order.
- **Senior insight** — HTTP/3's advantage appears under loss and on mobile networks and is close to
  nothing on a clean wired link; measuring on your own users' network conditions is the only way to
  know which side of the crossover you are on.

### 50.6 Caching and CDNs
- **Covers** — HTTP cache semantics (freshness lifetime, `Cache-Control` directives, validators and
  conditional requests, `Vary` and cache-key construction), private versus shared caches,
  stale-while-revalidate and stale-if-error, purge and invalidation strategies (and why
  content-hashed URLs beat purging), CDN topology and cache hierarchies, origin shielding,
  cache-hit-ratio economics, and edge computing.
- **Demo** — cache simulator: requests flowing through browser cache, CDN edge, shield and origin
  with hit/miss at each layer, hit ratio and origin load reported; changing `Vary` or the cache key
  visibly fragments the cache and collapses the hit ratio.
- **Diagram** — mermaid diagram of the cache hierarchy with hit/miss paths and revalidation.
- **Lab** — implement cache-key construction and freshness evaluation per the HTTP caching rules;
  tests assert correct hit/miss/revalidate decisions against a fixture table of header combinations,
  including the `Vary`, `no-cache` and `must-revalidate` cases.
- **Senior insight** — `Vary: User-Agent` fragments the cache into thousands of copies and quietly
  destroys the hit ratio; cache-key design is the single highest-leverage decision in a CDN
  configuration and it is usually made by accident.

### 50.7 Real-time protocols
- **Covers** — the polling spectrum (short polling, long polling, server-sent events, WebSockets),
  the WebSocket upgrade handshake and framing, masking and why it exists, heartbeats and
  half-open-connection detection, reconnection with backoff and resumption tokens, message ordering
  and delivery guarantees (there are none by default), WebTransport, and WebRTC data channels for
  peer-to-peer.
- **Demo** — the same live-update feature implemented four ways with a network partition injected:
  each approach's detection time, reconnection behaviour and message-loss profile is measured and
  compared.
- **Diagram** — mermaid sequence diagram of a WebSocket upgrade, heartbeat exchange and reconnection
  with resumption.
- **Lab** — implement reconnection with exponential backoff, jitter and message resumption from a
  sequence token; tests assert no message loss across a partition, no duplicate delivery, and
  that the backoff distribution avoids the thundering-herd pattern.
- **Senior insight** — a WebSocket that has not sent data does not know it is dead; without
  heartbeats, half-open connections persist until a write fails, which is why "the app stopped
  updating and nobody noticed" is the standard real-time bug.

### 50.8 Web performance
- **Covers** — the latency budget from DNS through TLS to first byte, the effect of RTT on every
  phase, connection setup amortisation, compression (from M22) applied at the HTTP layer, resource
  prioritisation and the critical rendering path, preconnect/preload/priority hints, the
  request-count-versus-size trade-off across HTTP versions, and Core Web Vitals as user-visible
  measurements.
- **Demo** — the waterfall analyser: a page load broken down per request and per phase, with an RTT
  slider showing which costs scale with latency and which with bandwidth; applying each optimisation
  updates the waterfall and reports the saving.
- **Diagram** — mermaid diagram of the critical path from navigation to first render with the
  blocking resources marked.
- **Lab** — reduce a page's simulated load time to a target by choosing optimisations; graded on the
  measured improvement and on whether the chosen optimisations address the phases that actually
  dominate.
- **Senior insight** — on a high-RTT connection, request *count* dominates and payload size barely
  matters; on a slow-bandwidth connection the reverse. Optimising the wrong one is why "we minified
  everything and it is still slow" happens.

### 50.9 API protocols on the wire
- **Covers** — REST over HTTP/JSON with its cacheability advantage, gRPC over HTTP/2 with protobuf
  framing and streaming modes, GraphQL's single-endpoint model and its caching consequences, binary
  encodings compared (from M62), error semantics and status mapping, retry and idempotency
  requirements (linking to M57 and M60), deadline propagation, and choosing a protocol by
  requirement.
- **Demo** — payload and latency comparison: the same API call as REST/JSON, gRPC/protobuf and
  GraphQL, with bytes on the wire, parse cost, round trips required and cacheability shown for each.
- **Diagram** — mermaid diagram of gRPC's four call types mapped onto HTTP/2 streams.
- **Lab** — implement length-prefixed message framing over a stream with deadline propagation;
  tests assert correct message boundaries under fragmented delivery and that a deadline exceeded
  mid-stream cancels cleanly at both ends.
- **Senior insight** — GraphQL trades HTTP cacheability for query flexibility, and teams routinely
  discover the cost after the CDN stops helping; that trade should be a deliberate decision recorded
  in the design, not an emergent surprise.

### 50.10 Debugging the stack
- **Covers** — the diagnosis method layer by layer, packet capture and filtering, TLS decryption for
  debugging, HAR files and waterfall reading, `curl` timing breakdowns, distinguishing DNS, connect,
  TLS, server and transfer time, correlating client symptoms with server metrics, and building a
  hypothesis before capturing.
- **Demo** — the diagnosis workshop: a set of broken scenarios (slow DNS, TLS renegotiation loop,
  missing keep-alive, cache-key fragmentation, HOL blocking under loss, a middlebox stripping
  headers) where the learner must identify the layer from evidence before the cause is revealed.
- **Diagram** — mermaid decision flowchart from a slow-request symptom to the responsible phase.
- **Lab** — diagnose five scenarios from waterfalls and captures alone, then apply and verify the
  fix; graded on the diagnosis and the measured improvement.
- **Senior insight** — the per-phase breakdown answers "which layer" in seconds, and almost nobody
  looks at it first; a `curl -w` timing template pinned in your notes is worth more than most
  monitoring dashboards.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/web/dns.js` | Resolver, authoritative servers, caching, TTL, negative caching |
| `src/js/machines/web/tls.js` | Handshake state machine, key schedule, resumption, validation |
| `src/js/machines/web/http1.js` | Incremental parser, chunked encoding, keep-alive, smuggling checks |
| `src/js/machines/web/http2.js` | Framing, streams, flow control, HPACK |
| `src/js/machines/web/http3.js` | QUIC mapping, QPACK, stream independence |
| `src/js/machines/web/cache.js` | Freshness, validators, cache keys, `Vary`, stale-while-revalidate |
| `src/js/machines/web/cdn.js` | Edge/shield hierarchy, hit ratios, origin load, purge |
| `src/js/machines/web/realtime.js` | WebSocket framing, heartbeats, reconnection with resumption |
| `src/js/machines/web/api-protocols.js` | REST/gRPC/GraphQL payload and framing comparison |
| `src/js/viz/waterfall-view.js` | Per-request phase breakdown with RTT attribution |

---

## Acceptance criteria

- [ ] The DNS resolver's cache honours TTLs exactly, and the demo's staleness measurement matches the
      configured TTLs.
- [ ] TLS key derivation matches published test vectors; every malformed-handshake fixture is
      rejected at the correct step with the correct alert.
- [ ] The HTTP/1.1 parser rejects every request-smuggling fixture rather than choosing an
      interpretation.
- [ ] HPACK and QPACK round-trip against RFC test vectors, including dynamic-table eviction.
- [ ] Cache decisions match the fixture table for every header combination tested.
- [ ] The HTTP version comparison is run over identical link conditions, and the loss rate is stated
      with every result.
- [ ] The reconnection lab asserts no message loss and no duplicate delivery across an injected
      partition.

---

## Sources

- Grigorik — *High Performance Browser Networking*
- Mockapetris — RFCs 1034 and 1035 (DNS); RFC 8484 (DoH)
- Rescorla — RFC 8446 (TLS 1.3)
- Fielding, Reschke — RFCs 9110–9112 (HTTP semantics and HTTP/1.1)
- Belshe, Peon, Thomson — RFC 9113 (HTTP/2); Peon, Ruellan — RFC 7541 (HPACK)
- Bishop — RFC 9114 (HTTP/3); Krasic, Bishop, Frindell — RFC 9204 (QPACK)
- Fielding, Nottingham, Reschke — RFC 9111 (HTTP caching)
- Fette, Melnikov — RFC 6455 (WebSocket)
- PortSwigger — the HTTP request smuggling research
