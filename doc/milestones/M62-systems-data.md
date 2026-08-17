# M62 — Systems data: Unicode, time, serialisation, RNG and IDs

> **Track** Engineering practice · **Depends on** M17, M22 · **Sections** 10 · **Effort** M

**Outcome.** The data-handling substrate that every application touches and almost every one gets
subtly wrong. These are not advanced topics — they are the ones that produce corrupted names,
duplicated orders at 2 a.m. on the last Sunday of October, and "it worked until a user in Turkey
signed up".

**Shared machinery introduced.** `machines/data/text-lab.js` — a Unicode inspector and
normalisation/collation playground with a bundled subset of the Unicode data files;
`machines/data/time-lab.js` — a timezone-aware clock with a bundled tz-database subset, DST
transition scenarios and a leap-second model; `machines/data/codec-bench.js` — serialisation format
comparison for size, speed and compatibility.

---

## Sections

### 62.1 Unicode fundamentals
- **Covers** — characters, code points, code units and grapheme clusters as four different things,
  the planes and the BMP, UTF-8's design and self-synchronisation, UTF-16 and surrogate pairs,
  UTF-32, JavaScript strings as UTF-16 code units with the consequences (`length`, indexing,
  `split('')`), correct iteration with the string iterator and `Intl.Segmenter`, and byte-versus-
  character length limits.
- **Demo** — the string inspector: type any text and see bytes, code units, code points and grapheme
  clusters side by side with their counts, including emoji with skin-tone modifiers and ZWJ
  sequences where all four counts differ.
- **Diagram** — mermaid diagram of one grapheme cluster decomposing into code points, UTF-16 units
  and UTF-8 bytes.
- **Lab** — implement grapheme-cluster segmentation for the common cases (combining marks, regional
  indicators, ZWJ sequences); tests assert the cluster count matches the Unicode reference data for
  the fixture set, which naive code-point counting fails.
- **Senior insight** — `"👨‍👩‍👧".length` is 8 in JavaScript, and truncating a string by code units
  splits a family emoji into fragments; every "..." truncation in a UI is a grapheme-boundary
  problem waiting for the right input.

### 62.2 Normalisation, case and collation
- **Covers** — canonical and compatibility equivalence, the four normalisation forms and when each
  applies, why comparison requires normalisation first, case folding versus lowercasing and the
  Turkish dotless-i problem, locale-aware collation with CLDR, sorting that differs by locale,
  `Intl.Collator` and its options, security implications (homoglyph confusables, normalisation
  before or after a security check), and normalising at the boundary.
- **Demo** — the equality matrix: several visually identical strings compared under `===`,
  normalised comparison, case-folded comparison and locale collation, with the results differing
  across the row; the Turkish-locale case-folding trap is one of the entries.
- **Diagram** — mermaid flowchart of the normalise → fold → compare pipeline with the failure points
  if the order changes.
- **Lab** — implement a canonical identity comparison (normalise, case-fold, compare) and a
  confusable detector; tests assert equality for canonically equivalent strings, inequality for
  genuinely different ones, and detection of every confusable pair in the fixture.
- **Senior insight** — normalising *after* a security check lets an attacker submit a string that
  fails the check and normalises into the forbidden value; normalisation belongs at the input
  boundary, before validation, always in that order.

### 62.3 Text-processing pitfalls
- **Covers** — bidirectional text and the Trojan-source attack, combining marks and rendering
  surprises, emoji sequences and their instability across versions, line breaking and word
  segmentation rules, truncation at safe boundaries, encoding detection and mojibake with its
  characteristic patterns, byte-order marks, and lossy conversions that cannot be undone.
- **Demo** — the mojibake generator and detector: text encoded and decoded through mismatched
  encodings producing the classic corruption patterns, with the tool identifying the encoding pair
  from the pattern and recovering the original where recovery is possible.
- **Diagram** — mermaid diagram of a UTF-8 sequence misread as Latin-1 producing the familiar
  two-character artefact.
- **Lab** — implement safe truncation with an ellipsis at a grapheme boundary and a byte-length
  limit; tests assert no broken clusters, no exceeded byte limit, and correct handling of strings
  consisting entirely of one long cluster.
- **Senior insight** — bidirectional control characters can make source code display in an order
  different from how it compiles (Trojan source); a lint rule that rejects bidi controls in source
  is a two-line control against a genuinely sneaky class of attack.

### 62.4 Time: instants and civil time
- **Covers** — the distinction between an instant (a point on the timeline) and civil time (what a
  calendar says), epochs and their varieties, monotonic versus wall clocks and which to use for
  durations, ISO 8601 and RFC 3339 with the profile differences, durations and periods (and why
  "one month" is not a duration), storing timestamps correctly, and the modern APIs (`Temporal`) and
  the `Date` pitfalls they replace.
