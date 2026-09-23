# Randomizer Arcade v1.0.0

v1.0.0 is the first production baseline of Randomizer Arcade: a local-first, installable PWA for randomization, fair selection, grouping, assignments, sessions, and reusable decision workflows.

## Included

- 25 built-in randomizer/decision tools.
- secure Web Crypto randomness plus reproducible seeded mode.
- weighted probabilities, exclusions, unique/repeat sampling, advanced dice notation, and numeric generators.
- Pools, Views, constraints, balancing, Presets, Rule Sets, History, immutable Runs, and stateful Sessions.
- Session Templates, Party Mode, Custom Experiences, and Decision Studio.
- IndexedDB persistence, backup/restore, deterministic merge, cross-device library transfer, and offline PWA behavior.
- worker-backed heavy computation with deterministic equivalence.
- accessibility and regional-format hardening.
- strict import, storage, worker, audience, route, CSP, and service-worker security boundaries.

## Certification

The release is created only after the repository's complete CI chain succeeds:

1. focused syntax/model/engine/regression certification;
2. security, accessibility, persistence, worker, offline, and performance checks;
3. cross-feature release regression certification;
4. adversarial fuzz certification;
5. final production repository/PWA certification.

The release workflow targets the exact certified main-branch commit.

## Privacy

Randomizer Arcade is local-first. v1.0.0 adds no telemetry, advertising SDK, analytics transport, remote account service, or cloud backend. User data remains in browser storage unless explicitly exported or shared.

## Compatibility note

Portable backup checksums detect accidental corruption and unsynchronized modification; they are not cryptographic authenticity signatures. Imported files are therefore still treated as untrusted data.

## Maintenance

v1.0.0 freezes the initial architecture. The default next releases are v1.0.x maintenance releases for fixes, security, compatibility, accessibility, data integrity, and narrowly scoped regressions. Broader feature expansion should be deliberately scoped as a later minor release.
