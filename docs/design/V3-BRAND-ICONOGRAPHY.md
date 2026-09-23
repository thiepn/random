# V3 — Brand, Iconography & Visual Assets

Direction: **Expressive Utility Arcade**

## Objective

V3 replaces Randomizer Arcade's mixed Unicode-symbol identity with a coherent local SVG language while preserving all user data and compatibility fields.

This phase improves visual identity and asset quality. It does not perform the full adaptive shell, Home, or tool-stage redesigns scheduled for V4–V6.

## Brand mark — Random Spark

The v1.1 mark is called **Random Spark**.

It combines:

- a central four-point chance spark;
- two small orbiting nodes;
- a compact silhouette that works at favicon, navigation, and PWA-icon scale.

The mark avoids letters so it remains language-independent and recognizable at small sizes.

The PWA/favicon asset is mask-safe: the identifying mark is inset well inside the 512×512 canvas instead of relying on outer corners.

## SVG grammar

All built-in UI icons use:

- 24×24 viewBox;
- 1.8px stroke;
- round caps;
- round joins;
- `currentColor`;
- simple geometric construction;
- no external icon library;
- no runtime fetch.

This makes the icon family consistent across browser/platform font differences.

## Coverage

### Navigation

- Play
- Arcade
- Studio
- Pools
- History

### Categories

- Classics
- People
- Generators
- Games

### Built-in tools

All 25 built-in tools have dedicated SVG identities.

### Shared actions

V3 also defines reusable brand-consistent icons for:

- back;
- search;
- settings;
- favorite;
- template;
- lock;
- workflow input/branch/output.

## Compatibility

The registry's legacy `icon` strings are retained.

They remain useful for:

- older persisted/history records;
- portable data compatibility;
- custom experience defaults;
- text-only fallbacks.

Built-in visual rendering now prefers `iconId` + the SVG system.

Custom Experiences continue to display user-selected glyphs because that value is user content, not built-in brand chrome.

## Accessibility

Decorative SVGs use `aria-hidden="true"` and `focusable="false"` when adjacent visible text already names the tool/action.

Icon-only buttons keep their existing accessible `aria-label` and title.

Icons inherit `currentColor`, so:

- tool accents remain contextual;
- high-contrast mode can override them;
- forced-colors mode does not depend on hard-coded fills.

## Performance

The entire built-in icon catalog is declarative JavaScript geometry.

There are:

- no remote requests;
- no icon font;
- no external sprite;
- no large raster assets;
- no additional framework dependency.

Only the new PWA brand SVG is a standalone image asset.

## Visual-asset boundary

V3 establishes the identity primitives.

Later phases use them as follows:

- **V4** — adaptive shell/navigation;
- **V5** — Home/Arcade composition and category art;
- **V6** — tool-specific stages and physical-object treatments;
- **V8** — professional workbench/editor icon usage.

## Exit criteria

V3 is complete when:

- Random Spark replaces the old PWA/app mark;
- all built-in tools have SVG icon IDs;
- all categories have SVG icon IDs;
- primary navigation uses SVG icons;
- built-in tool cards, quick actions, tool headers, Presets, Party, Audience and History prefer SVG icons;
- user/custom glyph compatibility is preserved;
- icon CSS is offline-preloaded;
- CI verifies icon coverage, geometry, accessibility conventions and asset safety.

## Next phase

**V4 — Adaptive App Shell & Navigation V2**
