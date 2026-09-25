# R3 — Shell, Home & Arcade Composition

Status: **implemented**  
Direction: **Tactile Chance Arcade**  
Target: **v1.2.0**

## Objective

R3 changes the application’s first impression from **dashboard + cards** to **quiet cabinet + chance machines**.

The information architecture remains familiar. Search, recent activity, favorites, active sessions, presets, templates, custom tools, and all 25 built-in tools remain accessible.

The change is compositional:

- application chrome retreats;
- one chance object dominates Home;
- quick actions become a machine bay;
- tool discovery uses machine windows/nameplates rather than decorative cards;
- Arcade categories behave like cabinet sections;
- workbench/product functionality remains untouched.

## Shell — quiet cabinet

The shell now uses the R2 material system directly.

### Removed visual behaviors

- translucent/glass navigation treatment;
- topbar gradients;
- backdrop blur;
- decorative sidebar card treatment;
- gradient brand container;
- framed desktop network-status card.

### Current shell model

#### Mobile

- compact physical bottom rail;
- panel material with top rim;
- selected destination uses a raised hardware state;
- structural active marker remains;
- no blur dependency.

#### Tablet

- 78 px quiet rail;
- brand mark without decorative gradient housing;
- compact navigation controls;
- network status collapses to a minimal state mark.

#### Desktop

- 216 px sidebar;
- flatter brand lockup;
- 44 px navigation rows;
- subtle selected hardware state;
- footer separated by a single material rail rather than another card;
- 64 px contextual topbar.

The shell should frame the chance object, not compete with it.

## Home — arcade entrance

Home remains `.home-v2`, but the composition is now an entrance rather than a dashboard.

### Hero bay

The hero is one physical cabinet opening.

Content hierarchy:

1. small **Chance cabinet** label;
2. **Leave it to chance.** display headline;
3. one-sentence explanation;
4. **Pick for me** primary hardware action;
5. **Open the Arcade** secondary action;
6. search;
7. one **House Machine**.

The House Machine is the Wheel. R5 will replace the current icon-led placeholder with authored hero-object art; R3 establishes the scene and hierarchy first.

### House Machine

The featured Wheel now sits inside:

- recessed tray;
- physical circular machine window;
- rim;
- internal ring;
- machine nameplate;
- hover lift / pressed state.

The result is intentionally object-oriented even before R5 adds final artwork.

### Quick Bay

Coin, Dice, Wheel, and Number no longer float as four mini cards.

They occupy one recessed **QUICK BAY** with four compact controls.

This makes the section read as machine hardware rather than another content grid.

## Home secondary content

### Continue

Active sessions remain available, but the default mobile treatment becomes a quiet list separated by rails.

At larger widths they can use compact bounded surfaces.

### Recent / Favorites / More machines

Tool discovery now uses the same machine-tile grammar as Arcade.

### Saved & guided

Presets and Session Templates remain complete—no preview-only truncation—but their surrounding Home panels lose heavy card framing. They are visually subordinate to the randomization entry point.

## Machine-tile grammar

The existing `.tool-card-v2` semantic component is retained for compatibility, but its visual meaning changes.

A machine tile contains:

1. **machine window** — recessed inset surface;
2. **chance object placeholder** — tool SVG icon until R5 authored art;
3. **accent ring** — constrained to the object, not the full surface;
4. **nameplate** — tool name / compact description;
5. optional favorite hardware indicator.

### Variants

- standard — single machine;
- compact — shortcut/shelf machine;
- wide — landscape machine bay;
- feature — category anchor machine.

These variants no longer rely on colorful gradient-card backgrounds.

## Arcade — cabinet collection

The Arcade retains registry-driven categories and search.

### Header

Copy is shortened to:

- **Machine library**
- **Choose a machine.**
- **Pick the kind of chance you need.**

This is intentionally less product-marketing-heavy.

### Category selector

Category jumps become sticky cabinet hardware:

- recessed outer tray;
- four quiet category controls;
- category color restricted to icon identity;
- descriptions suppressed at the narrowest width.

### Category staging

Each category keeps:

- category icon;
- label;
- count;
- concise explanation;
- machine grid.

The first tool remains the larger category feature, but all tools share the same physical machine grammar.

## Color discipline

`home-arcade.css` uses **no gradient backgrounds**.

Color is restricted to:

- tool object/icon;
- category identity;
- primary action;
- selected/favorite state.

Environment and container composition use R2 material tokens.

## Responsive behavior

R3 preserves:

- 360 px and below;
- 520 px and below;
- 640 px;
- 900 px;
- 1180 px;
- short landscape mobile;
- 1600 px shell expansion;
- safe areas;
- Reduced Motion;
- Forced Colors.

At 360 px, the machine collection becomes a single column while category controls remain a compact 2×2 cabinet selector.

## Accessibility

R3 preserves:

- semantic primary navigation;
- main landmarks;
- search labels;
- category navigation labels;
- keyboard-operable tool buttons;
- visible focus states;
- structural active navigation indicator;
- reduced-motion smooth-scroll fallback;
- Forced Colors;
- browser zoom.

No functionality is communicated only through machine material or shadow.

## Architecture

R3 follows the R2 rule: **rewrite in place; do not add an override stylesheet.**

Root CSS remains at **19 stylesheets**.

Primary R3 ownership:

- `app-shell.css` — cabinet shell;
- `home-arcade.css` — entrance, machine tiles, Arcade cabinet;
- `design-system.css` — shell sizing/material tokens;
- `src/app.js` — concise Home/Arcade copy and existing composition semantics.

## Budget

R3 keeps:

- `home-arcade.css` under its historical 18 KB ceiling;
- `app-shell.css` under 10 KB;
- total CSS under 175 KB;
- `src/app.js` under 425 KB;
- root stylesheet count at 19.

R4 must continue the same strategy: replace Tool Experience styling in place rather than adding a new override layer.

## Functional boundary

R3 does not change:

- random engines;
- Pool/Session models;
- History semantics;
- favorites;
- Custom Experience definitions;
- presets/templates;
- Decision Studio;
- storage;
- portability;
- PWA lifecycle;
- privacy/security.

## Exit criteria

R3 is complete when:

- shell glass/gradient chrome is removed;
- Home has one dominant House Machine;
- Home primary action is visually dominant;
- quick tools read as one hardware bay;
- tool discovery reads as machine windows/nameplates;
- Home/Arcade use no decorative gradients;
- Arcade category controls are sticky cabinet hardware;
- registry-driven category/tool behavior remains intact;
- no new root stylesheet is introduced;
- historical V4/V5 contracts remain behaviorally valid;
- CSS and app budgets pass.

## Next

**R4 — Tool Experience 3.0**
