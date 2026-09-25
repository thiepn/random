# R1 — Visual Audit & Art Direction Lock

Status: **complete — design-definition phase**  
Baseline: **Randomizer Arcade v1.1.0**  
Target release family: **v1.2.0**  
Selected direction: **Tactile Chance Arcade**

## Purpose

R1 starts a new visual overhaul because v1.1.0 improved structure, responsiveness, accessibility, theming, and consistency without reaching the desired level of visual quality.

This phase intentionally makes **no production UI/CSS/interaction changes**. Its job is to define the problem correctly before another implementation cycle begins.

R1:

1. audits the released v1.1 visual system as the new baseline;
2. separates structural strengths from aesthetic weaknesses;
3. identifies root causes instead of adding more local polish;
4. selects one stronger art direction;
5. defines hard design rules for R2–R8.

The functionality, randomization, persistence, privacy, portability, accessibility, and security contracts remain authoritative.

## Evidence and limits

The audit is grounded in the released v1.1.0 source:

- all 21 root stylesheets;
- `src/app.js` view/render structure;
- `src/registry.js` tool/category structure;
- V1–V10 design documents and certification tests;
- the v1.1 release architecture.

This environment does not provide a connected interactive browser surface for screenshot-based visual inspection. Therefore R1 does **not** claim pixel-level browser findings, animation smoothness on specific hardware, or real-device typography judgments. Those become implementation QA requirements in R7/R8.

The machine-readable baseline is [r1-visual-baseline.json](./r1-visual-baseline.json).

## Baseline metrics

The released v1.1 source contains approximately:

| Measure | v1.1 baseline |
| --- | ---: |
| Root stylesheets | 21 |
| Production CSS | ~173 KB |
| Direct hex occurrences | 115 |
| rgb/rgba occurrences | 183 |
| Gradient occurrences | 66 |
| Box-shadow declarations | 49 |
| Border-radius declarations | 155 |
| Media-query blocks | 80 |
| Keyframe blocks | 31 |
| `!important` occurrences | 62 |
| Backdrop-filter declarations | 15 |
| App render functions | 31 |
| Built-in tools | 25 |
| Primary categories | 4 |

The key diagnosis is not “insufficient styling.” The app already contains a large quantity of styling. The problem is **weak visual authorship across too many local decisions**.

## What v1.1 got right

The next redesign must preserve:

- semantic color/spacing/motion tokens;
- first-class Light and Dark themes;
- Higher Contrast and Forced Colors behavior;
- Reduced Motion behavior;
- keyboard/focus semantics;
- mobile/tablet/desktop shell architecture;
- safe-area handling;
- result-first tool layout;
- professional separation between playful tool surfaces and workbench surfaces;
- SVG icon infrastructure;
- local-first/offline asset constraints;
- performance and CSS/JS budgets.

R1 does not reopen these foundations unless a concrete defect requires it.

# Audit — why v1.1 still feels visually weak

## 1. The identity is abstract instead of memorable

The current system has a spark mark, accent colors, gradients, cards, and tool icons, but those elements do not combine into a strong recognizable world.

The result is “polished application UI” rather than a product with unmistakable visual character.

### Correction

The next system must be recognizable from a cropped tool stage with the logo hidden.

Identity must come from:

- material;
- silhouette;
- lighting;
- object behavior;
- composition;
- motion;
- tool-specific art.

Color alone cannot carry brand identity.

## 2. Too many surfaces are variations of rounded rectangles

Cards, panels, controls, lists, dialogs, stages, workbench rows, and navigation repeatedly rely on border + radius + surface color.

Even with different spacing and gradients, repeated rounded containers flatten the visual hierarchy.

### Correction

Use containers only where they communicate a real grouping boundary.

Prefer:

- open composition;
- separators;
- anchored tool objects;
- physical trays;
- rails;
- shelves;
- stages;
- strips;
- spatial grouping.

Different surfaces should earn different silhouettes.

## 3. The color system is broad but not disciplined enough

v1.1 supports eight user accents plus tool-family accents and many local stage colors. This creates flexibility but weakens authorship.

A tool can inherit:

- global accent;
- category accent;
- tool accent;
- semantic state color;
- local hard-coded stage color.

### Correction

Color must have hierarchy:

1. **environment neutrals**;
2. **one application accent**;
3. **one tool material/accent family**;
4. **semantic state colors** only when state is being communicated.

