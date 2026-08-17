# M59 — Security engineering and side channels

> **Track** Engineering practice · **Depends on** M23, M50 · **Sections** 11 · **Effort** L

**Outcome.** Security as an engineering discipline: model the threat, know the vulnerability
classes and their mechanisms, build the defences, and verify them. Every vulnerability is
reproduced in a sandboxed lab application inside the simulator and then fixed, because a defence
you have never seen fail is a belief rather than a control.

**Scope and ethics.** Everything runs against the platform's own deliberately vulnerable lab app in
a local sandbox. The material is defensive: understanding an attack's mechanism is what makes the
mitigation checkable. No section provides tooling aimed at systems the learner does not control, and
each exploit lab ends with the fix and a test that proves it.

**Shared machinery introduced.** `machines/sec/labapp/` — an intentionally vulnerable application
(server, database, templating, auth) running entirely in the simulator; `machines/sec/attack-lab.js`
— attack drivers with a verdict oracle (did the exploit succeed) so both the vulnerability and the
fix are asserted; `machines/sec/threat-model.js` — a structured threat-model builder.

---

## Sections

### 59.1 Threat modelling
- **Covers** — assets, actors and trust boundaries, data-flow diagrams as the modelling artefact,
  STRIDE per element, attack trees, likelihood and impact ranking without pretending to precision,
  turning threats into security requirements and then into tests, and keeping the model alive as the
  system changes.
- **Demo** — the threat-model builder: draw a data-flow diagram for the lab app, and the tool
  enumerates STRIDE categories per element with the applicable threats, linking each to the section
  that covers it and to the lab that demonstrates it.
- **Diagram** — mermaid diagram of a data-flow diagram with trust boundaries crossed by each flow.
- **Lab** — produce a threat model for a described system and derive at least one testable security
  requirement per trust boundary; graded against a rubric covering boundary identification and
  requirement testability.
- **Senior insight** — the trust boundary is where the model earns its keep: every input crossing
  one is untrusted, and most vulnerabilities in this milestone are a boundary that someone did not
  notice was a boundary.

### 59.2 Authentication
- **Covers** — password storage (from M23) and credential-stuffing economics, multi-factor
  authentication with TOTP and WebAuthn/passkeys, session cookies versus tokens with their
  respective attack surfaces, JWT's specific pitfalls (`alg: none`, key confusion, no revocation,
  claims trusted without validation), OAuth 2.0 and OIDC flow selection (authorisation code with
  PKCE, and why implicit died), refresh-token rotation and reuse detection, and account-recovery as
  the weakest link.
- **Demo** — the JWT attack bench: forge a token via the `alg: none` bug, via algorithm confusion
  (HS256 signed with the RSA public key) and via a weak secret; each attack succeeds against the
  naive verifier and fails against the corrected one.
- **Diagram** — mermaid sequence diagram of the authorisation-code-with-PKCE flow with the attack
  points annotated.
- **Lab** — implement a correct JWT verifier (explicit algorithm allow-list, audience and issuer
  checks, expiry, clock skew) and a session store with rotation; tests assert every forged token in
  the fixture set is rejected and valid tokens are accepted.
- **Senior insight** — a JWT verifier that trusts the token's own `alg` header is asking the
  attacker which lock to use; pinning the algorithm is a one-line fix and it is missing from a
  startling amount of production code.

### 59.3 Authorisation
- **Covers** — the distinction from authentication, RBAC, ABAC and ReBAC with their scaling
  properties, policy engines and centralised decision points, least privilege in practice, the
  confused-deputy problem, insecure direct object references as the most common real-world flaw,
  multi-tenant isolation and the row-level-security question, authorisation in aggregate/list
  endpoints, and testing authorisation systematically.
- **Demo** — the IDOR lab: change an identifier in a request and access another tenant's data,
  then apply each defence (ownership check, scoped queries, policy engine) and re-run the attack
  matrix showing which endpoints are still exposed.
