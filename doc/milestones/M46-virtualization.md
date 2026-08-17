# M46 — Virtualisation, containers and isolation

> **Track** Operating systems · **Depends on** M43, M44 · **Sections** 9 · **Effort** L

**Outcome.** The isolation spectrum, from a hypervisor down to a WebAssembly sandbox, with the
mechanisms built rather than described: trap-and-emulate on the M34 CPU, nested page tables on the
M37 MMU, namespaces and cgroups on the M41 kernel, and an image/layer store. Ends with the
measurements that decide which isolation boundary a workload actually needs.

**Shared machinery introduced.** `machines/os/hypervisor.js` — a type-1 hypervisor over the BRV32
CPU with a VM exit/entry path, nested paging and virtio-style devices;
`machines/os/namespaces.js` and `machines/os/cgroups.js` — the container primitives over the M41
kernel; `machines/image-store.js` — content-addressed layers with an overlay file system over M44.

---

## Sections

### 46.1 Virtualisation fundamentals
- **Covers** — the virtual-machine abstraction, the Popek–Goldberg requirements (equivalence,
  resource control, efficiency), sensitive versus privileged instructions and why classic x86 was
  not virtualisable, trap-and-emulate, binary translation as the historical workaround,
  paravirtualisation, and hardware support (VT-x/AMD-V) with root and non-root modes.
- **Demo** — run a guest on the hypervisor and watch each privileged instruction trap: the exit
  reason, the emulation performed and the resume, with a cycle cost attached; a "sensitive but not
  privileged" instruction is added to the ISA to demonstrate exactly why classic x86 needed binary
  translation.
- **Diagram** — mermaid state diagram of guest execution, VM exit, hypervisor handling and VM entry.
- **Lab** — implement trap-and-emulate for the privileged instruction set; tests assert the guest's
  architectural state evolves exactly as it would natively for the fixture programs.
- **Senior insight** — the Popek–Goldberg criterion is a checklist you can apply to any ISA, and it
  is why the same hypervisor design was straightforward on some architectures and a research project
  on others.

### 46.2 Hypervisor architecture and exit costs
- **Covers** — type-1 versus type-2 hypervisors, the VM control structure and what it saves, the
  cost of a VM exit and why exit *frequency* is the performance metric, exit reasons and their
  distribution for a real workload, paravirtualised interfaces (virtio) that batch to avoid exits,
  and VM lifecycle operations (create, pause, snapshot, migrate).
- **Demo** — exit profiler: run a workload in the guest and get a histogram of exit reasons with
  total cycles attributed to each; switching an emulated device to a virtio-style ring collapses the
  I/O exit count and the CPU cost with it.
- **Diagram** — mermaid diagram of the exit-reason distribution feeding an optimisation decision.
- **Lab** — implement a virtio-style ring device replacing an emulated one; tests assert identical
  guest-visible behaviour and a measured order-of-magnitude reduction in exits per operation.
- **Senior insight** — virtualisation overhead is almost entirely exit count times exit cost;
  paravirtualised drivers exist to attack the first factor, and hardware improvements have attacked
  the second for two decades.

### 46.3 Memory virtualisation
- **Covers** — the guest-physical to host-physical layer, shadow page tables and their maintenance
  cost, nested/extended page tables and the two-dimensional walk, TLB behaviour with tagged entries,
  ballooning to reclaim guest memory, page sharing and deduplication with their side-channel
  consequences, and memory overcommit across VMs.
- **Demo** — the two-dimensional page walk: a guest virtual address resolved through guest page
  tables and then nested tables, with every memory access counted, compared against the shadow-page-
  table approach's maintenance cost on a fork-heavy workload.
- **Diagram** — mermaid diagram of the nested walk with both levels of translation.
- **Lab** — implement nested page-table translation with TLB caching; tests assert correct
  translation for all fixtures, correct fault attribution (guest fault versus host fault) and the
  expected memory-access count per walk.
- **Senior insight** — a nested TLB miss can cost up to 24 memory accesses on a four-level guest and
  host; that is why huge pages matter more inside VMs than on bare metal.

