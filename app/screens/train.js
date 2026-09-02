import { el } from '../ui.js';
import { store, screen, go, todayStr, ctx } from '../app.js';
import { pickBatch, choices, startBatch, currentKey, currentLevel, advance } from '../train.js';
import { newItem, nextItem, parseKey } from '../srs.js';
import { grade } from '../grade.js';

const BATCH = 8;

const setup = { directions: ['f2b', 'b2f'] };
let session = null;

// A multiple-choice answer moves the rung and nothing else: it must never
// stretch a review interval.
function saveLevel(listId, key, level) {
  const progress = store.getProgress(listId);
  const previous = progress.items[key] || newItem(todayStr());
  progress.items[key] = { ...previous, level };
  store.saveProgress(progress);
  ctx.sync?.schedule();
}

// A typed answer is a real recall attempt, and is scheduled like any other.
function saveAnswer(listId, key, correct) {
  const progress = store.getProgress(listId);
  const previous = progress.items[key] || newItem(todayStr());
  progress.items[key] = nextItem(previous, correct, todayStr(), new Date().toISOString());
  store.saveProgress(progress);
  ctx.sync?.schedule();
}

function refill() {
  const list = store.getList(session.listId);
  const keys = pickBatch({
    list, progress: store.getProgress(session.listId),
    directions: session.directions, size: BATCH, exclude: session.done,
  });
  if (keys.length === 0) { session.batch = null; return; }
  session.batch = startBatch(keys, store.getProgress(session.listId));
  session.justRefilled = session.done.length > 0;
}

export function showTrainSetup(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: `#/list/${id}`, class: 'back', text: `← ${list.name}` }));
  view.append(el('h2', { text: 'Train' }));
  view.append(el('p', { class: 'muted', text: 'Eight words at a time. Pick the answer from '
    + 'four until it sticks, then type it. New words first, then whatever is shakiest.' }));

  const front = list.frontLabel || 'Front';
  const back = list.backLabel || 'Back';
  const radio = (value, label, checked) => el('label', { class: 'opt' }, [
    el('input', { type: 'radio', name: 'dir', value, ...(checked ? { checked: 'checked' } : {}) }),
    label,
  ]);
  const dirs = el('div', { class: 'opts' }, [
    radio('both', 'Both directions', setup.directions.length === 2),
    radio('f2b', `${front} → ${back}`, setup.directions.join() === 'f2b'),
    radio('b2f', `${back} → ${front}`, setup.directions.join() === 'b2f'),
  ]);
  view.append(dirs);

  view.append(el('button', {
    class: 'primary', text: 'Start',
    onclick: () => {
      const dir = dirs.querySelector('input:checked').value;
      setup.directions = dir === 'both' ? ['f2b', 'b2f'] : [dir];
      session = { listId: id, directions: setup.directions, done: [], batch: null,
                  right: 0, wrong: 0, justRefilled: false };
      refill();
      if (!session.batch) { alert('Nothing left to train in this list.'); return; }
      go(`#/train/${id}/go`);
    },
  }));
}

// Whenever the batch's queue can end up empty — a normal advance, or a
// deleted card dropped from the queue below — settle it the same way: bank
// what graduated, then refill (which sets session.batch = null when there is
// nothing left to train, so the next render takes the Done branch).
function settleBatch() {
  if (currentKey(session.batch) !== null) return;
  session.done = session.done.concat(session.batch.graduated);
  refill();
}

// Credit follows how the question was presented, not the rung: choices()
// can return null even at rung 0 (too few distractor texts), and a question
// answered by typing is a real recall attempt regardless of which rung asked
// for it.
function answered(correct, wasMultipleChoice) {
  const key = currentKey(session.batch);
  if (wasMultipleChoice) saveLevel(session.listId, key, correct ? 1 : 0);
  else saveAnswer(session.listId, key, correct);
  session[correct ? 'right' : 'wrong'] += 1;
  session.batch = advance(session.batch, correct);
  settleBatch();
  ctx.render();
}

export function showTrainSession(id) {
  if (!session || session.listId !== id) return go(`#/train/${id}`);
  const list = store.getList(id);
  const view = screen();
  view.append(el('div', { class: 'sessionbar' }, [
    el('a', { class: 'back', href: `#/list/${id}`, text: '← Quit' }),
    el('span', { class: 'muted', text: `${session.done.length} learned · ${session.right} right · ${session.wrong} wrong` }),
  ]));

  if (!session.batch) {
    view.append(el('h2', { text: 'Done' }));
    view.append(el('p', { text: `${session.done.length} word(s) trained. `
      + `${session.right} right, ${session.wrong} wrong.` }));
    view.append(el('a', { class: 'btn', href: `#/list/${id}`, text: 'Back to the list' }));
    session = null;
    return;
  }

  if (session.justRefilled) {
    view.append(el('p', { class: 'muted', text: `${session.done.length} done — carrying on` }));
    session.justRefilled = false;
  }

  const key = currentKey(session.batch);
  const { cardId, direction } = parseKey(key);
  const card = list.cards.find((c) => c.id === cardId);
  if (!card) {   // the card was deleted mid-session: drop the key, do not promote it
    session.batch = { ...session.batch, queue: session.batch.queue.slice(1) };
    settleBatch();
    return ctx.render();
  }
  const prompt = direction === 'f2b' ? card.front : card.back;
  const expected = direction === 'f2b' ? card.back : card.front;

  view.append(el('p', { class: 'prompt', text: prompt }));

  const options = currentLevel(session.batch) === 0 ? choices({ list, key }) : null;
  if (options) {
    view.append(el('div', { class: 'opts choices' }, options.map((option) => el('button', {
      class: 'choice', text: option, onclick: () => answered(option === expected, true),
    }))));
    return;
  }

  const input = el('input', { class: 'answer-input', autocapitalize: 'none',
    autocorrect: 'off', spellcheck: 'false', placeholder: 'your answer' });
  const form = el('form', {
    onsubmit: (event) => {
      event.preventDefault();
      const verdict = grade(expected, input.value);
      if (verdict === 'correct') return answered(true, false);
      form.replaceWith(el('div', { class: `verdict ${verdict}` }, [
        el('p', { text: verdict === 'typo' ? `Almost — it is “${expected}”` : `Answer: ${expected}` }),
        el('p', { class: 'muted', text: `you wrote: ${input.value}` }),
        el('div', { class: 'row' }, [
          el('button', { text: 'I was right', onclick: () => answered(true, false) }),
          el('button', { class: 'primary', text: verdict === 'typo' ? 'Got it' : 'Continue',
            onclick: () => answered(verdict === 'typo', false) }),
        ]),
      ]));
    },
  }, [input, el('button', { class: 'primary', type: 'submit', text: 'Check' })]);
  view.append(form);
  input.focus();
}