No rainbow-by-default surfaces.

## 4. Graphics are mostly CSS treatments rather than authored objects

The strongest tool families—Coin, Dice, Wheel, Cards—already attempt object-like visuals, but they are primarily gradients, borders, shadows, and pseudo-elements.

That creates a “CSS demo” ceiling: technically styled, visually generic.

### Correction

Hero tools need deliberately authored vector/Canvas art with reusable geometry and material rules.

Core randomizers should have recognizable objects:

- machined coin;
- enamel dice;
- physical wheel;
- printed cards;
- tokens/chips;
- tickets/slips;
- capsules/orbs only where semantically appropriate.

## 5. Home still behaves like a polished dashboard

The Home page uses hero copy, a feature card, quick actions, recent items, favorites, and saved content. The information architecture works, but the visual composition remains dashboard-like.

### Correction

Home should feel like entering the arcade:

- one strong focal object;
- immediate “do something random” action;
- tools presented as objects/machines, not a uniform card catalog;
- saved/workbench content visually secondary.

## 6. Arcade discovery is still a card library

The catalog is clear, but variable card sizes and accent graphics are still fundamentally a grid of rectangles.

### Correction

Use a more collectible, browsable presentation:

- cabinet/tile/object silhouettes;
- category staging;
- stronger tool thumbnails;
- richer hover/press preview;
- less descriptive copy in the default scan state.

## 7. Tool stages are visually inconsistent rather than intentionally diverse

Tool families have different backgrounds and effects, but the diversity comes from independent CSS compositions.

### Correction

All tool stages must share one scene grammar:

- environment;
- hero object;
- interaction affordance;
- result layer;
- feedback layer;
- restrained atmosphere.

Tool identity changes the object/material, not the basic composition rules.

## 8. Buttons are functional, not signature components

Primary, secondary, icon, pill, segmented, and small-action controls are coherent but generic.

### Correction

The primary action must become a signature tactile control with:

- clear physical depth;
- hover lift;
- press travel;
- impact state;
- optional tool-specific icon/object cue;
- strong disabled/busy treatment.

Secondary controls should become quieter, not equally card-like.

## 9. Motion is choreographed but not sufficiently physical

v1.1 improved anticipation → action → reveal → settle, but many transitions remain conventional CSS transforms/fades.

### Correction

Motion vocabulary must map to the randomizer verb:

- flip;
- toss;
- roll;
- spin;
- shuffle;
- deal;
- scatter;
- draw;
- snap;
- drop;
- sort.

Generic fade/slide remains for application navigation only.

## 10. The shell and tool world do not feel materially connected

The shell is a competent application frame; the stages are playful. They feel adjacent rather than belonging to one physical universe.

### Correction

The shell becomes the **cabinet/table/workbench around the chance objects**.

Shared cues:

- edge treatment;
- material contrast;
- inset rails;
- control hardware;
- typography;
- ambient lighting;
- icon construction.

## 11. Workbench surfaces are too visually detached from the playful side

Pools, History, Builder, and Studio correctly became denser and more professional in v1.1, but the split can feel like a different product.

### Correction

Keep workbench density while borrowing subtle physical-system cues:

- same typography;
- same edge/rail language;
- same selected-state treatment;
- same material neutrals;
- tool accent used sparingly as operational context.

Do not turn workbench screens into arcade scenes.

## 12. The stylesheet architecture reflects design history

Twenty-one root stylesheets and ~173 KB of CSS are evidence of iterative layering.

This is manageable technically, but it makes global visual change expensive and encourages overrides.

### Correction

R2 must begin consolidation before adding major new component styling.

The redesign should reduce:

- root stylesheet count;
- duplicate component rules;
- phase-specific overrides;
- `!important`;
- hard-coded stage colors;
- decorative gradients that do not express material.

# Art-direction options considered

## A. Soft Toybox

Friendly, soft, rounded, highly colorful, characterful.

**Rejected:** too likely to become childish and further increase rounded-card language.

## B. Kinetic Studio

Minimal, dark, precise, highly typographic, motion-led.

**Rejected:** elegant but too close to generic creative software; insufficiently playful for Randomizer Arcade.

## C. Tactile Chance Arcade — selected

A premium digital arcade where randomizers feel like **physical chance objects** inside a quiet modern cabinet.

It combines:

- tactile object design;
- restrained product UI;
- selective spectacle;
- strong tool identities;
- physical motion;
- professional workbench restraint.