- **Diagram** — mermaid diagram of a request evaluated against a policy with subject, action,
  resource and context.
- **Lab** — implement an authorisation layer with a deny-by-default policy and per-resource
  ownership checks; tests assert the full cross-tenant access matrix (every user against every
  resource) yields exactly the intended permissions.
- **Senior insight** — testing authorisation means testing the *matrix*, not the happy path; nearly
  every IDOR exists because the test suite only ever asked whether the owner could access the
  resource.

### 59.4 Injection and cross-site scripting
- **Covers** — injection as a failure to separate code from data, SQL injection with parameterised
  queries as the actual fix (and why escaping is not), command and template injection, ORM
  injection surfaces, XSS types (reflected, stored, DOM-based) with their differing mitigations,
  context-aware output encoding, Content Security Policy and its bypasses, trusted types, and
  sanitisation versus encoding.
- **Demo** — the injection bench: exploit each injection class against the lab app with the payload
  and its effect visible, then apply the correct fix per class and watch the same payloads become
  inert; a CSP is added and a bypass attempt is shown against a permissive policy.
- **Diagram** — mermaid diagram of the same data flowing into four output contexts with the correct
  encoding for each.
- **Lab** — fix the lab app's injection vulnerabilities using parameterisation and context-aware
  encoding; tests assert every payload in the attack corpus is neutralised and that legitimate input
  containing the same characters still works.
- **Senior insight** — escaping depends on the output context (HTML body, attribute, JavaScript,
  URL, CSS), and a single sanitiser applied everywhere is wrong in at least three of them; the fix
  is encoding at the point of output, not filtering at the point of input.

### 59.5 Request-forgery and browser-boundary attacks
- **Covers** — CSRF's mechanism and the token and SameSite defences, SSRF and its cloud-metadata
  consequences with allow-list-based egress control, CORS as a relaxation mechanism (not a defence)
  and its common misconfigurations, clickjacking and frame ancestors, open redirects as an
  amplifier, prototype pollution and unsafe deserialisation, path traversal, and file-upload
  handling.
- **Demo** — the browser-boundary lab: each attack executed against the vulnerable app in an
  isolated frame — CSRF submitting a state-changing request, SSRF reaching an internal service,
  a CORS misconfiguration leaking a response — followed by each mitigation and a re-run.
- **Diagram** — mermaid sequence diagram of a CSRF attack and the SameSite/token defence points.
- **Lab** — implement SSRF protection with a destination allow-list, DNS-rebinding-resistant
  resolution and redirect following disabled; tests assert every internal address in the attack
  corpus is blocked, including decimal, IPv6-mapped and DNS-rebinding forms.
- **Senior insight** — blocking SSRF by string-matching the URL fails to every encoding trick and to
  DNS rebinding; the defence has to be at connection time against the resolved address, which is a
  different layer than most implementations choose.

### 59.6 Memory-safety bug classes
- **Covers** — the classes that dominate CVEs in native code: buffer overflow (stack and heap),
  use-after-free, double free, integer overflow leading to undersized allocation, off-by-one, format
  strings, and type confusion; exploitation concepts at the level needed to understand mitigations
  (ASLR, stack canaries, NX, CFI); why memory-safe languages remove the class; and the equivalents
  that persist in safe languages (unsafe blocks, FFI boundaries, logic-level overflows from M17).
- **Demo** — in the M43 heap simulator: an overflow corrupts allocator metadata and redirects a
  subsequent allocation, shown byte by byte; then the hardened allocator (redzones, out-of-band
  metadata) detects the same overflow at the moment it happens.
- **Diagram** — mermaid diagram of a heap chunk overflow reaching the adjacent chunk's header.
- **Lab** — add bounds checking and integer-overflow checks to a provided unsafe routine; tests
  assert every seeded corruption in the fixture set is prevented or detected, and that the checks
  themselves do not overflow.
