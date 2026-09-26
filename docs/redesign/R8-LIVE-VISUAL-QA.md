# R8 Live Visual QA — v1.2.0 Release Candidate

Status: **verified**  
Visual payload head: `215abff4b6db97a07cf8c7bdc0ab1536fbc8b334`  
Pages workflow: `36211622306` — **success**  
Pages artifact: `10895961562`  
Artifact digest: `sha256:4df731ad58e20dc6d52757dfbacfcdea63e4a92bae6c98e1308221a47aa64698`  
Browser: **Chromium 144.0.7559.96**

## Method

The exact GitHub Pages artifact produced from the visual payload head was downloaded and extracted.

The execution environment applies an administrator URL policy that blocks Chromium navigation even to localhost. To avoid substituting source inspection for rendering, the extracted production HTML/CSS/ES-module sources were loaded into a real headless Chromium document through an in-memory import-map/blob-module harness.

Only persistence was replaced with an in-memory QA shim because opaque `about:blank` documents cannot use IndexedDB. The visual/runtime code, CSS, tool engines, authored SVG art, motion system, navigation, rendering logic, and randomizer interactions were the production artifact bytes. Persistence, portability, security, offline and storage behavior remain independently covered by the repository CI suite.

## Captured matrix

**39 rendered screenshot/checkpoint states** were inspected.

### Home / Arcade

Rendered without document-level horizontal overflow, console errors, visible `null`, or visible `undefined`:

- Home — 320 / 390 / 768 / 1440 / 1920 widths;
- Home — Day Table and Night Cabinet;
- Arcade — 320 / 390 / 1440;
- Arcade — Day Table and Night Cabinet;
- 320px text-zoom stress;
- 320px offscreen content-visibility paint verified after scrolling into view.

### Core tool visuals

Idle and committed-result states were rendered for:

- Coin;
- Dice;
- Wheel;
- Cards;
- Teams;
- Number;
- Secret Santa.

Reduced Motion Coin state was also rendered.

### Accessibility / input

Rendered or directly inspected:

- Higher Contrast;
- Forced Colors;
- Large Controls;
- Reduced Motion;
- keyboard focus;
- touch interaction;
- Pools;
- History;
- Decision Studio.

Keyboard focus reached the Settings control with a visible **3px solid** focus outline.

### All 25 tools

Every built-in Arcade tool was opened in Chromium and its primary action was executed using Instant presentation where available.

Result:

- **25 / 25** tools opened;
- **25 / 25** retained authored machine art;
- **25 / 25** primary actions executed;
- **0** runtime-randomize errors;
- **0** page errors;
- **0** visible `null` / `undefined`;
- **0** document-level horizontal-overflow failures.

### Long-label Wheel

A 390px Day Table Wheel was tested with four deliberately long options, including:

`Another extremely descriptive option label with many words`

The Wheel and committed result remained within the 390px viewport with no document-level horizontal overflow.

### Accent matrix

All eight accents were applied under both Day Table and Night Cabinet:

- Violet;
- Cyan;
- Blue;
- Pink;
- Red;
- Gold;
- Green;
- Orange.

**16 theme/accent states** were checked. The eight accents produced eight distinct primary-hardware backgrounds while retaining the correct environment.

## Findings fixed during live QA

The rendered-artifact pass exposed two actual runtime defects before release.

### Optional DOM children rendered as text

Native `Element.append()` converts nullish children to visible text. Conditional stage/body rendering could therefore expose unwanted `null` / `undefined` strings.

Fixed by introducing `appendPresent(parent, ...children)`, converting high-risk stage/modal/body paths to the helper, and adding `tests/dom-optional-children.mjs`.

### String result subtitle inheritance

String results inherit `String.prototype.sub`, so optional chaining against `result?.sub` could treat the inherited function as subtitle content.

Fixed by accepting subtitles only when:

`result` is an object and `result.sub` is a string.

The R8 certification now protects this boundary.

## Result

No unresolved visual/runtime release blocker remains in the tested matrix.

The live visual QA gate is **verified**.

The R8 release decision remains temporarily **hold** only so this evidence-recording commit can receive its own exact-head CI and Pages result before the atomic v1.2.0 version/release commit.
