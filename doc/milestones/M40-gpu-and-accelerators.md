# M40 — GPUs, SIMD and domain-specific accelerators

> **Track** Computer architecture · **Depends on** M37 · **Sections** 9 · **Effort** L

**Outcome.** Data-parallel hardware, ending with real WebGPU compute kernels the learner writes,
runs and optimises in the browser with measured bandwidth and occupancy. The theme is that
accelerators are not "faster CPUs" — they are machines with a different cost model, and using them
well means programming to that model.

**Shared machinery introduced.** `machines/simd-sim.js` — a vector-lane simulator with masking and
gather/scatter; `machines/gpu-sim.js` — a SIMT model (warps, divergence, occupancy, memory
coalescing, shared-memory banks) that runs kernels written in a small kernel DSL and reports
efficiency metrics; `machines/webgpu-runner.js` — real WebGPU execution with capability detection
and a CPU fallback path so the sections still work without WebGPU.

> **Availability note.** WebGPU is not present in every browser. Every section works fully against
> the simulator; the real-hardware panels detect support and, when it is missing, state so plainly
> and run the same kernel on the CPU fallback rather than pretending.

---

## Sections

### 40.1 SIMD and vectorisation
- **Covers** — vector registers and lanes, the SIMD execution model, width and element types,
  masking for conditionals, horizontal versus vertical operations, alignment requirements,
  gather/scatter and their cost, auto-vectorisation and why it fails (aliasing, dependences,
  control flow, reductions), intrinsics, and WebAssembly SIMD in the browser.
- **Demo** — vectorisation walkthrough: a scalar loop shown lane by lane as it is vectorised, with
  the tail handling, the masked-conditional version, and a data-dependent case the vectoriser must
  refuse; instruction counts compared.
- **Diagram** — mermaid diagram of four lanes processing four elements with a mask applied.
- **Lab** — vectorise a loop with a conditional using masking in the simulator; tests assert
  identical results to the scalar version and a 4× reduction in executed operations.
- **Senior insight** — the reason a loop does not vectorise is usually aliasing the compiler cannot
  rule out; that is the same alias-analysis limit from M29, and it is why `restrict`, ownership and
  SoA layouts pay off in generated code.

### 40.2 The SIMT execution model
- **Covers** — threads, warps/wavefronts, blocks/workgroups and grids, the single-instruction
  multiple-thread model, branch divergence and reconvergence, predication, occupancy and its
  relationship to latency hiding, the register-file-as-scarce-resource, and why GPUs tolerate
  hundreds of cycles of memory latency.
- **Demo** — divergence visualiser: a kernel with a data-dependent branch executed warp by warp with
  active masks displayed per step, showing the serialisation cost; restructuring the data to make
  the branch warp-uniform removes it and the cycle count drops.
- **Diagram** — mermaid diagram of a warp diverging into two paths and reconverging.
- **Lab** — restructure a divergent kernel to be warp-uniform; tests assert identical output and a
  measured reduction in divergent cycles in the simulator.
- **Senior insight** — a GPU hides latency with occupancy rather than with caches and speculation;
  that inverts the optimisation advice from the CPU chapters, where more in-flight state is
  expensive rather than the point.

### 40.3 GPU memory hierarchy
- **Covers** — global, shared/workgroup, local/private and constant memory with their latency and
  scope, memory coalescing rules and the cost of a strided or scattered access, shared-memory bank
  conflicts and padding as the fix, the read-only/texture path, atomics on GPU memory, and the
  bandwidth-bound reality of most kernels.
- **Demo** — coalescing laboratory: the same kernel with sequential, strided and random access
  patterns, with transactions per warp, achieved bandwidth and effective utilisation reported; a
  bank-conflict view shows shared-memory access patterns colliding and being fixed by padding.
- **Diagram** — mermaid diagram of a coalesced versus a strided warp access mapping to memory
  transactions.
- **Lab** — fix a bank-conflicting shared-memory access by padding; tests assert identical results
  and conflict-free access verified by the simulator's bank model.
