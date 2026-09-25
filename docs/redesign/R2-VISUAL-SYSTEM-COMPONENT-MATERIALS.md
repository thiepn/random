# R2 — Visual System 3.0 & Component Materials

Status: **implemented**  
Baseline: **v1.1.0 + R1 Tactile Chance Arcade direction**  
Target: **v1.2.0**

## Objective

R2 replaces the generic “dark SaaS + colorful accents” foundation with the material and component system required by **Tactile Chance Arcade**.

This phase does not redesign Home, Arcade, or individual tool compositions. It changes the shared visual physics they inherit.

## 1. Environment system

### Night Cabinet

The default dark environment is now warm graphite/ink rather than blue-black.

Characteristics:

- warm deep cabinet neutrals;
- parchment-tinted primary text;
- restrained muted text;
- low ambient color;
- subtle physical edge highlights;
- shadows that read as contact/material depth rather than floating cards.

### Day Table

Light mode is now independently authored as a warm paper/stone table rather than a cool inversion of Dark.

Characteristics:

- warm paper canvas;
- cream raised surfaces;
- stone/inset trays;
- dark graphite text;
- brown-neutral physical shadows;
- independently tuned contrast and material edges.

## 2. Accent discipline

The eight existing accent preferences remain compatible.

R2 changes their role:

- primary accent = user-selected hardware/focus identity;
- secondary accent = restrained warm highlight rather than a second competing neon;
- tool-specific accents remain available for tool identity;
- semantic success/warning/danger/info colors remain meaning-driven.

The default Violet accent now pairs with Gold instead of Cyan, reducing the previous violet/cyan “tech UI” signature.

## 3. Typography

R2 introduces a separate offline-safe display stack:

- `--font-display`
- `--font-sans`
- `--font-mono`

Display/page/result roles use the display stack with less extreme tracking than v1.1.

The goal is stronger editorial character without adding remote runtime fonts.

## 4. Material tokens

R2 adds explicit physical-material roles:

- `--material-cabinet`
- `--material-panel`
- `--material-panel-raised`
- `--material-tray`
- `--material-inset`
- `--material-hardware`
- `--material-hardware-hover`
- `--material-rim`
- `--material-rim-strong`
- `--material-highlight`
- `--material-shadow`
- `--material-shadow-soft`

These roles replace arbitrary “surface 1/2/3” decisions in shared controls.

Legacy semantic surface aliases remain available for existing screens until R3–R7 migrate them.

## 5. Shape hierarchy

R2 reduces the previous rounded-rectangle uniformity.

New shape roles:

- `--shape-control` — compact controls;
- `--shape-panel` — ordinary grouped surfaces;
- `--shape-tray` — physical trays/modal bodies;
- `--shape-stage` — large hero stages;
- `--shape-round` — only for genuinely round/pill semantics.

Legacy radius tokens map to these roles for backwards compatibility.

## 6. Physical depth model

Depth now has semantic jobs:

- `--shadow-contact` — resting surface;
- `--shadow-inset` — recessed tray/input;
- `--shadow-control` — raised hardware/control;
- `--shadow-object` — hero object;
- `--shadow-float` — temporary raised surface;
- `--shadow-overlay` — modal overlay.

Day Table overrides these independently.

## 7. Shared component rebuild

### Primary button

The primary action is now a signature piece of hardware:

- single accent color;
- vertical material highlight;
- darker physical lower edge;
- raised rest state;
- 1px hover lift;
- 2px press travel;
- compressed active shadow;
- strong focus state remains inherited.

It no longer uses a generic two-accent diagonal gradient.

### Secondary button

Secondary buttons are visually quieter:

- panel material;
- single rim;
- contact shadow;
- modest hover lift through material change;
- no competing accent fill.

### Danger button

Danger retains semantic color but follows the same control shape/depth language.

### Small action

R2 fixes an accumulated inconsistency: `.small-action` previously had many local size overrides but no shared visual base.

It now has:

- common material background;
- common rim;
- common hover/press behavior;
- common typography weight;
- local screens only control density/size.

### Icon and status/pill buttons

They now use raised hardware material and real pressed travel.

Pill geometry remains only where the control is semantically status/pill-like.

### Fields

Fields/selects/textareas become recessed controls:

- inset material;
- inset shadow;
- material rim;
- accent focus edge + focus halo;
- invalid-state semantic border.

### Segmented controls

The group is a recessed tray; the active option becomes a raised hardware piece.

### Stepper

Stepper output sits in an inset tray while +/- buttons are raised hardware.

### Search

Search surfaces use the same inset material as fields.

### Modal

Modal bodies use panel material, strong rim, tray shape, and overlay depth.

### Notice

Notices stop being mini cards and instead use a semantic side rail with a quieter surface.

### Workbench command bars

They use calm panel material/contact depth rather than a generic rounded card look.

## 8. Theme/accessibility ownership consolidation

The old `visual-resilience.css` override layer has been removed.

Ownership now is:

- theme/material/accent tokens → `design-system.css`;
- shared visual/control states → `styles.css`;
- accessibility/contrast/reduced-motion/forced-colors → `phase14.css`;
- shell responsive resilience → `app-shell.css`;
- tool-stage theme resilience → `tool-experience.css`;
- Home landscape resilience → `home-arcade.css`.

V9/V10 certifications were updated to verify the same guarantees across the new owners.

## 9. CSS consolidation

R2 reduces root stylesheet count:

**21 → 19**

Removed:

- `visual-resilience.css`
- `phase13.css`

Phase 13 rendering-containment rules now live in the core stylesheet.

Older formatted phase sheets were compacted in place rather than adding another R2 override sheet.

## 10. Budget

After implementing the richer material system:

- root stylesheets: **19**
- total production CSS: **172,802 bytes**
- existing ceiling: **175,000 bytes**
- headroom: **2,198 bytes**

R3 must replace/rewrite Home and Arcade styling in place. It must not create a new override-only stylesheet.

## 11. Accessibility

R2 preserves:

- Light/Dark/System themes;
- Higher Contrast;
- Forced Colors;
- Reduced Motion;
- browser zoom;
- focus-visible rings;
- coarse-pointer targets;
- large-control mode;
- safe areas;
- first-paint visual preferences.

Forced Colors also suppresses material shadows so depth never becomes the only carrier of state.

## 12. Functional boundary

R2 changes no:

- randomization;
- data models;
- IndexedDB schemas;
- backup format;
- Session semantics;
- workflow semantics;
- privacy boundaries;
- tool configuration logic.

## Exit criteria

R2 is complete when:

- Night Cabinet and Day Table are first-class authored environments;
- material, shape, depth, and display typography tokens exist;
- shared controls consume material roles;
- primary actions have tactile press behavior;
- `.small-action` has one shared base;
- Light/High Contrast/Forced Colors/Reduced Motion remain certified;
- `visual-resilience.css` is removed;
- Phase 13 containment is consolidated;
- root stylesheet count is <= 19;
- CSS stays below 173.5 KB;
- all historical V1–V10 and functional release gates remain compatible.

## Next

**R3 — Shell, Home & Arcade Composition**
