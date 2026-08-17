# M48 — Link layer, IP and routing

> **Track** Networking · **Depends on** M13 · **Sections** 9 · **Effort** M

**Outcome.** A packet-level network simulator where the learner builds topologies, watches frames
and datagrams move hop by hop, runs real routing protocols and breaks links to see convergence
behaviour. Everything below the transport layer, made concrete.

**Shared machinery introduced.** `machines/net/` — a discrete-event network simulator (built on
M05's event kernel) with hosts, switches, routers, links with configurable bandwidth, latency, loss
and reordering, plus a packet builder/parser for real header formats and a capture view that renders
a packet like a protocol analyser; `viz/topology-view.js` — the interactive topology canvas reused
by M49, M54 and M56.

---

## Sections

### 48.1 Layering and encapsulation
- **Covers** — the layering model and what each layer promises, the TCP/IP stack against the OSI
  reference model, encapsulation and headers as nested envelopes, MTU and the overhead budget, the
  end-to-end argument, and where layering leaks (NAT, middleboxes, QUIC moving transport into user
  space).
- **Demo** — packet dissector: build an HTTP request and watch it wrapped in TCP, IP and Ethernet
  with every field explained and the total overhead computed as a percentage of payload for
  different payload sizes.
- **Diagram** — mermaid diagram of nested headers around a payload with byte offsets.
- **Lab** — implement the Ethernet/IP/TCP header parser and serialiser; tests assert byte-exact
  round-trips against reference packet captures, including options and padding.
- **Senior insight** — a 40-byte header on a 1-byte payload is why chatty protocols are slow; the
  overhead percentage per message size is the calculation that justifies batching, and it is
  arithmetic, not opinion.

### 48.2 The link layer
- **Covers** — Ethernet framing, MAC addresses and their scope, hubs versus switches, learning
  bridges and the MAC table, broadcast domains, spanning tree and why loops are catastrophic at
  layer 2, VLANs and trunking, ARP and its cache, ARP spoofing, and the CSMA/CD history that
  explains the frame format.
- **Demo** — build a switched LAN: watch a switch learn MAC addresses from source fields, flood
  unknown destinations and then forward directly; create a loop and watch the broadcast storm, then
  enable spanning tree and see the port blocked.
- **Diagram** — mermaid diagram of a switched topology with a loop and the STP-blocked port.
- **Lab** — implement switch learning and forwarding with ageing; tests assert unicast forwarding
  after learning, flooding for unknown destinations, correct behaviour when a host moves ports, and
  that entries age out.
- **Senior insight** — a layer-2 loop has no TTL to stop it, which is why one miscabled switch can
  take down an entire network; that absence is the reason spanning tree exists and the reason
  routing has a hop limit.

### 48.3 IP addressing
- **Covers** — IPv4 and IPv6 address formats, subnetting and CIDR with the arithmetic, prefix
  aggregation, longest-prefix-match forwarding (implemented with the radix trie from M06), special
  addresses, private ranges and RFC 1918, NAT's address translation and its state table, IPv6
  adoption realities, and dual-stack behaviour with Happy Eyeballs.
- **Demo** — subnet calculator wired to the simulator: define prefixes, assign hosts, and watch the
  forwarding table's longest-prefix matching resolve each destination with the matched prefix
  highlighted.
- **Diagram** — mermaid diagram of a routing table as a prefix trie with the longest match traced.
- **Lab** — implement longest-prefix match with a compressed trie; tests assert correct next-hop
  selection against a reference table including overlapping prefixes, default routes and IPv6
  addresses.
- **Senior insight** — longest-prefix match is why a more specific route always wins, which is both
  how traffic engineering works and how BGP hijacking works; the mechanism and the attack are the
  same rule.

### 48.4 Forwarding and the router
- **Covers** — the forwarding versus routing distinction, the router's per-packet work (TTL
  decrement, checksum, lookup, queueing), TTL and loop protection, fragmentation and path MTU
  discovery with its black-hole failure, ICMP's role and why blocking it breaks PMTUD, traceroute's
  mechanism, and queueing at the output port as the source of latency.