- **Senior insight** — coalescing is the single largest lever in GPU performance, and it is decided
  by data layout, not by kernel code; getting the layout right before writing the kernel is the
  whole game.

### 40.4 Writing compute kernels
- **Covers** — the WebGPU compute pipeline (buffers, bind groups, workgroup sizing, dispatch),
  WGSL basics, workgroup barriers and the rules about barrier divergence, shared-memory tiling,
  the tiled matrix-multiply as the canonical example, workgroup-size selection, and correctness
  pitfalls (missing barriers, out-of-range indexing, race on shared memory).
- **Demo** — kernel workbench: write or edit a WGSL compute kernel, run it on real hardware where
  available, and see results, timing and a CPU-reference comparison; a missing-barrier variant is
  included and its non-deterministic wrong results are shown across runs.
- **Diagram** — mermaid diagram of a tiled matrix multiply's shared-memory staging per workgroup.
- **Lab** — implement tiled matrix multiplication in WGSL; tests assert numerical agreement with the
  CPU reference within tolerance and a measured speed-up over the naive kernel.
- **Senior insight** — the missing-barrier bug produces *mostly* correct results, which makes it the
  GPU equivalent of a data race; the fix is the same discipline as M38 — reason about the
  synchronisation, do not test for it.

### 40.5 Performance modelling and the roofline
- **Covers** — arithmetic intensity (operations per byte), the roofline model with its compute and
  bandwidth ceilings, placing a kernel on the roofline, identifying memory-bound versus
  compute-bound, the effect of caching and data reuse on intensity, measuring achieved bandwidth
  honestly, and using the model to predict whether an optimisation can possibly help.
- **Demo** — the roofline plotter: several kernels measured and placed on the roofline for the
  detected device, with each optimisation step moving a point and the ceiling it is approaching
  named.
- **Diagram** — mermaid diagram of a roofline with compute and bandwidth ceilings and kernels placed
  on it.
- **Lab** — compute the arithmetic intensity of three kernels analytically and predict which
  optimisation helps each; tests assert the predictions match the measured outcomes.
- **Senior insight** — the roofline tells you when to stop: a kernel sitting on the bandwidth ceiling
  cannot be improved by better arithmetic, and knowing that saves days of pointless tuning.

### 40.6 Parallel primitives
- **Covers** — reduction with tree-based and warp-shuffle approaches, prefix scan (from M21) on
  GPUs, sorting (radix and bitonic from M10) in a data-parallel style, histograms and atomic
  contention, stream compaction, segmented operations, and the composition of primitives into
  larger algorithms.
- **Demo** — the primitive gallery: each primitive implemented and run at several sizes with
  measured throughput and the algorithmic step count shown; a naive atomic-histogram version is
  compared with a privatised one to show contention's cost.
- **Diagram** — mermaid diagram of a tree reduction across workgroups with the second-pass
  aggregation.
- **Lab** — implement a two-pass parallel reduction (workgroup reduce, then reduce the partials);
  tests assert exact agreement with the CPU sum for integers and a stated tolerance for floats —
  including a note that the float result differs by summation order (M17).
- **Senior insight** — parallel float reductions are not reproducible run to run because the
  summation order changes; that is a correctness property to document, not a bug to chase.

### 40.7 Heterogeneous programming
- **Covers** — the host/device split, transfer cost and PCIe/unified-memory realities, staging and
  pinned buffers, overlapping transfer with compute, kernel-launch overhead and why small kernels
  lose, deciding what to offload with a break-even calculation, keeping data resident on the device,
  and the equivalent decisions in the browser (worker offload, transferables from M00).
- **Demo** — offload calculator: for a given problem size and arithmetic intensity, compute and then
  measure the break-even point where GPU execution beats CPU including transfer; the crossover is
  plotted and is often much larger than learners expect.
- **Diagram** — mermaid sequence diagram of overlapped transfer and compute across two streams.
- **Lab** — restructure a workload to keep intermediate results on the device across three kernels;
  tests assert identical final results and a measured reduction in total transferred bytes.
- **Senior insight** — the transfer, not the kernel, decides most offload questions; a 50× faster
  kernel loses if the data has to cross the bus twice for every call.