### 46.4 I/O virtualisation
- **Covers** — device emulation and its cost, paravirtualised devices and shared rings, vhost
  moving the data path into the kernel, device passthrough with an IOMMU, SR-IOV virtual functions,
  interrupt remapping, and the isolation/performance trade at each step.
- **Demo** — the I/O ladder: the same network workload through full emulation, virtio, vhost-style
  and passthrough, with throughput, latency and CPU cost per byte reported at each rung.
- **Diagram** — mermaid diagram of the data path shortening from emulation to passthrough.
- **Lab** — implement IOMMU-mediated DMA with per-device address translation; tests assert a device
  cannot DMA outside its mapped region and that a malicious descriptor is rejected rather than
  honoured.
- **Senior insight** — passthrough gives near-native performance and gives the device DMA access to
  memory; the IOMMU is the only thing between that and a full compromise, which is why it is a
  requirement rather than an optimisation.

### 46.5 Containers
- **Covers** — containers as a kernel feature rather than a product, each namespace type (pid, net,
  mnt, user, uts, ipc, cgroup, time) and exactly what it isolates, user namespaces and unprivileged
  containers, cgroup v2 controllers (cpu, memory, io, pids) and the unified hierarchy, capabilities
  as split root, seccomp filters over the syscall interface, and what containers do *not* isolate.
- **Demo** — build a container by hand: create each namespace in turn and observe what changes in
  the guest's view (process list, mounts, network interfaces, uid mapping), then apply cgroup limits
  and seccomp and watch enforcement.
- **Diagram** — mermaid diagram of a process's namespace memberships and the resources each governs.
- **Lab** — implement pid-namespace translation (a process sees itself as pid 1 while the host sees
  its real pid); tests assert consistent mapping in both directions, that processes cannot see
  outside the namespace, and correct reaping behaviour for pid 1.
- **Senior insight** — the shared kernel is the whole security story: a container is a process with
  a restricted view, and every kernel vulnerability is a potential escape, which is exactly why the
  microVM designs in 46.7 exist.

### 46.6 Images, layers and runtimes
- **Covers** — content-addressed layers, union/overlay file systems and copy-up semantics, the
  image manifest and configuration, build caching and why layer order matters for cache hits,
  reproducibility and the timestamp problem, the OCI runtime specification, `runc`'s role, registry
  push/pull with deduplication, and image size versus layer count.
- **Demo** — layer explorer: build an image step by step, watch layers created and content-addressed,
  modify one instruction and see exactly which layers are invalidated; the overlay file system's
  copy-up is shown when a lower-layer file is modified at runtime.
- **Diagram** — mermaid diagram of an overlay mount with lower, upper and merged views.
- **Lab** — implement overlay file-system semantics including copy-up and whiteouts; tests assert
  correct merged views, that lower layers are never modified, and that deletions are represented
  correctly and survive remount.
- **Senior insight** — putting `COPY . .` before dependency installation invalidates every
  subsequent layer on any source change; layer ordering is the single biggest lever on build time
  and it follows directly from content addressing.

### 46.7 Lightweight isolation
- **Covers** — the isolation spectrum and its cost/security curve, microVMs (Firecracker) with a
  minimal device model and fast boot, user-space kernels (gVisor) intercepting syscalls, WebAssembly
  sandboxes with capability-based interfaces (WASI), unikernels, language-level sandboxes and their
  weaknesses, and choosing a boundary from the threat model.
- **Demo** — the spectrum, measured: startup latency, memory overhead, syscall cost and isolation
  strength summarised for each model in the simulator, plotted as a cost/isolation curve with the
  workloads that fit each region marked.
- **Diagram** — mermaid diagram of the isolation spectrum from process to VM with the shared
  components at each level.
- **Lab** — implement a syscall-interception layer (a gVisor-style user-space kernel) for a subset
  of syscalls; tests assert the guest's observable behaviour matches the real kernel for the subset
  and that unimplemented syscalls fail closed rather than passing through.
- **Senior insight** — "fail closed" is the whole design principle for a sandbox: an unhandled case
  must deny, not fall through, and most sandbox escapes are a fall-through somewhere in the
  interception layer.

