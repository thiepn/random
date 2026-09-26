# R8 — Full Visual QA, Consolidation & v1.2 Release Readiness

Status: **released — v1.2.0**  
Direction: **Tactile Chance Arcade**  
Target: **v1.2.0**

## Purpose

R8 closes the R1–R7 redesign track by auditing the completed system as one product instead of adding another visual layer.

This phase covers:

- cross-phase source and contract regression;
- legacy visual-rule cleanup;
- theme/accessibility consistency;
- all 25 built-in tool art and motion coverage;
- responsive and input-mode contracts;
- PWA/offline/release infrastructure;
- budget recovery;
- release-candidate documentation.

R8 does **not** bump `VERSION`, create a v1.2.0 tag, or publish a GitHub Release.

## Release decision

The repository is currently:

**RELEASE DECISION — APPROVED**

The exact Pages artifact from visual payload head `215abff4b6db97a07cf8c7bdc0ab1536fbc8b334` was rendered in Chromium and the required visual/runtime matrix was completed.

The evidence-recording head `7d7e8aae3787a8095128abed9e2c220e0bf3e6a4` then passed complete CI, Production release certification, and Pages deployment. All R8 release blockers are cleared.

## Source QA completed

### R1–R7 contracts

R8 verifies that the completed redesign still contains:

- R1 Tactile Chance Arcade direction;
- R2 material/shape/depth system;
- R3 quiet shell + machine discovery composition;
- R4 machine Tool Experience;
- R5 authored object art;
- R6 cancelable physical motion;
- R7 adaptive theme/accessibility art.

### 25-tool visual coverage

Every built-in tool must still resolve to:

- an authored R5 art family;
- an R6 physical-motion family.

Custom Experiences retain their SVG-icon/art fallback behavior.

### Correctness boundary

R8 preserves the core invariant:

**Run commit happens before presentation begins.**

Visual work does not alter randomness, persistence, Sessions, History, or portability.

## Legacy visual cleanup

The final source audit found ordinary UI surfaces that still carried pre-redesign dark-only values.

R8 migrates the following to semantic/material roles:

- `phase1.css` — errors, private badges, ladder surfaces, tournament match cards;
- `phase3.css` — Dice expression/preset/help/history surfaces and Number option controls;
- `phase5.css` — constraint/rule-builder surfaces;
- `phase12.css` — Settings storage/backup/portable-package surfaces.

These files no longer contain the audited legacy blue-black literals or old fixed light-on-dark status colors.

The immersive Party/Audience surface remains intentionally dark because it is a fullscreen/projector presentation mode rather than a Day Table workbench.

## Redundant decoration removal

R8 removes the unused pre-redesign `.brand-asset-panel` decorative ring.

R5 authored objects already carry their own silhouette and depth, so the old decoration no longer contributes to the live product.

## Visual state matrix

### Theme

Source-certified:

- Night Cabinet;
- Day Table;
- System theme resolution;
- eight accent choices;
- dynamic browser `theme-color`;
- PWA Night Cabinet launch surface.

### Accessibility

Source-certified:

- Higher Contrast;
- Forced Colors;
- Reduced Motion;
- Large Controls;
- browser zoom remains enabled;
- keyboard/focus contracts;
- coarse-pointer target rules;
- semantic result DOM remains independent of artwork.

### Responsive

Source-certified:

- 320px extreme-width rules;
- mobile;
- tablet;
- desktop;
- 1600px+ bounded ultrawide art scaling;
- landscape mobile;
- PWA safe areas;
- long-label wrapping/overflow controls.

### Input

Source-certified:

- mouse/fine-pointer hover only where supported;
- touch does not receive sticky hover transforms;
- keyboard-accessible navigation/tool/setup controls.

## Live visual matrix — verified

The live matrix is complete. See [R8 Live Visual QA](./R8-LIVE-VISUAL-QA.md).

Verified evidence includes:

- Home/Arcade at 320, 390, 768, 1440 and 1920 widths across Day Table and Night Cabinet;
- core tool idle/result states;
- 25/25 built-in tool execution;
- all eight accents across both themes;
- Higher Contrast, Forced Colors, Reduced Motion and Large Controls;
- 320px text-zoom stress;
- keyboard focus and touch;
- long-label Wheel at 390px;
- Pools, History and Decision Studio workbench surfaces.

No unresolved visual/runtime blocker remained after the two QA-discovered rendering defects were fixed.

## Final source budgets

R8 records the current source baseline:

- root stylesheets: **19**;
- total CSS: **173,924 bytes**;
- CSS headroom under 175,000: **1,076 bytes**;
- `src/app.js`: **422,958 bytes**;
- total production JavaScript: **757,819 bytes**;
- `src/hero-art.js`: **16,192 bytes**;
- `src/motion-system.js`: **11,287 bytes**.

R8 additionally enforces a release-candidate CSS ceiling below the absolute production ceiling so later release metadata changes cannot consume the final reserve unnoticed.

## Versioning

The stable release is **v1.2.0**.

`RELEASE-NOTES-v1.2.0.md` is finalized, the R8 release decision is `release`, and version/tag/publication are authorized after the successful evidence-head CI and Pages gates.

The versioned release workflow must tag the exact final certified release commit.

## Exit criteria

R8 source QA is complete when:

- R1–R7 source contracts remain present;
- all 25 tools retain art + motion coverage;
- ordinary UI legacy dark palette regressions are removed;
- accessibility/theme/responsive contracts remain explicit;
- PWA/offline release infrastructure includes R5/R6 modules;
- CSS remains below the R8 candidate ceiling;
- draft v1.2.0 release notes exist;
- CI includes the R8 gate;
- release certification protects R8 artifacts;
- live visual QA is verified and the evidence-recording head passed CI + Pages; the v1.2.0 release decision is approved.

## Release

**v1.2.0 — Release & Deployment Finalization** is complete once the final version commit passes CI and the versioned release workflow publishes the exact certified commit.