- **Demo** — the timestamp inspector: one instant displayed in several zones and formats
  simultaneously, with a parsing panel showing how the same string is interpreted differently under
  different assumptions (missing offset, local versus UTC).
- **Diagram** — mermaid diagram distinguishing an instant, a civil date-time and a zoned date-time.
- **Lab** — implement duration arithmetic that distinguishes exact durations from calendar periods;
  tests assert that adding one month to 31 January gives the specified result, that adding 24 hours
  across a DST boundary differs from adding one day, and that both behaviours are deliberate.
- **Senior insight** — measuring elapsed time with a wall clock produces negative durations when the
  clock steps backwards; every timeout, rate limiter and metric duration must use the monotonic
  clock, and this is the most common time bug in production code.

### 62.5 Time zones, DST and leap seconds
- **Covers** — the tz database and its update cadence, zone rules versus fixed offsets, DST
  transitions creating non-existent and ambiguous local times, the disambiguation policies for each,
  storing future events (zoned civil time, not an instant) versus past events (an instant),
  recurring events across transitions, leap seconds and smearing, and testing time-dependent code
  by injecting the clock.
- **Demo** — the DST laboratory: a scheduler running recurring jobs across a spring-forward and a
  fall-back transition, with jobs skipped or run twice under naive handling, then fixed with an
  explicit policy — with the affected occurrences listed.
- **Diagram** — mermaid diagram of the local-time gap and overlap at the two DST transitions.
- **Lab** — implement a recurring scheduler that is correct across DST transitions with an explicit
  ambiguity policy; tests assert every occurrence fires exactly once with the fixture zones and
  transition dates, including a zone whose rules changed historically.
- **Senior insight** — a future meeting stored as a UTC instant moves when the government changes
  the zone's rules, which happens several times a year somewhere; future events must be stored as
  a zoned civil time plus the zone id.

### 62.6 Serialisation formats
- **Covers** — JSON's real specification and its edge cases (number precision beyond 2⁵³, duplicate
  keys, no comments, no binary, encoding requirements), CBOR and MessagePack as binary JSON,
  protobuf and its wire format, Avro with its writer/reader schema resolution, canonical forms for
  signing and hashing, self-describing versus schema-required formats, and comparing formats by
  size, speed and tooling rather than by preference.
- **Demo** — the format bench: the same data structure encoded in every format with size, encode
  and decode throughput, and a schema-required-versus-self-describing comparison; a large integer
  demonstrates JSON's silent precision loss in a round trip.
- **Diagram** — mermaid diagram of a protobuf field's tag/wire-type/value encoding.
- **Lab** — implement protobuf varint and field encoding/decoding including unknown-field
  preservation; tests assert round-trips against reference encodings and that unknown fields survive
  a decode/encode cycle unchanged.
- **Senior insight** — `JSON.parse(JSON.stringify(x))` silently corrupts integers above 2⁵³ and
  loses type information; systems that pass IDs as JSON numbers eventually hit it, which is why
  large identifiers are transmitted as strings.

### 62.7 Schema evolution on the wire
- **Covers** — the compatibility rules per format in detail (field numbers, reserved ranges,
  optional versus required, defaults, enum unknown values), unknown-field preservation and why
  proxies must not strip it, Avro's schema-resolution rules, JSON Schema's weaker guarantees,
  compatibility testing as a build step (linking to M60), and the migration patterns for a
  breaking change.
- **Demo** — the evolution matrix generated by encoding with each schema version and decoding with
  every other: safe changes are green, silent-data-loss changes are amber and failures are red, with
  the mechanism shown per cell.
- **Diagram** — mermaid diagram of a message round-tripping through an intermediate service that
  must preserve unknown fields.
- **Lab** — evolve a schema through a required-to-optional change and an enum addition; tests assert
  the full compatibility matrix passes and that an old reader handles the new enum value by its
  specified fallback rather than crashing.
- **Senior insight** — an intermediate service that decodes and re-encodes without preserving
  unknown fields silently strips data written by newer producers; the bug shows up as missing fields
  at the far end and it is invisible at both ends of the deployment.

### 62.8 Identifiers
- **Covers** — UUID versions and their properties (v4 random, v7 time-ordered, v5 name-based),
  ULID, Snowflake (from M17), natural versus surrogate keys, sortability and index locality (from
  M51), collision probability arithmetic, information leakage (timestamps, machine ids, sequence
  numbers) and enumeration risk from sequential ids, opaque public identifiers versus internal keys,
  and choosing an id scheme deliberately.
- **Demo** — the id comparison: each scheme generated live with sortability, index-locality
  simulation over a B+tree (from M51), collision probability at a stated rate, and the information
  each id leaks, tabulated.
- **Diagram** — mermaid diagram of the bit layouts of UUIDv4, UUIDv7 and Snowflake side by side.
- **Lab** — implement UUIDv7 with monotonic ordering within a millisecond; tests assert strict
  ordering for ids generated in the same millisecond, uniqueness across 10⁶ generations, and
  correct timestamp extraction.