### 46.8 Isolation failures
- **Covers** — the container escape catalogue (privileged containers, host mounts, exposed sockets,
  kernel exploits, misconfigured capabilities), shared-kernel attack surface measurement via syscall
  count, side channels between tenants (from M36 and M59), noisy-neighbour resource interference as
  a weak channel, defence in depth (seccomp plus user namespaces plus mandatory access control),
  rootless containers, and the supply-chain aspect of images.
- **Demo** — the escape gallery: each misconfiguration reproduced in the simulator with the escape
  demonstrated, the specific mechanism shown, and the mitigation applied and re-tested.
- **Diagram** — mermaid diagram of the attack surface: syscalls, devices, mounts, network, shared
  caches.
- **Lab** — write a seccomp-style filter that permits exactly the syscalls a provided workload needs;
  tests assert the workload runs and that each of the seeded escape attempts is blocked.
- **Senior insight** — the syscall surface is the attack surface, and most workloads use fewer than
  fifty syscalls; a default-deny filter is the highest-value container hardening step and it is
  usually skipped because nobody measured which syscalls are needed.

### 46.9 Measuring virtualisation overhead
- **Covers** — what to measure (syscall latency, exit rate, network and disk throughput, memory
  overhead per instance, startup time, density), the difference between steady-state and startup
  costs, benchmarking inside a VM honestly (clock sources, steal time), the density-versus-isolation
  economics, and building a decision from measurements rather than defaults.
- **Demo** — the comparison table generated from live measurement in the simulator: bare process,
  container, microVM and full VM across every metric, with the density calculation (instances per
  host) derived from the memory and CPU overhead.
- **Diagram** — mermaid decision flowchart from workload and threat model to isolation choice.
- **Lab** — given three workload/threat-model pairs, choose an isolation mechanism and justify it
  with the measured numbers; graded against a rubric that requires the numbers, not the preference.
- **Senior insight** — steal time is the metric that explains "the VM is slow and the CPU is idle";
  a benchmark inside a VM that ignores it is measuring the neighbours as much as the workload.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/os/hypervisor.js` | VM exits/entries, VMCS-equivalent state, exit profiling |
| `src/js/machines/os/nested-paging.js` | Two-dimensional translation, shadow tables, tagged TLB |
| `src/js/machines/os/virtio.js` | Ring-based paravirtual devices, vhost-style fast path |
| `src/js/machines/os/iommu.js` | Device address translation and DMA containment |
| `src/js/machines/os/namespaces.js` | pid, net, mnt, user, uts, ipc isolation over the M41 kernel |
| `src/js/machines/os/cgroups.js` | cpu, memory, io, pids controllers with the unified hierarchy |
| `src/js/machines/os/seccomp.js` | Syscall filtering with allow/deny/errno actions |
| `src/js/machines/image-store.js` | Content-addressed layers, manifests, build cache |
| `src/js/machines/fs/overlayfs.js` | Union mounts, copy-up, whiteouts |
| `src/js/machines/sandbox-models.js` | MicroVM, user-space kernel, wasm sandbox cost models |

---

## Acceptance criteria

- [ ] The guest's architectural state under the hypervisor matches native execution exactly for
      every fixture program.
- [ ] Nested translation produces the same mappings as a reference model, and fault attribution
      (guest versus host) is correct in every case.
- [ ] The IOMMU test asserts that out-of-region DMA is denied, using an adversarial descriptor.
- [ ] Namespace isolation is asserted from both sides: the container cannot observe host resources,
      and the host's view remains complete.
- [ ] Overlay file-system semantics (copy-up, whiteouts, remount persistence) are asserted against a
      reference behaviour table.
- [ ] Every escape in the gallery is reproduced *and* blocked by the stated mitigation, both as
      tests.
- [ ] Overhead comparisons state their measurement conditions; a table without conditions fails
      review.

---

## Sources

- Popek, Goldberg — *Formal requirements for virtualizable third generation architectures*
- Adams, Agesen — *A comparison of software and hardware techniques for x86 virtualization*
- Barham et al. — *Xen and the art of virtualization*
- Russell — *virtio: towards a de-facto standard for virtual I/O devices*
- Agache et al. — *Firecracker: lightweight virtualization for serverless applications*
- Young et al. — *The true cost of containing: a gVisor case study*
- Linux kernel documentation on namespaces, cgroup v2 and seccomp
- The OCI Image and Runtime specifications
