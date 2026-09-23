# V1 — Visual Audit, Art Direction & Redesign Contract

Status: **complete design-preparation phase**  
Baseline: **Randomizer Arcade v1.0.0**  
Target release family: **v1.1.0**

## Purpose

V1 freezes the visual problem definition before production styling changes begin.

This is intentionally **not** a cosmetic patch. Randomizer Arcade already has substantial CSS, motion, responsive behavior, accessibility handling, and tool-specific rendering. The problem is that those decisions accumulated phase by phase instead of being governed by a single visual system.

V1 therefore does four things:

1. records a measurable v1.0.0 visual baseline;
2. identifies the highest-impact visual problems by surface;
3. selects and defines the art direction;
4. establishes non-negotiable redesign constraints for V2–V10.

No randomization, persistence, storage, portability, workflow, security, or tool behavior is redesigned in V1.

## Evidence and limits

The audit is grounded in the current production source on `main`:

- `styles.css` and `phase1.css` through `phase14.css`;
- `src/app.js` render/view structure;
- `src/registry.js` tool/category metadata;
- the existing accessibility, presentation, PWA, performance, and release-certification layers.

The available browser environment could not capture the deployed GitHub Pages site. Therefore this document does **not** claim screenshot-derived findings such as pixel-perfect alignment, perceived animation smoothness, real-device font rendering, or visual-browser parity. Those are explicit V9/V10 verification items.

The machine-readable baseline lives in [visual-baseline.json](./visual-baseline.json).

## Baseline summary

Randomizer Arcade v1.0.0 currently has:

- **25 built-in tools** across **4 categories**;
- **11 primary view states**;
- **30 observed render functions** in the app controller;
- **15 stylesheets**;
- **123 direct hex-color occurrences**;
- **243 rgb/rgba occurrences**;
- **141 border-radius declarations**;
- **130 border declarations**;
- **30 box-shadow declarations**;
- **39 gradient occurrences**;
- **45 media-query blocks**;
- **24 keyframe blocks**.

The quantity of styling is not the problem. The visual system has too many locally-authored decisions and too little semantic reuse.

## What already works

The redesign must preserve these strengths:

- clear dark-mode contrast baseline;
- strong result-stage concept;
- responsive mobile/desktop split for tool screens;
- reduced-motion support;
- focus-visible handling;
- high-contrast mode;
- coarse-pointer target sizing;
- tool accent colors;
- downstream presentation architecture, where visual reveal does not alter decision correctness;
- performant local-first PWA architecture;
- distinct Party/Audience privacy model.

## Ranked visual problems

### 1. The rounded-card language is overused

**Severity: critical**

The same combination appears across home cards, controls, history, pools, modals, builder panels, workflow surfaces, results, settings, and utility rows:

- translucent dark fill;
- one-pixel light border;
- medium/large rounded corners;
- occasional glow or gradient.

This makes structurally different objects feel equivalent.

**V2/V5/V8 response:** replace container-first hierarchy with spacing, typography, surface level, layout, shape, and selective containment.

---

### 2. Hierarchy is too flat

**Severity: critical**

The app contains important distinctions:

- primary action vs setup;
- current result vs prior context;
- reusable library object vs one-off run;
- playful tool surface vs professional editor;
- public party content vs private host state.

Yet many of these surfaces use similar card weight, border strength, radius, and text sizing.

**Target:** a user should visually identify the current task, primary action, and current result before reading labels.

---

### 3. Color is expressive but not governed

**Severity: high**

The current palette is recognizable, but many literal colors and translucent variants are authored directly in individual stylesheets.

The result is:

- repeated near-equivalent dark surfaces;
- several slightly different muted-text colors;
- inconsistent semantic success/warning/danger treatment;
- accents used decoratively where hierarchy should do the work;
- difficult future light-theme support.

**V2 response:** semantic color tokens with neutral surfaces, semantic states, and one dominant tool accent at a time.

---

