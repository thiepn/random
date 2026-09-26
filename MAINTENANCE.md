# Maintenance Baseline

Randomizer Arcade reached its v1.0.0 architectural production baseline on 2026-09-23, released v1.1.0 on 2026-09-25, and released the backward-compatible **Tactile Chance Arcade v1.2.0** redesign on 2026-09-26.

## Default scope after v1.2.0

The default development mode is maintenance, not continued roadmap expansion.

Acceptable v1.2.x work:

- correctness fixes
- regression fixes
- browser/PWA compatibility fixes
- accessibility fixes
- security/privacy/integrity fixes
- data-loss or migration fixes
- performance regressions
- narrowly scoped UX fixes that preserve established product behavior
- test and release-infrastructure improvements

Work that should normally require a planned v1.3.0 or later scope:

- new major tools or game modes
- new persistence models
- new backend/account/cloud architecture
- schema-breaking data-model changes
- major navigation or information-architecture redesigns
- broad feature-phase expansion

## Patch-release rule

A patch release should:

1. reproduce or precisely define the defect;
2. add or update a regression test where practical;
3. make the smallest coherent fix;
4. run the full CI certification pipeline;
5. pass the dependent Production release certification job;
6. update VERSION and CHANGELOG;
7. add matching RELEASE-NOTES-vX.Y.Z.md;
8. allow the CI release job to create the tag and GitHub Release only after certification succeeds.

## Versioning

- PATCH: backward-compatible fixes and maintenance.
- MINOR: deliberate backward-compatible product expansion.
- MAJOR: incompatible behavior, storage, portability, or product-contract changes.

Portable backup compatibility should be preserved across patch releases. Any intentional portability schema change requires explicit migration and compatibility tests.

## Release blockers

Do not release when any of these are known:

- decision randomness correctness regression
- seeded reproducibility regression
- silent data loss or destructive restore defect
- broken offline startup/update path
- Secret Santa or other private-data audience leakage
- bypass of import/worker/CSP/storage trust boundaries
- failed accessibility interaction regression
- failed production certification
- unexplained performance-budget breach

## Emergency fixes

For a severe production issue, prefer a minimal patch release over reopening architecture work. Security, privacy, data integrity, or data-loss defects take priority over feature work.