- **Senior insight** — the integer overflow before the allocation is the actual bug in a large
  fraction of heap overflows: `size * count` wraps, a small buffer is allocated, and the copy is
  the symptom rather than the cause.

### 59.7 Secrets and key management
- **Covers** — where secrets live (environment variables, files, secret managers, KMS/HSM) and the
  exposure of each, secret rotation and the code changes it requires, envelope encryption and data
  keys, encryption at rest and in transit and what each protects against, secrets in source control
  and history rewriting, detection scanning, leaked-credential response, and least-privilege
  credentials with short lifetimes.
- **Demo** — the leak drill: a credential is committed, detected by the scanner, and the response
  timeline is walked through (revoke, rotate, assess exposure, rewrite history) with the exposure
  window measured for each response speed.
- **Diagram** — mermaid diagram of envelope encryption with the data key wrapped by the master key.
- **Lab** — implement envelope encryption with key rotation that does not require re-encrypting the
  data; tests assert data encrypted under an old data key remains readable after master-key rotation
  and that a revoked key's data is provably unrecoverable.
- **Senior insight** — rotation is the requirement that reveals whether your key management is
  real: if rotating a key requires a code change or a full re-encryption, it will never be done, and
  the key will be twelve years old when it leaks.

### 59.8 Supply chain
- **Covers** — the dependency attack surface, typosquatting and dependency confusion, lockfiles and
  integrity hashes, transitive dependency risk and the size of a typical tree, SBOMs, reproducible
  builds and why they matter, artefact signing and verification (Sigstore-style), CI/CD as a
  high-privilege attack surface, protected branches and review requirements, and the practical
  policy for evaluating a new dependency.
- **Demo** — the dependency-confusion scenario: an internal package name is claimed publicly and a
  build resolves to it, with the resolution order shown; a scoped registry configuration and
  integrity pinning then make the same attack fail.
- **Diagram** — mermaid diagram of the build pipeline's trust boundaries from source to artefact.
- **Lab** — implement lockfile verification with integrity hashes and a resolution policy that
  prefers the internal registry; tests assert the confusion attack fails, that a tampered artefact
  is rejected, and that a legitimate upgrade still succeeds.
- **Senior insight** — CI has credentials to production and executes arbitrary code from your
  dependency tree; treating the build system as a lower-security environment than production is
  backwards, and it is the standard configuration.

### 59.9 Side channels
- **Covers** — the general shape (a shared resource leaks information through an observable), timing
  channels and constant-time programming (from M23), cache-timing attacks (from M36), speculative-
  execution channels and the browser-side mitigations (cross-origin isolation, reduced timer
  resolution, `SharedArrayBuffer` gating), compression side channels (CRIME/BREACH), error-message
  and response-size oracles, and threat-modelling for a side channel.
- **Demo** — the compression oracle: a secret inside a compressed response is recovered byte by byte
  from response-size differences in the lab app, then prevented by separating the secret from
  attacker-controlled content.
- **Diagram** — mermaid diagram of a compression oracle: guess included, size shrinks, guess
  confirmed.
- **Lab** — implement a constant-time comparison and a response-shaping mitigation; tests assert
  timing variance across secret values is within noise and that response size no longer correlates
  with the secret's content.
- **Senior insight** — compressing a response that mixes a secret with attacker-controlled input
  leaks the secret through size alone; the mitigation is structural (do not mix them), because no
  amount of encryption helps when the length is the channel.

### 59.10 Detection and response
- **Covers** — logging for security (what to log, what never to log), audit trails and their
  integrity, detecting anomalies without drowning in false positives, alerting on the signals that
  matter, incident response phases (detect, contain, eradicate, recover, learn), forensic
  preservation, blameless post-incident review, and secure defaults plus defence in depth as the
  design posture.
- **Demo** — the incident drill: an attack runs against the lab app, the detection signals appear in
  the logs, the responder works through containment and eradication with the timeline recorded, and
  the exposure window is computed for different detection latencies.
