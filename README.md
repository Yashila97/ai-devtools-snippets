# AI-assisted DevTools snippets for manual testers

Five browser Console snippets I use for exploratory and manual testing, written with AI
assistance and then hardened by hand. No installation, no build step, no framework —
paste into DevTools and go.

Targets are public demo applications:
[ParaBank](https://parabank.parasoft.com/parabank/index.htm) for the site-specific ones,
anything for the generic ones. No employer systems or data appear anywhere in this
repository.

## The snippets

| File | What it does | Works on |
|---|---|---|
| [`01-generic-form-autofill.js`](snippets/01-generic-form-autofill.js) | Fills any form by introspecting each field — type, name, id, label, placeholder. Valid or maximum-length values | Any page |
| [`02-accessibility-quick-checks.js`](snippets/02-accessibility-quick-checks.js) | Unlabelled controls, missing alt text, heading structure, AA contrast, 24px targets (WCAG 2.2), suppressed focus indicators, tab order, live regions | Any page |
| [`03-parabank-register.js`](snippets/03-parabank-register.js) | Fills ParaBank registration. Presets: valid, UK formats, maximum-length, XSS payloads, password mismatch | ParaBank |
| [`04-parabank-transfer-check.js`](snippets/04-parabank-transfer-check.js) | Snapshots every account balance before and after a transfer, then checks both sides moved by the same amount and the total is unchanged | ParaBank |
| [`05-double-submit-test.js`](snippets/05-double-submit-test.js) | Clicks submit twice deterministically and logs every non-GET request, to test for duplicate transactions | Any page |

Each file is a self-contained IIFE exposing one global function, with usage printed to
the Console when you paste it.

## The two worth looking at

**`02-accessibility-quick-checks.js`** is the one I reach for most. Eight checks in the
first thirty seconds on a page I have never seen, including three that scanners are bad
at: 24×24 target size from WCAG 2.2, whether focus indicators have been suppressed with
`outline:none`, and whether any live region exists at all. That last one is the check
behind the most serious accessibility defect I have found — a form that shows a
validation error a sighted user sees instantly and a screen-reader user is never told
about.

It also says plainly what it cannot do. It finds a missing `alt`; it cannot tell you
whether existing alt text is *meaningful*. It resolves contrast by walking up the DOM,
so text over an image or a gradient will be wrong. Those caveats are printed in the
Console output, because a tool that overstates its coverage is worse than no tool.

**`04-parabank-transfer-check.js`** is the one that reflects the domain. The check that
matters on a money-movement journey is not that a confirmation page appeared — it is
that one account was debited, one was credited, both by the same amount, and the sum
across all accounts is unchanged. Done by hand that means writing four numbers down and
doing arithmetic, which is the step people skip at 4pm. This makes it three commands and
prints a pass or fail per check.

## How these were built

[`prompts/how-i-prompt-for-snippets.md`](prompts/how-i-prompt-for-snippets.md) is the
transferable part — the prompt pattern, the constraints I always specify, and the five
things I check before trusting generated code.

The short version of what matters:

**The constraint that changes the output most** is telling the model the page might be
React. A snippet that sets `element.value` directly appears to work and does nothing,
because React tracks its own state — you need the native property-descriptor setter plus
dispatched `input` and `change` events. Every snippet here does that.

**The instruction that turns a script into a tool** is "report what you filled and what
you couldn't find". Silent failure on a demo site whose markup changes is worse than no
snippet.

**The bug that proves the point:** the first version of the contrast check read
`background-color` off the element itself, so any text on a transparent element was
compared against transparent and reported as passing. It looked entirely correct. Finding
that needed someone who already knew what the answer should be — which is the honest
summary of what AI does and does not do for me. It made me faster at building tools. The
judgement about what to build, and whether the output is actually right, is still the
work.

## Safety notes

- Read any Console snippet before pasting it into a page where you have a session. That
  includes these. `05` deliberately re-enables disabled buttons and monkey-patches
  `fetch`, which you should know before running it.
- `03` uses XSS and SQL-shaped payloads. Only on applications you are authorised to test.
  ParaBank is a public demo built for this; your employer's staging environment probably
  needs a conversation first.
- Selectors in `03` and `04` were verified against the live ParaBank on the date in the
  file header. It is a live demo and it changes — the snippets report which selector is
  missing rather than failing quietly.

## Author

Naga Yashila Araveti — QA Engineer.
[LinkedIn](https://www.linkedin.com/in/naga-araveti)
