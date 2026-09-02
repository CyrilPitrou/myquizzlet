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

## Training

Training (`app/train.js`) is a separate mode from a review session, with its
own state and its own queue — it never touches `due` on its own.

A batch holds 8 direction-items, picked by `pickBatch`: never-seen items
first, then ascending `box`, then descending `lapses`. Due dates play no part;
training pulls in whatever is shakiest regardless of when it is next due, and
will not drain a review backlog.

Each item in the batch also has a rung, 0 or 1, held in `level` (see
`data-model.md`). Rung 0 asks the item as pick-from-four; rung 1 asks it
typed. A right answer at rung 0 promotes the item to rung 1 and sends it to
the back of the queue; a right answer at rung 1 graduates it out of the batch;
a wrong answer at either rung drops it to rung 0 and to the back of the queue.
When the batch empties, it is refilled silently from the same rule.

**Only a typed answer touches the Leitner boxes.** Recognising a word among
four options is not recalling it, so a rung-0 answer moves `level` and nothing
else — `box` and `due` are untouched. Credit follows how the question was
actually *presented*, not the rung it started at: `choices()` returns `null`
when a list has fewer than two other cards with distinct text on that side, in
which case even a rung-0 item is asked by typing, and that answer is a real
recall attempt — it is scheduled through `nextItem` like any other typed
answer.

A wrong answer, from training or from a test, resets `level` to `0`: a word
you just got wrong is re-introduced with multiple choice next time, whichever
mode asks for it.

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