- **Diagram** — mermaid diagram of the incident-response phases with the artefacts produced at each.
- **Lab** — instrument the lab app with security logging sufficient to reconstruct an attack; tests
  assert the recorded events allow the full attack path to be reconstructed and that no secret or
  credential appears in any log line.
- **Senior insight** — the most common logging failure is both directions at once: the audit trail
  lacks what is needed to reconstruct the incident, and it contains tokens and personal data that
  make the logs themselves a liability.

### 59.11 Secure design workshop
- **Covers** — putting it together on a realistic design: threat model, abuse cases alongside use
  cases, security requirements as acceptance criteria, a security-focused code review of the lab
  app, prioritising fixes by exploitability and impact, security testing in CI (SAST-style checks
  from M32, dependency scanning, the attack corpus as a test suite), and writing a security section
  for a design document.
- **Demo** — the workshop: a complete design reviewed end to end, with each finding linked to its
  vulnerability class, its lab reproduction and its fix, and the resulting requirement expressed as
  a test.
- **Diagram** — mermaid flowchart from design through threat model and abuse cases to tests in CI.
- **Lab** — perform a security review of a provided design and codebase, producing findings with
  severity, reproduction and fix; graded against a hidden ground-truth finding list, with credit for
  correct severity assignment and penalties for unsupported findings.
- **Senior insight** — the reviewable artefact is the abuse case: "an attacker with a valid account
  changes the id in this request and reads another tenant's data" is testable, assignable and
  closeable, while "improve authorisation" is none of those.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/sec/labapp/` | Deliberately vulnerable app: routes, templating, DB, auth, uploads |
| `src/js/machines/sec/attack-lab.js` | Attack drivers, payload corpora, success/failure oracle |
| `src/js/machines/sec/threat-model.js` | DFD builder, STRIDE enumeration, requirement generation |
| `src/js/algorithms/auth-tokens.js` | JWT verification, session management, PKCE, rotation |
| `src/js/algorithms/authz.js` | RBAC/ABAC/ReBAC evaluation, deny-by-default policy engine |
| `src/js/algorithms/output-encoding.js` | Context-aware encoders and a CSP builder |
| `src/js/algorithms/ssrf-guard.js` | Address allow-listing, rebinding-resistant resolution |
| `src/js/algorithms/envelope-crypto.js` | Data keys, master-key wrapping, rotation |
| `src/js/machines/sec/supply-chain.js` | Lockfile verification, resolution policy, signature checks |
| `src/js/machines/sec/detection.js` | Security event model, log integrity, redaction checks |

---

## Acceptance criteria

- [ ] Every vulnerability is *reproduced* by the attack lab (the oracle confirms the exploit
      succeeded) before its fix is applied, and a test asserts the fix defeats the same corpus.
- [ ] The authorisation lab tests the complete access matrix, not sampled paths.
- [ ] The SSRF guard blocks every encoding and rebinding variant in the corpus.
- [ ] JWT verification rejects all forged tokens in the fixture set, including algorithm confusion
      and key-substitution cases.
- [ ] Constant-time comparisons are validated by timing-variance measurement, not by inspection.
- [ ] Security logging tests assert both reconstructability and the absence of secrets, with a
      redaction check over every log line.
- [ ] All labs run entirely locally against the bundled lab app; the harness fails if any test
      attempts an external request.

---

## Sources

- Shostack — *Threat Modeling: Designing for Security*
- OWASP — Top 10, ASVS, and the Cheat Sheet Series
- Stuttard, Pinto — *The Web Application Hacker's Handbook*
- Anderson — *Security Engineering*
- Aumasson — *Serious Cryptography* (for the primitive-level material shared with M23)
- Rizzo, Duong — the CRIME/BREACH compression-oracle research
- Google — the BeyondCorp papers; SLSA and Sigstore documentation
- Kocher et al. — *Spectre attacks* (browser mitigations context)
