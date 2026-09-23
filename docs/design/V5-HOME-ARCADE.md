# V5 — Home / Arcade V2

Direction: **Expressive Utility Arcade**  
Depends on: **V2 Design System + V3 Brand/Iconography + V4 Adaptive Shell**

## Objective

V5 redesigns the two discovery surfaces:

- **Play/Home** becomes an editorial launcher that prioritizes the next useful action.
- **Arcade** becomes a complete, structured catalog instead of a sequence of equal-weight tool grids.

No new persistence model is introduced.

## Home hierarchy

The Home surface now follows this priority:

1. primary decision/search hero;
2. quick randomizers;
3. Continue unfinished work;
4. recently used tools;
5. Favorites;
6. saved Presets and guided Sessions;
7. exploration / browse-all entry.

This replaces the previous equal-weight stack of Favorites, Saved setups, Session Templates and Ready to play.

## Smart sections without new storage

### Continue

Continue is derived from existing active records:

- active stateful tool Sessions;
- active Template Sessions;
- active or paused Workflow Sessions.

V5 does not persist a second continuation list.

### Jump back in

Recent tools are derived from existing immutable Runs:

- Runs are ordered by timestamp;
- tool IDs are deduplicated;
- unavailable/deleted custom tools are ignored;
- no “recent tools” store is created.

### Favorites

Favorites continue using the existing favorites/custom-experience state.

## Hero

The Home hero combines:

- strong editorial headline;
- shared search;
- immediate “Pick something” action;
- browse-all action;
- visually distinct featured Wheel treatment.

The featured treatment is presentation-only. It does not change ranking, randomness, or tool behavior.

## Quick launch

Coin, Dice, Wheel and Number remain the four immediate zero-setup launch actions.

They are visually detached from the hero on larger screens to create clearer hierarchy.

## Tool cards

V5 introduces one shared card structure with presentation variants:

- `standard`;
- `compact`;
- `wide`;
- `feature`.

Variants affect layout only.

The underlying tool ID, click behavior, favorite state, description and accent continue to come from the existing registry/custom tool model.

## Saved & guided

Presets and Session Templates remain available from Home but are visually grouped as reusable/guided content rather than being treated as another randomizer grid.

The Home preview intentionally limits the number of cards shown. Full underlying state remains untouched.

## Arcade

The Arcade now includes:

- complete-library hero;
- built-in/custom/category counts;
- search across built-in and published custom tools;
- four category jump controls;
- custom creations section when applicable;
- dedicated category introductions;
- full tool coverage.

Each category uses one feature card plus standard cards, creating hierarchy without hiding any built-in tool.

## Categories

- Classics — fast decisions and core randomizers;
- People — split, pair, order and assign;
- Generators — numbers, dates, colors, directions and related output;
- Games — draws, brackets, cards, elimination and playful chance.

## Search

Home and Arcade use the same `state.search` model and the same search semantics already used before V5.

No search index, network service or analytics layer is introduced.

## Responsive behavior

The visual system supports:

- 320px single-column fallback;
- common phone two-column layouts;
- tablet three-column layouts;
- desktop four-column editorial grids;
- horizontally scrollable Favorites strip;
- wider cards spanning multiple columns;
- large category feature cards on desktop.

## Accessibility

V5 preserves:

- visible text labels for all tool cards;
- semantic buttons for tool/category actions;
- label-wrapped search fields;
- reduced-motion scroll behavior;
- forced-colors fallbacks;
- focus rules inherited from the design system;
- no color-only category/tool identification.

## Performance

V5 is CSS/DOM composition only.

It introduces:

- no image payload;
- no network request;
- no additional database query;
- no JS animation library;
- no generated canvas/WebGL surface.

Recent/Continue derivation operates only on already-loaded in-memory records.

## Scope boundary

V5 does not redesign the internals of:

- Coin/Dice/Wheel/etc. tool stages;
- controls;
- result choreography;
- Pools/History/Builder/Studio workbench surfaces.

Those remain V6–V8.

## Exit criteria

V5 is complete when:

- Home uses the new editorial hierarchy;
- Continue is derived from existing active session records;
- Recent is derived from existing Runs;
- Favorites remain existing state;
- Arcade still exposes every built-in tool;
- categories have direct jump navigation;
- search works on both discovery surfaces;
- card variants are responsive and accessible;
- V5 styles are offline-preloaded;
- CI verifies the V5 composition contract;
- prior regression and production certification remains green.

## Next phase

**V6 — Tool Experience V2**