This direction best solves the current problem because it adds identity through **objects and material**, not more decoration.

# Selected direction — Tactile Chance Arcade

## Core metaphor

**The app is the cabinet. Each randomizer is a machine or physical chance object.**

The interface should disappear around the act of randomization.

The user should remember:

- the coin;
- the dice;
- the wheel;
- the cards;
- the tokens;
- the reveal.

Not the card component containing them.

## Visual composition rule

Every playful tool screen uses five layers:

1. **Environment** — quiet neutral stage/cabinet.
2. **Hero object** — the randomizer itself.
3. **Interaction hardware** — the primary action and essential setup.
4. **Result layer** — outcome with dominant typography.
5. **Feedback layer** — motion, particles, sound/haptic cues where appropriate.

Decorative effects may not become a sixth competing layer.

## Material families

| Family | Material language | Examples |
| --- | --- | --- |
| Metal | brushed/minted, crisp highlights, weight | Coin |
| Enamel | chunky body, inset marks, soft edge highlights | Dice |
| Lacquer / painted hardware | radial segments, pointer, hub, mechanical rim | Wheel |
| Paper + felt | printed faces, paper edge, table/felt depth | Cards |
| Tokens / chips | compact physical pieces, labels, grouping motion | Picker, Teams, Groups |
| Tickets / slips | ordered strips, tear/perforation cues | Shuffle, Assignment, Lottery |
| Instrument panel | dials, meters, restrained luminous result | Number, Chance, generators |
| Private envelope | sealed/reveal language, privacy-first composition | Secret Santa |

Materials are visual metaphors, not photorealism. They should remain fast, vector-friendly, accessible, and themeable.

## Color philosophy

### Environment

Two authored environments, not inversions:

- **Night cabinet** — deep ink/graphite, warm dark surfaces, controlled highlights.
- **Day table** — warm paper/stone, cool structural lines, physical shadows.

### Accent

Global accent personalizes hardware and focus, not every surface.

### Tool color

Each tool gets a restrained material palette, usually:

- one dominant tool color;
- one highlight;
- environment neutrals.

### Semantic colors

Success/warning/danger/info only appear when those meanings are present.

## Typography philosophy

Three jobs:

- **Display/result:** bold, compact, high-character, excellent numerals.
- **Interface/body:** neutral, legible, calm.
- **Technical/data:** tabular/mono only where alignment or reproducibility matters.

R2 will decide the exact offline-safe font strategy. Typography may not depend on a remote font service.

## Shape philosophy

Stop applying one radius everywhere.

Use:

- physical-object silhouettes for hero art;
- medium-radius controls;
- flatter/open workbench rows;
- pill shapes only for genuinely pill-like semantics;
- circles only for radial/round objects and icon affordances.

## Depth philosophy

Depth should explain material and interaction.

Allowed:

- contact shadow;
- inset edge;
- rim highlight;
- pressed travel;
- object cast shadow;
- modal elevation.

Avoid:

- ambient shadow on every card;
- glow around every accent;
- depth with no interaction/material purpose.

## Graphic-art philosophy

Core art should be:

- local;
- SVG/Canvas/CSS geometry;
- crisp at any scale;
- reusable;
- animation-ready;
- theme-aware;
- meaningful to the tool.

No stock photography. No decorative illustration that competes with the randomizer.

Generated raster art may be used only for non-essential editorial decoration after R5 review.

## Motion philosophy

### Application motion

Fast, quiet, directional.

### Object motion

Physical, tool-specific, satisfying.

### Result motion

One clear impact moment, then settle.

### Reduced motion

Replace travel/rotation with:

- state change;
- opacity;
- scale under safe thresholds;
- highlight/impact frame.

Reduced Motion must remain designed, not merely disabled.

## Interaction philosophy

One screen should make one action obvious.

For a randomizer:

- **primary action:** unmistakable;
- **result:** dominant;
- **setup:** available but visually subordinate;
- **advanced controls:** progressive disclosure;
- **history/save/share:** tertiary.

The visual hierarchy must survive with labels blurred out.

## Home philosophy

Home becomes an entrance, not a dashboard.

Priority:

1. immediate random action;
2. one rotating/featured chance object;
3. compact recent/favorite tools;
4. saved/guided content;
5. professional libraries.

## Arcade philosophy

The Arcade becomes a collection of machines/objects rather than a card grid.

