# V4 — Adaptive App Shell & Navigation V2

Direction: **Expressive Utility Arcade**  
Depends on: **V2 Design System + V3 Brand/Iconography**

## Objective

V4 replaces the old shell behavior where the mobile bottom navigation simply became a narrow vertical strip on wider screens.

The product now has three deliberate shell modes:

| Range | Shell |
| --- | --- |
| < 720px | touch-first bottom navigation + compact brand toolbar |
| 720–1179px | compact left rail + contextual top toolbar |
| ≥ 1180px | full application sidebar + contextual top toolbar |

The view/router model does not change.

## Mobile

Mobile keeps the familiar bottom-navigation model because it maximizes reachable content space and thumb access.

The V4 mobile shell includes:

- fixed five-destination bottom bar;
- safe-area-aware padding;
- compact sticky top toolbar;
- product lockup;
- randomness status;
- explicit Settings action;
- active-destination indicator;
- 360px-and-below compaction behavior.

The shell no longer spends a second top-bar action on opening Arcade because Arcade already exists in primary navigation.

## Tablet rail

At 720px the shell becomes a real two-column application frame:

- 84px navigation rail;
- brand mark at the top;
- vertically stacked destinations;
- contextual top toolbar;
- dedicated main-content grid area;
- local-first/offline status at the rail bottom.

The rail participates in layout rather than covering content with fixed left padding.

## Desktop sidebar

At 1180px the rail expands to 236px.

The full sidebar exposes:

- Random Spark + Randomizer Arcade lockup;
- navigation section label;
- icon + text navigation rows;
- strong current-destination marker;
- local-first/network status panel.

The toolbar becomes contextual rather than repeating the product brand.

Large desktop content can expand to the V4 1280px content width instead of remaining at the old 1120px ceiling.

## Context toolbar

The top toolbar now describes the current application context.

Examples:

- Randomizer Arcade / Play
- Browse / Arcade
- Automation / Decision Studio
- Library / Pools
- Activity / History
- Randomizer / Dice
- Guided session / {template name}

This information is hidden on mobile where screen-specific headers already carry the local context.

## Navigation ancestry

Subview routes preserve their parent navigation state:

- individual Tool → Play
- Template Session → Play
- My Creations → Arcade
- Builder → Arcade

This prevents the shell from appearing to have no active destination while the user is inside a nested workflow.

## Status and settings

Settings opening is centralized in one `openSettingsPanel()` action.

The toolbar exposes:

- Secure/Seeded randomness status;
- explicit Settings button.

Tablet/desktop navigation also exposes local/offline status without introducing a second settings path.

## Layout behavior

V4 introduces semantic layout tokens:

- `--content-max-wide`
- `--shell-mobile-nav-height`
- `--shell-rail-width`
- `--shell-sidebar-width`
- `--shell-topbar-min-height`

The main content receives `.shell-main` and `min-width:0` so grid children cannot force horizontal page overflow.

Existing feature-level responsive layouts remain unchanged. V4 only establishes the outer application frame.

## Accessibility

Preserved/improved:

- semantic `nav` with Primary navigation label;
- `aria-current="page"` follows parent navigation ancestry;
- icon + visible text labels remain available;
- tablet icons still retain labels and native title hints;
- keyboard focus behavior is unchanged;
- 44px+ coarse-pointer rules remain in force;
- reduced-motion disables shell transitions;
- forced-colors receives explicit active-navigation treatment;
- print mode removes application chrome;
- skip link continues to target `#main-content`.

## PWA and safe areas

Mobile navigation accounts for bottom safe-area inset.

Tablet/desktop rail accounts for top and bottom safe-area insets.

The top toolbar accounts for the mobile top safe-area inset.

V4 adds no JavaScript viewport detection. Layout mode is purely CSS-driven so orientation/window resizing does not mutate application state.

## Scope boundary

V4 does not redesign:

- Home/Arcade content composition;
- tool cards;
- tool stages;
- workbench/editor internals;
- Party fullscreen shell.

Those surfaces inherit the new outer frame and are redesigned in V5–V8.

## Exit criteria

V4 is complete when:

- the three shell modes are explicit and CSS-driven;
- primary navigation is no longer a mobile bar merely rotated on desktop;
- current context exists in the toolbar;
- parent navigation state remains visible for nested views;
- safe-area behavior is explicit;
- app-shell styles load after legacy and V3 styles;
- shell assets are offline-preloaded;
- CI verifies breakpoints, markup, accessibility hooks, safe areas, token coverage, and production size limits;
- all previous product regression/certification suites remain green.

## Next phase

**V5 — Home / Arcade V2**
