# V6 — Tool Experience V2

Direction: **Expressive Utility Arcade**  
Depends on: **V2 Design System + V3 Brand/Iconography + V4 Shell + V5 Discovery**

## Objective

V6 redesigns the randomizer work surface itself.

The previous app used one broadly shared visual recipe:

tool header → dark rounded stage → dark rounded controls.

V6 keeps the stable randomizer behavior but changes the interface hierarchy to:

**Tool identity → result stage → primary action → secondary setup/workbench**

This makes the current result and the next action visually dominant while configuration, presets, fairness and advanced settings recede.

## Structural anatomy

Every standard Tool screen now contains:

- enriched Tool identity header;
- tool-family label;
- description;
- result Stage;
- dedicated primary Action Dock;
- secondary Setup workbench.

The Action Dock owns:

- Randomize / Roll / Spin / Draw / etc.;
- reset actions for stateful tools;
- Share;
- Use Result In….

These actions are no longer buried at the bottom of the setup card.

The Setup workbench continues to own:

- inputs;
- list/Pools integration;
- numeric options;
- rules and constraints;
- Session context;
- presentation mode;
- Preset saving;
- Party Mode;
- randomness explanation;
- fairness details.

## Visual families

V6 introduces stable visual families rather than making every randomizer look identical.

### Coin

Warm metallic physical-object stage with concentric probability rings and a tactile coin.

### Dice

Dark red tabletop stage with physical dice.

D6 now renders real pip faces. Other die sizes retain numeric faces because pips would misrepresent non-six-sided dice.

### Wheel

Circular spinner-focused stage retaining the existing weighted segment model, labels and deterministic rotation semantics.

### Cards

Deck-table stage with:

- stacked deck back;
- Random Spark deck mark;
- actual playing-card face;
- rank/suit corners;
- red/black suit treatment.

### Color

Neutral checker/studio stage that lets the generated swatch dominate.

### List

Picker, Sampler and Shuffle use a quieter list-oriented stage.

### People

Teams, Groups, Pairs and Assignment use a cool arena/data-grid treatment with stronger team/result containers.

### Competition

Elimination, Ladder and Tournament use a warmer game-draw stage.

### Private

Secret Santa uses a quieter, lower-spectacle private-reveal stage.

### Generator

Number, Chance, Lottery, Date, Time, Coordinate, Direction, Letter and RPS use a precise grid/generator treatment.

Custom Experiences inherit a family from their configured layout/primitive.

## Tool identity

Tool headers now expose:

- Back;
- family classification;
- tool icon;
- tool name;
- description;
- Favorite;
- Settings.

The header is compact on small screens and richer on desktop.

## Primary action hierarchy

The new Action Dock sits immediately below the Stage.

This fixes the old interaction order where the user had to move through setup before reaching the primary action.

Existing disable rules remain unchanged:

- compute in progress;
- replay mode;
- empty Card deck.

Stateful reset semantics are unchanged.

## Setup workbench

The Setup card is intentionally calmer than the Stage.

It gains a stable heading and a family-aware description while keeping all existing controls and advanced systems.

Desktop keeps the setup workbench sticky so long forms remain usable while the result stage stays visible.

## Existing presentation system preserved

V6 does **not** replace Phase 7 presentation choreography.

The following remain authoritative:

- coin flip timing;
- dice roll timing;
- wheel rotation;
- card draw animation;
- list result stagger;
- team reveal;
- ladder draw/path animation;
- tournament reveal;
- private reveal;
- celebration modes;
- reduced-motion fallbacks.

The V6 DOM keeps the existing selector hooks needed by these animations.

## Party/Audience compatibility

Party Mode continues to reuse the same Stage renderer.

Because V6 adds family classes inside `buildStage()`, Party inherits the improved physical/result surfaces while the existing Party scaling rules continue to own fullscreen sizing.

No Party privacy behavior changes.

## Accessibility

V6 preserves:

- icon-only button labels;
- visible tool titles/descriptions;
- keyboard focus behavior;
- reduced-motion presentation paths;
- forced-colors fallbacks;
- semantic result text in addition to decorative physical visuals;
- existing fairness/status announcements.

Physical visualizations never replace the textual result.

## CSS migration

V6 deliberately removes the old generic tool-stage/physical-object rules from `styles.css`.

This includes legacy ownership of:

- generic Tool screen/stage;
- Coin object;
- Dice objects;
- Wheel;
- Card deck;
- Color swatch;
- generic result/team presentation rules now scoped to Tool stages.

`tool-experience.css` becomes the semantic owner.

Existing specialized CSS in Phase 1 / Phase 7 / Phase 9 remains where it still represents:

- Ladder/bracket/private specialized components;
- presentation choreography;
- Party/Audience scaling.

## Functional boundary

V6 does not modify:

- random algorithms;
- probabilities;
- seeded sequence semantics;
- Run commit ordering;
- Session model;
- Pool/WorkingSet model;
- rules/constraints;
- Preset/Template formats;
- Party privacy;
- storage schemas;
- backup format.

## Exit criteria

V6 is complete when:

- Tool screens use the Stage → Action Dock → Setup hierarchy;
- all built-in tools resolve to an explicit visual family;
- custom Experiences receive a family from existing appearance metadata;
- D6 uses real pips;
- Cards use a physical card/deck visualization;
- existing animation hooks remain available;
- legacy stage CSS is removed rather than duplicated;
- V6 styles are offline-preloaded;
- CSS remains inside production limits;
- V1–V6 and the full functional suite remain green.

## Next phase

**V7 — Results, Motion & Game Feel V2**
