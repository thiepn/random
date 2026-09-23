# V7 — Results, Motion & Game Feel V2

## Objective

V7 consolidates Randomizer Arcade's presentation layer around one deterministic motion timeline:

**press → anticipation → action → reveal → settle → restrained celebration**

The random result remains committed before presentation begins. Motion, sound, haptics and particles are downstream feedback only.

## Timeline

Every non-instant presentation plan now exposes:

- `anticipationMs`
- `revealMs`
- `settleMs`
- `activeMs`
- `impactMs`
- `cueAtMs`
- `hapticAtMs`

The three phase durations always sum to the total presentation duration.

## Feedback synchronization

Sound and haptics no longer fire immediately when presentation starts.

- audio cue is scheduled just before the visual impact;
- haptic feedback is scheduled at impact;
- skipping a reveal cancels pending feedback;
- Silent workflow execution remains instant and feedback-free.

## Wheel feel

Wheel ticks now use a deterministic decelerating timeout schedule rather than a constant interval.

Built-in and Custom Wheel experiences share:

- the same tick schedule;
- the same active-spin duration;
- the same pending-rotation cleanup.

## Visual choreography

The existing presentation layer was replaced in-place rather than adding another stylesheet.

V7 updates:

- stage anticipation compression;
- result impact and settle;
- showtime result spring;
- Coin face conceal/reveal;
- Dice face conceal/reveal;
- Wheel pointer feel;
- Picker/Generator stagger;
- Shuffle dealing;
- Teams stagger;
- Pairs and Assignment linking;
- Cards draw while preserving V6 card rest rotation;
- Ladder rung/path drawing;
- Elimination/winner impact;
- Tournament dealing;
- quiet private reveal.

## Celebration

Celebration is deliberately constrained.

Normal mode uses fewer particles. Showtime uses more, but only eligible celebration surfaces receive the stronger treatment.

Secret Santa never receives particle celebration.

## History continuity

After a result commits, the Action Dock shows a lightweight status:

- while presenting: `Result committed · reveal in progress`
- after presentation: `Result committed · available in History`

This is visual continuity only; the existing live result announcer remains the sole screen-reader announcement path.

## Reduced motion

Reduced motion receives a first-class opacity-only timeline:

- no particles;
- no spatial transforms;
- no blur;
- no Wheel tick feedback;
- 180ms total reveal;
- 120ms fade + 60ms settle.

The global reduced-motion CSS explicitly exempts the V7 reduced reveal surface so this opacity transition is not collapsed to 0.01ms.

## Functional boundary

V7 does not alter:

- random result generation;
- Run creation;
- commit order;
- seeded positions;
- Session state;
- probabilities;
- Pool or rule models;
- persisted formats.

## Next phase

**V8 — Professional Surfaces: Pools, History, Presets, Builder & Studio**
