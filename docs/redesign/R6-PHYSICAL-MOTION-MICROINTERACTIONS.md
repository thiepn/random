# R6 — Physical Motion & Microinteractions

Status: **implemented**  
Direction: **Tactile Chance Arcade**  
Target: **v1.2.0**

## Objective

R6 gives the authored R5 objects physical behavior without changing result semantics.

The motion rule is:

> The result is committed first. Motion only presents it.

R6 does not decide outcomes, delay persistence, or recompute randomness.

## Motion architecture

R6 introduces `src/motion-system.js`.

It uses the Web Animations API for object physics while keeping V7 CSS responsible for result/reveal choreography.

Ownership is now:

- R5 SVG → object appearance;
- R6 Web Animations → object movement;
- V7 CSS → result reveal, text/result sequencing, reduced-opacity reveal;
- Presentation Engine → timing, mode, effect level, sound and haptic schedule.

This avoids multiple transform engines fighting over the same element.

## Object physics

### Coin — toss and settle

The Coin follows:

- lift;
- multi-axis rotation;
- slight off-axis wobble;
- descending catch;
- small contact compression;
- final settle.

The H/T face still uses V7's face-ink gate, so the committed face is not visually exposed before the reveal point.

### Dice — throw / bounce / settle

Each die receives:

- slightly different horizontal direction;
- lift;
- rotation;
- first landing;
- small rebound;
- final settle.

Multiple dice are staggered by a few milliseconds to avoid moving as a single rigid slab.

D6 pip/numeric ink still uses the V7 gate.

### Wheel — mechanical response

The dynamic segment disc continues using its existing result-targeted rotation.

R6 adds motion to the surrounding authored hardware:

- tiny rim torque;
- hub recoil;
- pointer mechanical oscillation;
- center readout settle.

Wheel audio ticks continue using the decelerating V7 tick schedule.

### Cards — deck kick + deal/flip

Card motion is now:

- deck recoil;
- card extraction;
- Y-axis face turn;
- slight overshoot;
- final printed-card angle.

The dynamic result is already committed before the deal begins.

### Tokens / chips

Picker, Sampler, Teams, Groups, and Pairs use:

- separated incoming chip trajectories;
- small independent rotations;
- scatter;
- stack/sort settle.

### Tickets / slips

Shuffle, Assignments, and Lottery use:

- opposing ticket entrance directions;
- loose paper rotation;
- final stack alignment.

### Instrument panel

Number, Chance, Date, Time, Coordinates, Direction, and Letter use:

- subtle hardware lift;
- stepped readout focus;
- small control-button pulses.

This is intentionally less theatrical than Coin/Dice/Wheel.

### Private envelope

Secret Santa receives:

- envelope arrival;
- small settle;
- wax-seal stamp response.

Private reveal remains visually restrained.

### Competition trophy

Elimination, Tournament, Ladder, and RPS receive:

- upward impact;
- controlled overshoot;
- contact settle.

### Color palette

Color swatches fan into position with short staggered card motion.

## Low-effects behavior

The Presentation Engine already resolves an effects level from:

- explicit user preference;
- Reduced Motion;
- hardware concurrency;
- device memory.

When R6 receives `effects="low"`, it skips the multi-part physical profile and applies one short bounded scale/opacity response.

This keeps low-end devices responsive.

## Reduced Motion

When `plan.reducedMotion` is true:

- R6 does not start WAAPI physical transforms;
- particles remain disabled by V7;
- long travel/spin/toss physics are skipped;
- V7's short opacity-only `.is-reduced-reveal` remains available.

R6 therefore does not replace Reduced Motion with another motion system.

## Cancellation correctness

R6 extends the existing presentation cleanup path.

`clearPresentationTimers(toolId)` now also calls:

`cancelPhysicalMotion(toolId)`

That means physical motion cancels on:

- new run;
- result invalidation;
- reset;
- reveal skip;
- changing tools;
- leaving the tool view;
- hidden-tab lifecycle handling.

### Pending-frame guard

Physical motion starts after two `requestAnimationFrame` turns so it sees the freshly rendered committed result.

A generation counter prevents a canceled reveal from launching later from one of those pending frame callbacks.

This avoids stale “ghost animations.”

## No perpetual idle animation

R6 deliberately does **not** make hero objects float, bob, rotate, or pulse forever.

Idle objects are static.

Fine-pointer hover can produce a short bounded object lift/tilt, and press produces a short compression.

Reduced Motion removes those object transforms.

This keeps the app lively without making result-reading visually restless.

## Microinteractions

Home/Arcade authored objects now respond to:

- hover → small lift/tilt/brightness;
- press → small contact compression.

These are limited to `hover:hover` + `pointer:fine` environments.

Touch devices do not receive hover simulation.

## Transform ownership cleanup

R6 removes duplicate object-transform ownership from older CSS.

Removed as live transform owners:

- V7 Coin `coinFlip` animation declaration;
- V7 Dice `diceRoll` animation declaration;
- V7 Wheel pointer transform animation declaration;
- V7 built-in Card deck/deal transform declarations;
- Tool Experience Coin flip animation;
- Tool Experience Dice roll animation.

V7 still retains:

- face-ink timing;
- result reveal;
- list/team/bracket choreography;
- reduced reveal;
- presentation impact/status behavior.

Historical keyframe definitions required for older compatibility contracts may remain where harmless, but R6 is the live built-in object transform owner.

## Custom tools

Custom Experience presentations map their existing presentation source kind into the closest R6 physics family:

- Wheel → Wheel;
- Card → Card;
- Dice → Dice;
- pick/table/text → Tokens;
- Shuffle → Tickets;
- generator/number → Instrument;
- private → Envelope;
- competition-like kinds → Trophy.

Unknown custom layouts fall back to the restrained Instrument profile.

## Safety

The R6 engine:

- has no randomness;
- has no remote dependencies;
- has no `innerHTML`;
- uses no dynamic code evaluation;
- cannot alter the result;
- only acts on the rendered stage.

## Offline

`src/motion-system.js` is:

- imported by the app;
- syntax-checked in CI;
- service-worker precached;
- covered by the offline-shell certification.

## Budget

R6 adds behavior primarily in JavaScript and removes duplicate CSS animation declarations.

Constraints remain:

- <=19 root stylesheets;
- <=175 KB CSS;
- <=1 MiB production JavaScript;
- <=425 KB `src/app.js`;
- <=15 KB V7 CSS;
- <=18 KB Tool Experience CSS.

## Functional boundary

R6 changes no:

- RNG;
- committed run data;
- persistence order;
- History;
- Session state;
- Pool/Rule models;
- portability;
- security/privacy semantics.

## Exit criteria

R6 is complete when:

- all 25 built-in tools resolve to a physical motion family;
- Coin/Dice/Wheel/Card use object-specific physics;
- token/ticket/instrument/envelope/trophy/palette profiles exist;
- low-effects behavior is simpler;
- Reduced Motion starts no R6 physical transform;
- active and pending motion can be canceled;
- leaving/invalidating a tool cancels motion through existing presentation cleanup;
- no duplicate live CSS transform owner remains for Coin/Dice/Card/Wheel pointer;
- hover/press microphysics are bounded and fine-pointer-only;
- no perpetual idle animation exists;
- offline/security/budget gates remain green.

## Next

**R7 — Themes, Personalization & Accessibility Art Pass**
