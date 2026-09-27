# Hero pattern tiles

Pattern tiles for designed hero slides (`web/src/lib/heroDesign.ts`).

They are **masks**, not artwork: greyscale, where the art is the luminance. A
designed slide fills a shape with the colour from its config and masks it with
the tile, so the pattern's colour is a value a channel edits rather than
something baked into a file. Recolouring was impossible with the original
red-on-transparent PNGs these were derived from.

| file | used by | why this format |
| --- | --- | --- |
| `sadu-mask.webp`, `lattice-mask.webp` | the dashboard's inline SVG | 2x, fetched by URL and cached by the browser |
| `sadu-mask-1x.png`, `lattice-mask-1x.png` | `server/src/lib/heroSvg.ts` | embedded as a data URI, so PNG — the served SVG is loaded via `<img>` (it may not fetch anything) and can be rasterised downstream by renderers with no WebP decoder |

The 1x copies are quantised to four grey levels, which is enough for two-tone
textile art and cuts the embedded bytes about fivefold (sadu 99KB -> 18KB).

Derived from the `assets/` folder of the Sadu Night / Arrow Window design
reference exports: take the alpha channel of the single-colour source tile,
save it as greyscale, and quantise the 1x copy.