- **Demo** — hop-by-hop packet journey with each router's processing shown and the TTL decrementing;
  a traceroute is run and the responses assembled; a link with a smaller MTU triggers fragmentation,
  and blocking ICMP produces the classic silent stall.
- **Diagram** — mermaid sequence diagram of traceroute's increasing-TTL probes and ICMP replies.
- **Lab** — implement path MTU discovery with the ICMP feedback loop; tests assert the correct MTU
  is discovered, that the black-hole case (ICMP filtered) is detected by the fallback, and that
  packets are never silently dropped without a diagnosis.
- **Senior insight** — "large requests hang and small ones work" is the PMTUD black-hole signature,
  and it is caused by a firewall dropping ICMP; it is the most misdiagnosed network problem in
  application engineering.

### 48.5 Intra-domain routing
- **Covers** — distance-vector routing with Bellman–Ford (from M13), the count-to-infinity problem
  and its mitigations (split horizon, poison reverse, hold-down), link-state routing with flooding
  and Dijkstra, OSPF areas, convergence time and transient loops, ECMP, and the metric-design
  question.
- **Demo** — protocol comparison on the same topology: distance-vector and link-state both converge,
  then a link fails and the count-to-infinity behaviour is visible in one and not the other, with
  convergence time and message counts reported.
- **Diagram** — mermaid diagram of the count-to-infinity exchange between two routers.
- **Lab** — implement link-state flooding with sequence numbers and ageing, plus the Dijkstra
  computation; tests assert every router converges to the same shortest-path tree, that stale
  advertisements are rejected, and that convergence completes within the expected message count.
- **Senior insight** — convergence time is a service-availability property: during convergence,
  loops and blackholes exist, and every "brief unexplained outage after a link flap" is that window.

### 48.6 Inter-domain routing
- **Covers** — autonomous systems and why policy beats shortest path, BGP as a path-vector protocol,
  route advertisement and withdrawal, AS-path loop prevention, the customer/peer/provider
  relationships and the valley-free rule, local preference and MED, route flap damping, route leaks
  and prefix hijacks with real incidents, RPKI and route origin validation, and BGP's convergence
  behaviour.
- **Demo** — a multi-AS topology with policies: watch route selection follow local preference rather
  than path length, then inject a more-specific hijack and watch traffic redirect globally; enable
  RPKI validation and watch the invalid route be rejected.
- **Diagram** — mermaid diagram of AS relationships with the valley-free path rule illustrated.
- **Lab** — implement BGP path selection with the standard tie-breaking order; tests assert the
  selected route matches a reference decision process for fixture advertisements, including the
  policy-over-length cases.
- **Senior insight** — BGP has no notion of truth: it believes what it is told, which is why prefix
  hijacks work and why the fixes (RPKI, filtering) are about attesting to origin rather than
  verifying paths.

### 48.7 Multicast, broadcast and anycast
- **Covers** — the delivery models, broadcast domains and their scaling limit, IP multicast with
  group management and distribution trees, why multicast never took off on the public internet,
  application-level multicast and gossip (previewing M56), anycast with the same address advertised
  from many locations, and anycast's use for DNS root servers and CDNs.
- **Demo** — anycast in the simulator: several sites advertise the same prefix, clients are routed
  to the topologically nearest one, and withdrawing a site's advertisement fails traffic over with
  the convergence time measured.
- **Diagram** — mermaid diagram of anycast routing from clients to the nearest advertising site.
- **Lab** — implement anycast site selection driven by the routing table and measure failover time
  after a withdrawal; tests assert every client reaches the nearest site and that failover completes
  within the convergence bound.
- **Senior insight** — anycast failover is routing convergence, not a load balancer decision, so it
  is fast for whole-site failure and useless for partial failure — the site that is up but broken
  keeps receiving traffic.

### 48.8 NAT, middleboxes and overlays
- **Covers** — NAT's translation table and port allocation, NAT types and their traversal
  implications, STUN, TURN and ICE for peer-to-peer connectivity, firewalls and stateful inspection,
  proxies (forward, reverse, transparent), load balancers at layer 4 versus layer 7, tunnels and
  VPNs (encapsulation revisited), overlay networks (VXLAN) for container networking, and the
  ossification middleboxes cause.