Tool browsing should emphasize:

- icon/object;
- name;
- category;
- quick interaction preview.

Descriptions move to hover/focus/detail where possible.

## Workbench philosophy

Professional surfaces remain dense.

They adopt:

- cabinet rails;
- strong selection;
- calm material surfaces;
- tool context accents;
- fewer boxes;
- more rows/separators.

No decorative spectacle in data-heavy workflows.

# Brand lock

The brand personality is:

- **playful, not childish**;
- **tactile, not skeuomorphic**;
- **vivid, not neon-chaotic**;
- **premium, not luxurious**;
- **clear, not minimal-for-minimalism’s-sake**;
- **expressive, not decorative**;
- **fast, not hyperactive**.

# Non-negotiable design laws

1. **Object before container.** Hero randomizers are objects, not cards.
2. **One focal point.** Every screen has a single dominant visual/action.
3. **Color has a job.** No rainbow decoration without tool/state meaning.
4. **Depth has a job.** Shadows/glows must express material, hierarchy, or interaction.
5. **Motion uses verbs.** Tool animation reflects the randomization action.
6. **Shell stays quiet.** The cabinet supports the object.
7. **Workbench stays professional.** Playfulness cannot reduce scanability.
8. **Light is authored.** Light theme is not dark theme inverted.
9. **Reduced Motion is designed.** Accessibility is a first-class aesthetic state.
10. **No visual debt by layering.** Prefer replacement/consolidation to additive overrides.
11. **No stock identity.** Core product art must be locally authored and recognizably Randomizer Arcade.
12. **Performance is visual quality.** No effect is premium if it causes jank.

# Explicitly forbidden patterns

R2–R8 should reject:

- generic dashboard hero + endless card grids as the primary composition;
- glow on every accent;
- gradients used only to make a flat surface “interesting”;
- uniform large radii across unrelated components;
- decorative glassmorphism;
- emoji as product iconography;
- stock illustration;
- remote runtime fonts/assets;
- animations with no semantic verb;
- multiple simultaneous focal animations;
- confetti as the default celebration;
- unreadable neon-on-dark combinations;
- forcing playful visuals into data-dense workbench rows;
- adding another phase stylesheet solely to override the previous one.

# Surface priority

## P0 — identity-defining

1. Home
2. Arcade/tool discovery
3. Coin
4. Dice
5. Wheel
6. Cards
7. shared primary action
8. shared result stage

If these do not look excellent, the redesign is not successful.

## P1 — high-frequency support

- Picker/Sampler;
- Teams/Groups/Pairs;
- Number/Chance;
- tool setup panels;
- navigation;
- Settings.

## P2 — professional continuity

- Pools;
- History;
- Presets/Templates;
- Builder;
- Decision Studio.

P2 must become visually coherent, but P0 receives the strongest art investment.

# R2–R8 implementation sequence

## R2 — Visual System 3.0 & Component Materials

Consolidate CSS architecture, establish new color/type/shape/depth/material tokens, and rebuild buttons/controls.

## R3 — Shell, Home & Arcade Composition

Rebuild the application frame and discovery experience around the cabinet + chance-object model.

## R4 — Tool Experience 3.0

Rebuild the shared tool composition, action hierarchy, setup disclosure, and result staging.

## R5 — Hero Objects, Graphics & Art

Create the authored visual objects/material families for Coin, Dice, Wheel, Cards, tokens, tickets, and generator instruments.

## R6 — Physical Motion & Microinteractions

Implement tool-verb motion, button travel, transitions, impact feedback, and restrained celebration.

## R7 — Themes, Personalization & Accessibility Art Pass

Author Day/Night environments, accent behavior, Reduced Motion visuals, Forced Colors, zoom, and responsive art behavior.

## R8 — Full Visual QA, Consolidation & Release

Cross-surface polish, asset/performance optimization, stylesheet reduction, regression testing, deployed browser/device QA, and release.

# R1 exit criteria

R1 is complete when:

- v1.1.0 is recorded as the baseline;
- current visual complexity is measured;
- the weaknesses are stated by root cause rather than vague taste;
- one art direction is selected;
- physical/material families are defined;
- design laws and forbidden patterns are explicit;
- P0/P1/P2 surface priorities are fixed;
- the R2–R8 sequence is locked;
- no production visual code is changed in R1.

R2 may change the design system only after preserving these constraints.