- **Senior insight** — random primary keys destroy insert locality (M51 measured it) and sequential
  ones leak volume and allow enumeration; UUIDv7 with an opaque external mapping is the usual
  answer, and it is a decision worth making once, deliberately.

### 62.9 Validation and parsing
- **Covers** — parse-don't-validate as a design principle (turn unstructured input into a type that
  cannot be invalid), canonicalisation before comparison and before security decisions,
  validation at the boundary with the interior trusting its types, error reporting that names the
  path and the expectation, partial validation and its dangers, schema-driven validation, and the
  difference between validation and business rules.
- **Demo** — the two designs side by side: validate-then-pass-strings versus parse-into-types, with
  a change introduced downstream that the first design allows to break at runtime and the second
  catches at the boundary.
- **Diagram** — mermaid diagram of the boundary where unstructured input becomes a validated type.
- **Lab** — refactor a validate-then-use module into parse-into-a-type; tests assert every invalid
  input is rejected at the boundary with a path-specific error and that no interior function needs
  a defensive check.
- **Senior insight** — repeated defensive checks deep in the code are a symptom that parsing did not
  happen at the boundary; moving the check once to the edge removes all of them and makes the
  invariant a type rather than a convention.

### 62.10 Encoding and interoperability
- **Covers** — base64 (and its URL-safe variant, padding rules), base32, hex, percent-encoding and
  its context-dependent reserved sets, quoting and escaping layers stacking (shell inside JSON
  inside a URL), double-encoding bugs, canonicalisation before authorisation decisions (linking to
  M59's path traversal), binary in text protocols, content-type and charset negotiation, and
  building an unambiguous wire format.
- **Demo** — the layered-encoding explorer: a value passed through several encoding layers with each
  step shown, and a decoding mismatch introduced to produce the classic double-encoding bug, with
  the security consequence demonstrated in the M59 lab app.
- **Diagram** — mermaid diagram of a value wrapped through URL, JSON and base64 layers with the
  decode order.
- **Lab** — implement percent-encoding with correct context-specific reserved sets (path segment,
  query key, query value, fragment); tests assert round-trips and correct behaviour for the reserved
  characters that differ by context, against a reference table.
- **Senior insight** — encoding bugs are almost always a layer mismatch (encoded once, decoded
  twice, or the reverse), and they are simultaneously a correctness bug and a security bug; writing
  down the layer stack for a value is usually the whole diagnosis.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/data/text-lab.js` | Unicode data subset, segmentation, normalisation, collation |
| `src/js/algorithms/grapheme.js` | Cluster segmentation, safe truncation, width estimation |
| `src/js/algorithms/confusables.js` | Homoglyph detection, canonical identity comparison |
| `src/js/machines/data/time-lab.js` | tz subset, DST scenarios, leap seconds, injectable clock |
| `src/js/algorithms/temporal.js` | Instants, zoned times, durations versus periods, recurrence |
| `src/js/algorithms/codecs-struct.js` | JSON edge cases, CBOR, MessagePack, protobuf, Avro |
| `src/js/machines/data/codec-bench.js` | Size/speed/compatibility comparison and evolution matrix |
| `src/js/algorithms/identifiers.js` | UUID v4/v5/v7, ULID, Snowflake, locality simulation |
| `src/js/algorithms/encodings.js` | base64/32/hex, percent-encoding per context, layer tracking |

---

## Acceptance criteria

- [ ] Grapheme segmentation matches the Unicode reference data for the bundled test set.
- [ ] Normalisation and case-folding tests include the Turkish-locale and confusable fixtures.
- [ ] Time arithmetic is tested across DST gaps, overlaps, historical rule changes and a leap-second
      scenario, with the expected behaviour stated per case.
- [ ] Every serialisation codec round-trips against reference encodings, and the compatibility
      matrix is generated by execution.
- [ ] Unknown-field preservation is asserted through a decode/re-encode cycle.
- [ ] UUIDv7 monotonicity within a millisecond is asserted, along with uniqueness at scale.
- [ ] Percent-encoding is validated per context against a reference table, not with one generic
      escaper.

---

## Sources

- The Unicode Standard, and UAX #15 (normalisation), #29 (segmentation), #39 (security)
- Spolsky — *The absolute minimum every software developer must know about Unicode*
- The IANA time zone database and its documentation
- Boucher, Anderson — *Trojan Source: invisible vulnerabilities*
- RFC 3339 and ISO 8601; the TC39 `Temporal` proposal documentation
- RFC 8259 (JSON), RFC 8949 (CBOR); the Protocol Buffers and Apache Avro specifications
- RFC 9562 (UUID formats, including v7); the ULID specification
- Wlaschin — *Parse, don't validate* (and King's essay of the same name)
