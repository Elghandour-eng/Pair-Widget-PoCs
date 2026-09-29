# Builder.tsx refactor plan — split into files of ≤ ~350 lines

`web/src/pages/Builder.tsx` is 2,166 lines: one `Builder` shell component, ~12 shared field
primitives, and 14 section pages. Everything below is a pure file move — no behavior, prop,
or markup changes — so the diff is verifiable by `tsc` + `vite build` alone.

## Target layout

New folder `web/src/pages/builder/`, keeping `pages/` flat otherwise. Groupings follow the
existing line ranges in Builder.tsx:

| New file | Moves (current lines) | ~Lines |
|---|---|---|
| `builder/index.tsx` | imports, `Section` type, `SECTIONS`, `Builder` shell, `PushChip` (1–322) | ~330 |
| `builder/fields.tsx` | `Get`/`Set`/`PageProps`, `Field`, `BilingualField`, `ColorField`, `ToggleField`, `SelectField`, `NumField`, `FontField`, `ChoiceField`, `BrandColorField` (323–545), `PlainBiField`, `ItemBiInputs` (629–710), `ShadowFields` (1307–1320) | ~320 |
| `builder/ThemeLanguagePages.tsx` | `ThemePage`, `ThemeCard`, `LanguagePage`, `LangCard` (546–628) | ~90 |
| `builder/HeaderHeroPages.tsx` | `HeaderPage` (711–767), `StoredSlide`, `HeroPage`, `CarouselSection`, `DesignEditor` (768–1015) | ~310 |
| `builder/QuickLinksPage.tsx` | `QuickLinkCard`, `QuickLinksPage` (1016–1162) | ~150 |
| `builder/PromptsPage.tsx` | `PromptChip`, `PromptsPage` (1163–1306) | ~150 |
| `builder/InputPage.tsx` | `InputPage` (1321–1475) | ~160 |
| `builder/LauncherLoadingToastPages.tsx` | `LauncherPage` (1476–1573), `LoadingPage` (1574–1629), `ToastPage` (1630–1671) | ~200 |
| `builder/MessagesRatingPages.tsx` | `MessagesPage` (1672–1741), `RatingPage` (2085–2166) | ~160 |
| `builder/PreChatPage.tsx` | `PreChatFieldRow`, `PreChatPage` (1742–1934) | ~200 |
| `builder/ConsentPage.tsx` | `ConsentPointRow`, `ConsentPage` (1935–2084) | ~155 |

Every file lands well under 350; `index.tsx` and `fields.tsx` are the two near the cap, and
both shrink further as imports are pruned per file.

## Shared surface

- `fields.tsx` exports `PageProps` (`{ get; set; disabled }`), `Get`, `Set`, and all
  primitives — every page file imports from it. This is the only new internal API; it
  already exists implicitly.
- Pages that also take `draft`/`setDraft` (`Theme`, `Language`, `Hero`, `Messages`,
  `PreChat`, `Consent`, `Rating`) keep their current prop shapes. If desired later, a
  `DraftProps` alias in `fields.tsx` can dedupe the repeated
  `{ draft: WidgetConfig; setDraft: (fn) => ... }` signature — optional, cosmetic.
- The big `lucide-react` import block splits naturally: each file imports only the icons
  its own JSX uses.

## Wiring

1. `builder/index.tsx` imports each page and keeps the existing `section ===` switch/render
   exactly as-is.
2. Replace `pages/Builder.tsx` with a one-line re-export
   (`export { Builder } from './builder'`) — `routes.tsx` and any other importer stay
   untouched. Optionally point `routes.tsx` at `./builder` directly and delete the shim.

## Order of work (each step compiles)

1. Create `builder/fields.tsx` (primitives + bilingual helpers + ShadowFields); Builder.tsx
   imports from it. Build.
2. Move pages out one file at a time, in table order; Builder.tsx imports each. Build after
   each move (mechanical: cut block, add imports the moved code needs).
3. Move the shell to `builder/index.tsx`, reduce `pages/Builder.tsx` to the re-export shim.
4. Verify: `tsc --noEmit`, `vite build`, then open the builder and click through all 14
   sections against the live preview frame — postMessage flow (`pws:config`, push chips,
   apply-pushed) lives entirely in `index.tsx` and is untouched.

## Not in scope

No renames, no prop redesign, no state-management changes, no extraction of the
`Builder` shell's save/share/publish handlers into hooks. Those are worthwhile follow-ups
but would turn a verifiable move into a behavior-risk change.