### 4. Shape vocabulary has drifted

**Severity: high**

Rounded geometry is a core part of the identity, but the code contains a large number of locally chosen radii.

That produces subtle inconsistency rather than intentional expressiveness.

**Target shape family:**

- compact control radius;
- standard component radius;
- feature-card radius;
- hero/stage radius;
- pill only for true chips/statuses;
- circular geometry only where the object itself is circular.

Expressive shapes should be reserved for signature moments, not every component.

---

### 5. Iconography does not feel like a finished consumer product

**Severity: high**

The built-in tool registry currently relies on a mixed symbol language such as `◐`, `⬡`, `◉`, `#`, `⇄`, `∞`, `▰`, `✺`, and similar Unicode glyphs.

They are lightweight, but their weight, baseline, geometry, rendering, and platform appearance are inconsistent.

**V3 response:** one local SVG icon family with shared stroke/fill geometry and optical sizes.

---

### 6. The app shell is responsive but not truly adaptive

**Severity: high**

At desktop width the five-item bottom navigation becomes an 88px vertical rail. This is functionally responsive, but it remains essentially the mobile navigation transformed into a column.

**Target:**

- mobile: compact bottom navigation;
- tablet: icon rail with contextual labels;
- desktop: deliberate application sidebar/rail plus contextual top toolbar;
- large desktop: wider work canvas and better information density.

---

### 7. Tool screens share too much visual anatomy

**Severity: high**

The common `tool-stage + controls` architecture is good for usability, but visual differentiation is limited.

A Coin, Wheel, Tournament, Color, Number, Teams, and Secret Santa tool should share interaction principles without appearing to be the same dark container with different content.

**V6 response:** retain a shared interaction contract while creating tool families with distinct stage composition.

---

### 8. Playful and professional surfaces are not separated enough

**Severity: medium-high**

The launcher and randomization stage should feel playful.

Pools, History, Presets, Builder, Settings, and Decision Studio should feel more like a precise workbench.

Currently both families lean heavily on the same surface recipe.

**V8 response:** introduce two coordinated modes:

- **Play surfaces** — expressive, spacious, tool-centric;
- **Workbench surfaces** — denser, calmer, information-centric.

They remain one product through shared typography, tokens, navigation, motion, and iconography.

---

### 9. Typography is functional but underused as a design tool

**Severity: medium-high**

The current system relies on an Inter/system stack and compensates for hierarchy with cards, borders, uppercase labels, and color.

Small administrative copy frequently falls into a narrow 8–12px range.

**V2 response:**

- define a real display, title, section, body, label, metric, and mono/result scale;
- reduce unnecessary uppercase micro-labels;
- increase minimum comfortable text sizes;
- use weight/size/spacing before introducing another container.

Typeface selection must remain locally hosted/offline-compatible.

---

### 10. Motion is richer than the static hierarchy

**Severity: medium**

Randomizer already has substantial presentation choreography, particles, tool reveals, sound/haptics, reduced-motion handling, and deterministic animation semantics.

The next step is not “more animation.”

**V7 response:** unify motion around:

- press;
- launch;
- anticipation;
- reveal;
- settle;
- continuity between screens.

Decorative animation that does not communicate state should be removed before new animation is added.

## Surface audit

| Surface | Current visual risk | Redesign intent |
| --- | --- | --- |
| Home / Arcade | repeated equal-weight cards | editorial launcher with clear priority and variable composition |
| Global navigation | mobile model adapted to desktop | native-feeling adaptive shell |
| Tool stage | strong foundation but visually repetitive | signature tool-family canvases |
| Tool controls | heavy containment | calmer grouped control architecture |
| Results | strong typography but inconsistent secondary output | dominant result + structured supporting evidence |
| Pools | card/list treatment resembles generic settings | efficient collection/editor workbench |
| History | functional but visually flat | temporal hierarchy and stronger run/session grouping |
| Presets/Templates | reusable objects lack strong identity | recognizable library-object system |
| Party/Audience | functional privacy split | event/presentation-grade visual mode |
| Custom Builder | many stacked bordered panels | inspector/editor layout |
| Decision Studio | graph logic exceeds current visual sophistication | proper canvas/node/inspector system |
| Modals | structurally sound | unified sheet/dialog hierarchy |
| Settings | adequate controls | lower-noise preference sections and clearer system status |

