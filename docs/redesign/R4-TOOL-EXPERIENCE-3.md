# R4 — Tool Experience 3.0

Status: **implemented**  
Direction: **Tactile Chance Arcade**  
Target: **v1.2.0**

## Objective

R4 makes the tool screen itself feel like the product.

The old v1.1 composition already separated Stage, Action Dock, and Setup, but they still read as three neighboring UI cards. R4 turns them into one chance machine with a dominant chamber, attached hardware console, and subordinate setup/instrumentation.

No tool logic changes.

## Composition

Every tool now follows:

1. compact identity header;
2. optional rules instrumentation;
3. recessed chance-object chamber;
4. attached primary action console;
5. progressive Setup panel.

The tool object/result remains the focal point.

## Tool identity

The header is intentionally quieter:

- smaller object mark;
- inset symbol housing instead of accent card;
- display typography for the tool name;
- one thin material rail;
- favorite/settings actions remain accessible but visually secondary.

## Machine frame

`.tool-play-column` is now the physical machine body.

It owns:

- material rim;
- stage radius;
- contact depth;
- rules strip;
- stage;
- action console.

Stage/action no longer appear as unrelated floating cards.

## Rule instrumentation

Active rules moved inside the machine body above the chamber.

The previous yellow pill language is removed.

Rules now read as an instrument line:

**RULES · Unique · Weighted · Automatic**

They use typography and separators rather than pill backgrounds.

## Result chamber

`.tool-stage-v2` is now a recessed chamber:

- material tray background;
- inset depth;
- strong physical rim;
- internal frame line;
- dominant result typography;
- no generic result glow;
- no per-family decorative stage background.

Tool family still sets a restrained machine accent.

The actual object—not the whole stage—carries tool personality.

This intentionally prepares R5, where Coin, Dice, Wheel, Cards, tokens, tickets, and generator instruments receive authored object art.

## Family behavior

The V6 family system remains:

- Coin
- Dice
- Wheel
- Cards
- Color
- List
- People
- Competition
- Private
- Generator

R4 removes family-specific decorative scene backgrounds while keeping all family hooks for layout, object styling, and motion.

## Results

List results now behave like a machine readout:

- shared rail;
- flat row sequence;
- no backdrop blur;
- no mini-card radius per result.

Team/group results use small physical bins rather than translucent floating cards.

## Action console

The Action Dock becomes `.tool-machine-console`.

### Primary action

The R2 tactile primary button remains the dominant hardware control.

R4 gives it:

- 62px machine-console height;
- display typography;
- tighter label tracking;
- direct attachment to the stage body.

### Secondary actions

Reset / Share / Use Result are deliberately smaller and flatter.

They no longer visually compete with the randomize action.

### Commit state

The “Result committed” readout becomes a compact machine-status line.

## Progressive Setup

Setup is now a native `<details>` surface.

Behavior:

- desktop: open by default;
- mobile before a result: open by default;
- mobile after a result: collapsed by default;
- errors force Setup open.

This keeps required configuration discoverable while letting the result dominate after the user has already configured and run the machine.

The native summary remains keyboard and screen-reader operable.

## Setup header

The summary reads:

- **Machine controls**
- **Setup**
- family-specific helper text.

A physical + / − control communicates expand/collapse state without relying only on color.

## Setup internals

Setup uses the R2 material language:

- inset fields;
- material separators;
- compact control grid;
- calm preset/party toolbar;
- fairness and selection-rule panels as recessed instrumentation;
- no dark-only hard-coded fairness surfaces.

## Fairness / rules cleanup

R4 removes the legacy Phase 2 styling that still used:

- yellow rule pills;
- blue-black fairness cards;
- translucent white toolbar backgrounds;
- hard-coded dark weight fields;
- cyan-only probability emphasis.

Fairness now consumes semantic material/accent tokens.

## Mobile ergonomics

At <=620px:

- stage minimum is 20rem;
- action button is 56px;
- Setup becomes one-column;
- helper copy is reduced;
- header controls shrink slightly.

At <=380px:

- decorative symbol housing disappears;
- stage minimum drops to 18rem;
- Wheel/Cards scale down.

Short landscape mobile uses a 14rem minimum stage.

## Desktop

At >=760px:

- stage grows to 32rem;
- Setup is sticky;
- machine receives a larger share of horizontal space.

At >=1180px:

- stage grows to 35rem;
- primary action grows to 64px.

At ultrawide sizes the machine/setup split becomes approximately 1.75 : .5.

## Reduced Motion repair

R4 also fixes a regression discovered after R3 certification.

When global Reduced Motion ownership moved into `phase14.css`, the blanket rule accidentally collapsed V7’s intentionally retained opacity-only `.is-reduced-reveal` animation.

R4 restores the exemption:

- normal motion remains disabled;
- V7 reduced reveal retains its short opacity transition;
- no particles/travel are restored.

The V7 certification now checks the actual accessibility owner.

## Architecture

R4 follows the same no-layering rule:

- no new root stylesheet;
- `tool-experience.css` is rewritten in place;
- legacy rule/fairness visuals are removed from `phase2.css`;
- Reduced Motion ownership stays in `phase14.css`;
- V7 motion choreography remains in `phase7.css`.

## Budget

R4 remains below:

- 19 root stylesheets;
- 175 KB total CSS;
- 18 KB Tool Experience CSS;
- 425 KB app controller.

## Functional boundary

R4 does not change:

- random algorithms;
- input models;
- Session semantics;
- Pools;
- Presets;
- Templates;
- Party Mode;
- History;
- persistence;
- portability;
- privacy/security.

## Exit criteria

R4 is complete when:

- Stage + Rules + Action read as one physical machine;
- Setup uses progressive native disclosure;
- Setup opens automatically when configuration/error requires it;
- Setup collapses after a mobile result;
- primary action clearly dominates secondary actions;
- family scene gradients no longer define stage identity;
- result rows no longer use glass/backdrop blur;
- fairness/rules use semantic materials;
- V7 reduced reveal remains intentionally visible;
- no new stylesheet is added;
- V6/V7 behavior remains certified;
- production budgets pass.

## Next

**R5 — Hero Objects, Graphics & Art**
