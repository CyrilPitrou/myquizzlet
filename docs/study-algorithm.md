# Study algorithm

## Leitner boxes

Five boxes. An item's box determines when it comes back:

| Box | Next review |
|---|---|
| 1 | tomorrow |
| 2 | in 3 days |
| 3 | in 7 days |
| 4 | in 16 days |
| 5 | in 35 days |

A correct answer promotes one box (5 stays at 5). A wrong answer sends the item
straight to box 1 and increments `lapses`. `due` is recomputed from the new box.

Chosen over SM-2 because it is about a hundred lines, you can always see why a
word turned up, and for vocabulary the difference in outcome is small. If it ever
proves too coarse, `srs.js` is the only file that would change.

## The session queue

Everything due today, shuffled, capped at the session size you pick. If nothing
is due the app offers new cards, or a free review that leaves scheduling
untouched — reviewing should never be discouraged, but nor should it distort the
schedule.

Sessions are interruptible. Each answer updates the working copy immediately, so
closing the tab mid-session loses nothing.

## Two directions

Each card is two items: `f2b` (front shown, back expected) and `b2f`. They are
scheduled independently, because production is markedly harder than recognition
and merging them would hide that. Expect `b2f` to trail; that is the app being
accurate.

## Grading typed answers

`grade(expected, typed)` returns `correct`, `typo`, or `wrong`.

Ignored: case, accents, surrounding and repeated whitespace, terminal
punctuation, and a leading article (`le`, `la`, `el`, `the`, …). A single-
character difference — one edit away — counts as `typo`: accepted, but the
correct spelling is shown.

Anything else is `wrong`, and can be overridden with **I was right**, which counts
as correct. The override exists because a grader that argues with you about a
word you knew is the fastest way to stop using the app. Being slightly too
generous costs one extra review; being too strict costs the habit.

When a list declares languages, the expected side's language decides how accents
are folded.
