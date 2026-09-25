# R8 — Full Visual QA, Consolidation & v1.2 Release Readiness

Status: **release candidate source QA complete — release hold remains**  
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

**SOURCE-READY / LIVE-VISUAL-QA HOLD**

The hold exists for two concrete reasons:

1. the exact final-head GitHub Actions/Pages jobs have remained queued or been superseded/cancelled by newer commits rather than producing a complete final certification result;
2. this chat does not expose a screenshot-capable browser surface, and the available web reader cannot access the GitHub Pages site, so pixel-level live browser/device screenshots cannot be honestly certified here.

R8 therefore refuses to turn source confidence into an unsupported claim of full visual verification.

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

## Live visual matrix still required

Before v1.2.0 is tagged, perform screenshot/device smoke checks for:

| Surface | Required states |
| --- | --- |
| Home | Night + Day, 320/390/768/1440/1920 |
| Arcade | Night + Day, category rail/grid, long labels |
| Coin | idle, reveal, result, Reduced Motion |
| Dice | multi-die, expression, result, Reduced Motion |
| Wheel | long labels, spin, result, Day Table |
| Cards | pre-draw, deal, result, deck reset |
| People/list tools | token/ticket art, long lists, team results |
| Generators | instrument art, long/structured values |
| Secret Santa | generated state + private reveal |
| Settings | themes, all accents, Higher Contrast, Large Controls |
| Workbench | Pools, History, Builder, Decision Studio |
| Forced Colors | Home, Arcade, one Tool, one workbench |
| Touch | mobile navigation, Quick Bay, Setup, primary action |
| Keyboard | shell navigation, tool actions, Setup, modal flows |

Any clipping, unreadable contrast, broken object layering, sticky hover, animation leakage, or Day/Night mismatch is a release blocker.

## Browser evidence limit

No screenshot evidence is attached to R8 because no valid screenshot-capable browser was available in this chat.

The live Pages URL also could not be opened by the available web reader.

This is recorded as a limitation, not silently treated as a pass.

## Final source budgets

R8 records the current source baseline:

- root stylesheets: **19**;
- total CSS: **173,924 bytes**;
- CSS headroom under 175,000: **1,076 bytes**;
- `src/app.js`: **422,181 bytes**;
- total production JavaScript: **757,042 bytes**;
- `src/hero-art.js`: **16,192 bytes**;
- `src/motion-system.js`: **11,287 bytes**.

R8 additionally enforces a release-candidate CSS ceiling below the absolute production ceiling so later release metadata changes cannot consume the final reserve unnoticed.

## Versioning

The stable release remains **v1.1.0** during R8.

A draft `RELEASE-NOTES-v1.2.0.md` is prepared, but version/tag/release creation is deliberately deferred.

The release-finalization step should only change the R8 release decision after:

1. exact-head full CI succeeds;
2. exact-head Pages deployment succeeds;
3. the live browser/device visual matrix is completed;
4. no R8 blocker remains.

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
- release decision remains HOLD until live browser evidence is available.

## Next

**v1.2.0 — Release & Deployment Finalization**

That step should be mechanical: finish the live visual matrix, resolve any findings, obtain exact-head green CI + Pages deployment, flip the R8 release decision, bump version/cache/document metadata, finalize release notes/changelog/maintenance baseline, and publish the versioned GitHub Release.