### 40.8 Domain-specific accelerators
- **Covers** — why fixed-function hardware wins on energy per operation, systolic arrays and the
  matrix-multiply unit, TPU-style architectures, dataflow accelerators, FPGAs and the
  reconfigurability trade-off, reduced precision (fp16, bf16, int8) and quantisation error, sparsity
  support, and the general framework for deciding whether an accelerator suits a workload.
- **Demo** — systolic-array simulator: matrix multiply flowing through a 2-D array of processing
  elements with data reuse visualised, and the operations-per-byte advantage over a general core
  computed for the same problem.
- **Diagram** — mermaid diagram of data flowing through a systolic array with weights stationary.
- **Lab** — implement the weight-stationary dataflow schedule for a small systolic array; tests
  assert correct matrix products and the expected number of memory reads (far fewer than the naive
  schedule).
- **Senior insight** — the accelerator's advantage is data reuse inside the array, not raw
  arithmetic: the same multiply-accumulate happens, but each operand is read from memory once
  instead of n times.

### 40.9 Optimising one kernel end to end
- **Covers** — the full optimisation methodology on a single realistic kernel: baseline
  measurement, roofline placement, coalescing fix, shared-memory tiling, occupancy tuning,
  loop unrolling, precision choice, and the final honest comparison — including the steps that
  turned out not to help.
- **Demo** — the case study, replayable: each optimisation step applied in order with the measured
  effect, the roofline position, and the reason it helped or did not; the learner can reorder steps
  and see that the order changes the attribution.
- **Diagram** — mermaid flowchart of the optimisation loop (measure → model → change → verify).
- **Lab** — take a provided baseline kernel to a stated performance target using the methodology;
  graded on correctness first, then measured throughput, with a required written attribution of
  which step contributed what.
- **Senior insight** — attribution is the discipline: applying five optimisations and measuring once
  tells you nothing about which four were pointless, and pointless optimisations are permanent
  complexity.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/simd-sim.js` | Lanes, masking, gather/scatter, vectorisation legality checks |
| `src/js/machines/gpu-sim.js` | Warps, divergence, occupancy, coalescing, bank conflicts |
| `src/js/machines/webgpu-runner.js` | Real WebGPU execution, capability detection, CPU fallback |
| `src/js/machines/systolic-sim.js` | Processing-element array with dataflow schedules |
| `src/js/algorithms/gpu-primitives.js` | Reduction, scan, sort, histogram, compaction (kernel DSL) |
| `src/js/algorithms/roofline.js` | Intensity computation, ceiling measurement, placement |
| `src/js/viz/warp-view.js` | Per-warp lane activity and divergence timeline |
| `src/js/viz/roofline-view.js` | Roofline plot with kernel points and optimisation trajectory |

---

## Acceptance criteria

- [ ] Every kernel's result is validated against a CPU reference, with an explicit tolerance for
      floating point and a note about non-deterministic reduction order.
- [ ] The WebGPU panels detect support and degrade to the simulator or CPU path with a visible
      statement — never a silent fallback or a fabricated timing.
- [ ] Coalescing, divergence, occupancy and bank conflicts are reported as measured counters from
      the simulator, and the fixes show measured improvement.
- [ ] Roofline ceilings are measured on the actual device (or the simulator's configured model), not
      taken from a specification sheet, and the source is labelled.
- [ ] The missing-barrier demo produces observably different results across runs, and the corrected
      version is deterministic across 100 runs.
- [ ] The end-to-end case study reports per-step attribution, and the harness fails a submission that
      reports only a final number.

---

## Sources

- Hennessy, Patterson — *Computer Architecture*, chapter 4 (data-level parallelism)
- Kirk, Hwu — *Programming Massively Parallel Processors*
- Williams, Waterman, Patterson — *Roofline: an insightful visual performance model*
- Jouppi et al. — *In-datacenter performance analysis of a tensor processing unit*
- NVIDIA CUDA C++ Programming Guide (for the SIMT model and coalescing rules)
- The WebGPU and WGSL specifications
- Harris — *Optimizing parallel reduction in CUDA*
