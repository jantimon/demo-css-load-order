# Building visual explainers

This repo is a one-page interactive explainer: static HTML, CSS and JS, no build step, hosted on GitHub Pages. These notes cover what makes a page like this work and the mistakes that cost the most time while building it.

## The reader

Write for a developer who sees the topic for the first time, has little time, dislikes walls of text and is curious. Every choice below follows from that.

- **One idea per figure, one change per step.** Each figure changes exactly one thing compared with the one before it.
- **Show, then name.** Let the figure carry the explanation. Prose sets up the figure in one or two sentences and does not repeat it.
- **No reading while things move.** During an animation, captions are short titles ("Back home → blog.css wins against home.css"). Full sentences appear only when nothing moves, or in the prose around the figure.
- **Build up the reader's wish before the problem.** Section 01 makes the reader want CSS chunking before section 03 shows the bug it causes.
- **Be exact.** Every claim must hold up when a reader checks it. When a figure simplifies (here, DevTools showing a dimmed rule that doesn't match the element), keep the simplification small and on purpose.

## Pacing

The most frequent feedback was "too fast". Defaults that worked:

- Give the reader **about 2.5 s** to read code before anything animates.
- Show the **cause first, then the effect about 0.9 s later**: the log line appears, then the code it runs lights up.
- After a result appears, such as a page preview, **hold about 1 s** before the next thing moves.
- One flight or transition takes **1–1.3 s**, not 0.5 s.
- Start animations with an `IntersectionObserver` when the figure is in view. Offer Replay. With `prefers-reduced-motion`, show the end state and never autoplay.

## Color is meaning

Pick three or four tokens and use them everywhere: in prose, code cards, DevTools, chips and diagrams.

| Token | Meaning here |
| --- | --- |
| amber `--home` | `home.css` and the home page |
| cyan `--blog` | `blog.css`, the blog, and highlighted key words |
| violet `--shared` | anything that belongs to the shared `Header` |
| red `--bad` | what breaks |

When a reader sees violet in two chunks, they understand "same file, copied twice" without text.

## Layout and motion rules

- **Nothing jumps.** Reserve space for content that appears later: empty dashed slots that fill up, `min-height` on lists and panels. Measure each step's height and make it equal.
- **Persistent things stay put.** Use keyed rendering so an element that exists in two steps is updated, not removed and re-added. A rule that "pops in again" reads as a new event.
- **Hidden start states before the first paint.** An inline `<script>` in `<head>` adds `html.js`. Hide elements with `.js .figure …`, never with a class that JS adds later, or they flash and fade out on a fast scroll.
- **Stacked scroll sections:** `position: sticky` cards plus `animation-timeline: view()`.
  - Give each card its own named timeline (`--cover2`, `--cover3`, …) and list them in `timeline-scope` on the parent.
  - Dim a covered card with `filter: brightness()`, not `opacity`, or the card below shows through.
  - A card taller than the viewport needs `top: min(0, 100vh - height)`, set from JS with a `ResizeObserver`, so its end is not covered unread.
  - Gate the effect with `@media (min-width: 820px) and (min-height: 600px)`. Phones get normal flow.
- **Wide-only extras.** Extra visuals such as the browser previews in Fig. 2 appear only where there is room (`min-width: 1200px`). The figure must work without them.

## CSS pitfalls hit in this repo

- **Class name clashes.** `.big`, `.note`, `.src` and `.pv` each broke a figure, because another figure already used the same short name. Give each figure's classes a prefix.
- **Code fonts.** JetBrains Mono turns `=>` into an arrow through `calt`. Turn off `liga` and `calt` on `pre`, `code` and DevTools with enough specificity to beat a `font` shorthand.
- **`display: flex` on a text caption** collapses the spaces around inline elements.

## Verify in a real browser

Never trust a screenshot from `chrome --headless --screenshot`: its virtual time freezes transitions mid-way and it has a minimum window width. Use Playwright instead:

- Take screenshots at fixed times after scrolling a figure into view, at the start, in the middle and at the end.
- At every step, measure figure heights and check that they are equal.
- At 390 px width, check `document.documentElement.scrollWidth === 390`.
- Collect `pageerror` and console errors.
- Drive the controls: click Swap, open the dialog, press Esc.

## Assets

- **Hero image:** generated with an image model (dark, high contrast, empty sky where the headline sits), converted to WebP at about 35 KB.
- **Social card:** an HTML page at 1200 × 630 in the page's own fonts and colors, captured with Playwright. `og:image` must be an absolute URL.
- **Invented brand:** use a made-up brand ("Ember Ridge"). Never imitate a real company.

## Writing

Plain words, short sentences, active voice. No metaphors, no filler. Headlines have no trailing period. One blue key word per section heading guides the eye.

## Structure of this repo

- `index.html`: four stacked sections (`#why`, `#order`, `#click`, `#hard`), then the about and sources footer.
- `main.js`: one block per figure.
  - **Fig. 1:** paint-time race.
  - **Fig. 2:** CSS files fly into chunks, then browser previews appear.
  - **Fig. 3:** browser plus DevTools stage, a step machine with keyed rendering. `?step=N` opens a step.
  - **Fig. 4:** code with an event log.
  - **Fig. 5:** swap the `<link>` order, plus the `@layer` dialog.
  - **Fig. 6:** priority table computed from an import graph.
- `styles.css`: tokens in `:root`, then one block per figure.
