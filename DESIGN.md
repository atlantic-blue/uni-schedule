# Design

The people using this are students on a shift, often on a phone, often in a hurry.
So the app has to answer one question fast: where am I, and when. Everything else
is secondary to that.

## Rules

1. Mobile first. The narrow layout is the real one. The wide layout is the bonus.
2. One accent colour. Indigo. Nothing else is allowed to be bright.
3. Status is never colour alone. Every state carries a word as well, because a
   colour blind reader and a printed sheet both lose the colour.
4. Contrast meets level AA. Body text sits at 4.5 to 1 or better.
5. Every control that a finger touches is at least 44 pixels tall.
6. The print sheet is a first class screen, not an afterthought. The group runs on
   paper today and will keep a printed copy on the wall during the change over.

## Tokens

Defined once in `src/index.css` under `@theme`, and used through Tailwind classes.

Colour, light theme:

- `canvas` #f8fafc, the page behind everything
- `surface` #ffffff, cards and rows
- `line` #e2e8f0, hairline borders
- `ink` #0f172a, body text
- `muted` #64748b, secondary text
- `accent` #4f46e5, the one bright colour
- `accent-soft` #eef2ff, the accent as a background
- `positive` #047857, hours in credit and a worked shift
- `warning` #b45309, an excused absence
- `danger` #b91c1c, minus hours and an unexcused absence

The dark theme swaps canvas, surface, line, ink and muted, and keeps the accent.

Type: system stack. 12, 14, 16, 20, 24, 32. Weights 400, 500 and 600 only.

Space: multiples of 4, and layout gaps on multiples of 8.

Radius: 8 for controls, 12 for cards, 999 for pills.

## What this is not

No animation beyond a 150 millisecond colour change. No shadows deeper than one
step. No icon without a text label next to it.