- **Demo** — NAT traversal walkthrough: two hosts behind different NATs attempt a direct connection,
  STUN discovers the mappings, hole punching succeeds for one NAT type and fails for another,
  falling back to a TURN relay — all visible as packets in the simulator.
- **Diagram** — mermaid sequence diagram of ICE candidate gathering, connectivity checks and the
  chosen path.
- **Lab** — implement NAT with endpoint-independent mapping and the hole-punching exchange; tests
  assert connectivity succeeds for the compatible NAT pairing and that the fallback relay is used
  otherwise.
- **Senior insight** — middlebox ossification is why QUIC runs over UDP and encrypts almost
  everything: any field a middlebox can see, some middlebox will eventually depend on, and that
  freezes the protocol.

### 48.9 The network laboratory
- **Covers** — putting it together: build a topology, configure addressing and routing, generate
  traffic, inject failures (link down, flapping, congestion, misconfiguration), observe convergence
  and packet loss, and read a capture to diagnose — plus the discipline of forming a hypothesis
  before capturing.
- **Demo** — the lab itself: a scenario library of broken networks (asymmetric route, MTU black
  hole, ARP conflict, routing loop, hijacked prefix) where the learner must diagnose from captures
  and topology state before the answer is revealed.
- **Diagram** — mermaid decision flowchart for network diagnosis from symptom to layer.
- **Lab** — diagnose five broken scenarios from capture evidence alone and propose the fix; graded
  on both the diagnosis and whether the applied fix restores connectivity in the simulator.
- **Senior insight** — diagnose by layer, bottom up, and confirm each layer before moving up; the
  reason network debugging feels like guesswork is that people start at the application and never
  check whether ARP resolved.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/net/sim.js` | Event-driven network simulator, links with loss/latency/reordering |
| `src/js/machines/net/packet.js` | Header parsers and builders for Ethernet, IP, ARP, ICMP |
| `src/js/machines/net/switch.js` | MAC learning, flooding, ageing, spanning tree |
| `src/js/machines/net/router.js` | Forwarding table, longest-prefix match, TTL, fragmentation, queues |
| `src/js/algorithms/routing-protocols.js` | Distance vector, link state, BGP path selection |
| `src/js/machines/net/nat.js` | Translation table, NAT types, STUN/TURN/ICE exchange |
| `src/js/machines/net/capture.js` | Capture buffer with protocol-analyser-style rendering |
| `src/js/viz/topology-view.js` | Interactive topology with live packet animation |
| `src/js/viz/packet-view.js` | Byte-level packet inspector with field highlighting |

---

## Acceptance criteria

- [ ] Header parsers round-trip byte-exactly against reference captures for every supported
      protocol.
- [ ] Longest-prefix match agrees with a reference implementation over randomised prefix sets,
      including IPv6 and default routes.
- [ ] Routing protocols converge to the same shortest-path result as a direct Dijkstra computation
      on every topology, and convergence time and message counts are reported.
- [ ] The count-to-infinity fixture reproduces the problem for distance vector and demonstrates each
      mitigation's effect.
- [ ] The PMTUD black-hole scenario is detected and diagnosed by the implementation rather than
      hanging.
- [ ] BGP path selection matches the reference decision order for all fixture advertisements,
      including policy overrides.
- [ ] Every diagnostic scenario in 48.9 has a verifiable fix that the simulator confirms.

---

## Sources

- Kurose, Ross — *Computer Networking: A Top-Down Approach*
- Peterson, Davie — *Computer Networks: A Systems Approach*
- Saltzer, Reed, Clark — *End-to-end arguments in system design*
- Perlman — the spanning-tree algorithm
- RFCs 791, 792, 826, 1918, 4271 (BGP), 8200 (IPv6), 8305 (Happy Eyeballs)
- Rekhter, Li, Hares — BGP-4; RFC 6480 (RPKI)
- Rosenberg — RFC 8445 (ICE), RFC 5389 (STUN)