## Art-direction exploration

### Direction A — Neon Arcade

High saturation, large glows, luminous glass, stronger gaming references.

**Strength:** immediate energy.  
**Risk:** exaggerates the exact visual habits already overused and can make utility/workbench screens noisy.

### Direction B — Expressive Utility Arcade — **selected**

Neutral canvas, selective depth, confident typography, custom geometric icons, tactile tool objects, strong tool-specific accent moments, and playful motion used only around decisions/results.

**Strength:** allows the app to remain fun without making every surface decorative.  
**Risk:** requires disciplined tokenization and more bespoke tool artwork.

### Direction C — Soft Editorial Studio

Lightweight editorial layout, softer colors, minimal chrome, strong type.

**Strength:** premium and calm.  
**Risk:** underplays the “Arcade” identity and makes randomization less satisfying.

## Selected direction — Expressive Utility Arcade

### Personality

- playful, not childish;
- tactile, not skeuomorphic;
- energetic, not neon-everywhere;
- precise, not corporate;
- dark by default in early redesign phases, but designed for a first-class light theme;
- unmistakably Randomizer rather than a generic dashboard.

### Visual hierarchy rule

At any moment the interface should answer, visually and without reading every label:

1. **Where am I?**
2. **What is the main thing I can do?**
3. **What just happened / what is the result?**
4. **What can I adjust?**
5. **What is supporting information?**

### Color rule

- mostly neutral canvas and surfaces;
- one dominant contextual/tool accent;
- semantic colors reserved for status;
- gradients used for signature objects/stages rather than generic panel decoration;
- glow used as feedback or emphasis, never as baseline decoration.

### Shape rule

Use shape to communicate role:

- control;
- card/object;
- feature;
- stage;
- chip/status;
- physical/circular tool.

Do not assign a new radius because a component is new.

### Depth rule

Four conceptual layers:

1. canvas;
2. content surface;
3. raised interactive surface;
4. transient/overlay surface.

Borders are optional separators, not the default container definition.

### Icon rule

All primary product/tool icons will move to a coherent local SVG family in V3. Unicode symbols may remain inside generated results where they are content, but not as the primary navigation/tool-brand language.

### Motion rule

Motion must communicate:

- cause and effect;
- spatial continuity;
- state transition;
- result impact.

Reduced motion remains a first-class alternate presentation.

## Responsive verification matrix

Every major screen must eventually be checked at the viewports recorded in `visual-baseline.json`, including small mobile, common phone, mobile landscape, tablet, desktop, large desktop, and wide desktop.

At minimum, the following must be visually inspected before v1.1.0:

- Home/Arcade;
- one simple tool (Coin);
- one complex tool (Dice);
- one list tool (Wheel/Picker);
- one people tool (Teams);
- one privacy-sensitive tool (Secret Santa);
- Pools;
- History;
- Presets/Templates;
- Party host;
- Audience;
- Custom Builder;
- Decision Studio;
- Settings;
- dialogs/sheets;
- empty/error/loading/offline/update states.

## Exit criteria for V1

V1 is complete when:

- the baseline is machine-readable;
- major visual issues are ranked;
- one art direction is selected;
- visual hierarchy/color/shape/depth/icon/motion rules are explicit;
- responsive and interaction-state matrices are explicit;
- functional non-regression constraints are explicit;
- CI protects the redesign contract;
- no product behavior is changed.

The implementation rules for all following phases live in [REDESIGN-CONTRACT.md](./REDESIGN-CONTRACT.md).
