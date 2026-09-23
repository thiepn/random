# V8 — Professional Surfaces: Pools, History, Presets, Builder & Studio

Direction: **Expressive Utility Arcade — Workbench mode**

## Objective

V8 separates the product's professional/data-heavy surfaces from the playful randomizer surfaces.

The workbench language prioritizes:

- density;
- scanability;
- stable rows;
- command bars;
- inspectors;
- editor canvases;
- restrained status color;
- fewer nested rounded containers.

No data model, persistence format, or workflow semantics are changed.

## Shared workbench shell

V8 adds reusable workbench primitives directly to the core stylesheet:

- `.workbench-view`
- `.workbench-header`
- `.workbench-eyebrow`
- `.workbench-stats`
- `.workbench-header-actions`
- `.workbench-commandbar`

These surfaces use typography, separators, and density before adding containers.

## Pools

The Pools library is now a dense data library rather than a card grid.

Changes:

- command bar for search/archive state;
- active/View/item stats in the page header;
- flat Pool rows with compact metadata;
- subtle status badges;
- editor sections separated by rules rather than nested cards;
- spreadsheet-like item rows;
- transparent cells that become editable surfaces on hover/focus;
- sticky editor footer;
- compact Profiles/Views rows;
- clearer dirty Working Set state;
- warning/error information uses semantic side rails.

All Pool actions remain unchanged.

## History

History now reads as a chronological activity timeline.

Changes:

- vertical timeline rail;
- pinned/session markers;
- flat history groups;
- compact status chips;
- table-like Run previews;
- denser action controls;
- cleaner Run detail result/meta presentation.

Replay, Rerun, Details, Pinning, Resume, paging and immutable Run semantics remain unchanged.

## Presets and Session Templates

Saved Presets and Templates now use reusable library rows instead of independent cards.

Template Session runtime also adopts:

- compact progress;
- status side rails;
- dense step rows;
- quieter action hierarchy.

All saved items remain accessible.

## My Creations

Creation starter templates remain prominent, but the saved Creation library becomes a professional row list.

Built-in starter icons now use the shared SVG icon system rather than Unicode product glyphs.

## Builder

Builder is now a real editor workspace:

- left/main editor document;
- sticky Test + Validation inspector;
- sequential Identity / Randomization / Rules / Appearance sections;
- table-like Compound steps;
- persistent Save/Publish footer;
- semantic validation rails.

Test Mode remains deterministic and does not create Runs.

## Decision Studio

Decision Studio becomes a graph workbench:

- nodes are compact when unselected;
- selecting a node expands its configuration inline as an inspector;
- compact nodes still expose type, start status, incoming count and outgoing connection count;
- Enter/Space keyboard selection remains supported;

- workflow library rows;
- in-progress cards;
- configuration/palette sidebar;
- graph canvas with grid treatment;
- node-type accent system;
- visible input/output port affordances;
- selected/start-node hierarchy;
- dense node configuration areas;
- execution path timeline;
- sticky Save/Cancel footer.

Input nodes visually expose output-only connectivity and Outcome nodes input-only connectivity.

The graph remains the same safe declarative workflow model; V8 does not add freeform JavaScript or alter execution semantics.

## CSS migration

V8 rewrites these existing stylesheets in place:

- `phase4.css` — Pools
- `phase6.css` — History
- `phase8.css` — Presets/Templates
- `phase10.css` — Creations/Builder
- `phase11.css` — Decision Studio
- `phase13.css` — rendering containment cleanup

It also removes obsolete Pool/History/Studio defaults and pre-V4 shell overrides from `styles.css`.

No `phase15.css` or additive workbench stylesheet is introduced.

## Accessibility

V8 preserves:

- semantic buttons and form controls;
- visible labels;
- focus-visible handling;
- keyboard Decision Studio behavior;
- screen-reader labels on Builder/Studio sidebars;
- forced-colors fallbacks;
- touch-target rules;
- reduced-motion behavior from V7.

Visual node ports and timeline rails are decorative; they do not replace textual state.

## Functional boundary

V8 does not modify:

- Pool schemas/revisions;
- History grouping or immutable Run semantics;
- Preset/Template storage;
- Custom Experience validation/execution;
- Workflow validation/execution;
- randomization;
- IndexedDB schema;
- backup/restore formats.

## Exit criteria

V8 is complete when:

- all target surfaces carry Workbench mode classes;
- Pools/History use command-bar and row/timeline structures;
- Presets/Templates use dense reusable rows;
- Builder uses editor + inspector layout;
- Studio uses sidebar + graph canvas with node ports;
- existing actions remain reachable;
- V3 SVG identity is used on V8 product chrome;
- CSS remains below the production budget;
- V1–V8 and full functional release certification remain green.

## Next phase

**V9 — Themes, Responsiveness, Accessibility & Visual Resilience**
