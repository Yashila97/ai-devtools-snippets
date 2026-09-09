# How I prompt for these

The snippets in this repository were written with AI assistance and then tested,
corrected and hardened by hand. This file is the part that is actually transferable —
the code is the output, the prompting is the method.

---

## The pattern that works

A bad prompt: *"write me a script to fill a form"*. You get something that sets
`element.value` and does not work on any modern site.

A prompt that works has four parts. Context, constraint, failure mode, output format.

> I'm a manual QA engineer testing a registration form. I want a snippet I can paste
> into the Chrome DevTools Console to fill every field with valid data so I don't
> retype it for the twentieth time today.
>
> Constraints: no libraries, no build step, must run from a paste into the Console. The
> page might be React, so setting `.value` directly won't update the component state.
> The form fields are namespaced like `customer.firstName`.
>
> It must tell me what it filled and what it couldn't find, rather than failing
> silently — if the form has changed I need to know which selector broke.
>
> Give me one self-contained IIFE that exposes a single global function.

**The third paragraph is the one that changes the output most.** "Tell me what it
couldn't find" is what turns a script into a tool. Without it you get code that silently
does nothing when a selector breaks, which on a shared demo site is a weekly occurrence.

## What I always specify

| Constraint | Why |
|---|---|
| "No libraries, no build, paste into Console" | Otherwise you get npm instructions |
| "The page might be React" | Produces the native-setter approach instead of `.value =`, which is the single most common reason a fill snippet appears to work and doesn't |
| "Report what it filled and what it missed" | Turns a script into a tool |
| "One IIFE exposing one global" | Keeps the Console clean and re-pasteable |
| "Don't randomise the test data" | A repeatable fill matters more than variety when comparing two runs |
| "Log the generated username" | Otherwise you cannot re-check a result an hour later |

## What I always check before trusting it

This is the part that matters, and the part I would want to be asked about in an
interview.

1. **Does it actually update the framework's state?** Fill the form, then submit. If
   validation complains that a filled field is empty, the value was set on the DOM node
   but the framework never saw it. Every model gets this wrong unless told.
2. **Does it lie when it fails?** Rename a field id in dev tools and re-run. It must
   report the field as missing, not report success.
3. **Does it touch anything it shouldn't?** Read the code before pasting it into a page
   with a session. I have had a generated snippet offer to iterate every form on the
   page and submit each one.
4. **Is the selector assumption stated?** Snippet 03 hard-codes ParaBank's field ids.
   That is fine, but the file has to say so and say when they were last verified,
   otherwise it becomes a silent trap for whoever uses it next.
5. **Does it hide a real defect?** Snippet 05 forcibly re-enables a disabled button. If
   I let the snippet quietly work around client-side protection without logging that it
   did, I would never notice the protection was client-side only — which is itself the
   finding.

## Where AI genuinely saves me time

- Boilerplate I know how to write but do not want to type: DOM traversal, `console.table`
  formatting, colour parsing for contrast maths.
- Things I know exist but not by name — I described "the number you compare against 4.5
  for contrast" and got relative luminance and the WCAG formula.
- Turning something that works once into something reusable. Snippet 01 started as a
  ParaBank-specific fill and became generic because I asked what it would take.

## Where it does not

- **Deciding what to test.** Every snippet here exists because I already knew which
  check was worth automating. Asked what to test on a payment form, a model gives you a
  generic list. The double-submit test in snippet 05 exists because I have watched a
  duplicate debit happen; nothing generated that idea for me.
- **Domain rules.** No prompt produces "check that a denied loan didn't debit the down
  payment". That comes from having seen money taken with nothing given.
- **Knowing when the output is subtly wrong.** The first version of the contrast check
  in snippet 02 read `background-color` off the element itself, so any text on a
  transparent element was compared against transparent and reported as passing. It looked
  completely correct. Catching that needed someone who knew what the answer should be.

That last point is the honest summary: AI made me faster at building tools. It did not
make me a better tester. The judgement about what to build and whether the output is
right is the part that took six years and it is still the part doing the work.
