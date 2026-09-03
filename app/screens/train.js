import { el } from '../ui.js';
import { store, screen, go, todayStr, ctx } from '../app.js';
import { pickBatch, choices, startBatch, currentKey, currentLevel, advance } from '../train.js';
import { newItem, nextItem, parseKey } from '../srs.js';
import { grade } from '../grade.js';
import { t, lang } from '../i18n.js';
import { bucketFor, pick } from '../messages.js';
import { flashWrong, ring, confetti } from '../fx.js';
import { play } from '../audio.js';

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
  view.append(el('h2', { text: t('train.title') }));
  view.append(el('p', { class: 'muted', text: t('train.blurb') }));

  const front = list.frontLabel || t('side.front');
  const back = list.backLabel || t('side.back');
  const radio = (value, label, checked) => el('label', { class: 'opt' }, [
    el('input', { type: 'radio', name: 'dir', value, ...(checked ? { checked: 'checked' } : {}) }),
    label,
  ]);
  const dirs = el('div', { class: 'opts' }, [
    radio('both', t('train.dir.both'), setup.directions.length === 2),
    radio('f2b', t('train.dir.f2b', { front, back }), setup.directions.join() === 'f2b'),
    radio('b2f', t('train.dir.f2b', { front: back, back: front }), setup.directions.join() === 'b2f'),
  ]);
  view.append(dirs);

  view.append(el('button', {
    class: 'primary', text: t('train.start'),
    onclick: () => {
      const dir = dirs.querySelector('input:checked').value;
      setup.directions = dir === 'both' ? ['f2b', 'b2f'] : [dir];
      session = { listId: id, directions: setup.directions, done: [], batch: null,
                  right: 0, wrong: 0, justRefilled: false };
      refill();
      if (!session.batch) { alert(t('train.nothingLeft')); return; }
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
// `silent` is for a caller that has already given the verdict — the typo panel
// shows and sounds it itself, and must not have a second one laid over the top.
function answered(correct, wasMultipleChoice, silent = false) {
  if (!silent && !correct) flashWrong(document.querySelector('#screen'));
  const key = currentKey(session.batch);
  if (wasMultipleChoice) saveLevel(session.listId, key, correct ? 1 : 0);
  else saveAnswer(session.listId, key, correct);
  session[correct ? 'right' : 'wrong'] += 1;
  const banked = session.batch.graduated.length;
  session.batch = advance(session.batch, correct);
  // A word that has just left the batch climbed its last rung: it gets the
  // arpeggio instead of the plain blip, so one answer is still one sound.
  const climbed = session.batch.graduated.length > banked;
  settleBatch();
  if (climbed) play('graduate');
  else if (!silent) play(correct ? 'right' : 'wrong');
  ctx.render();
}

// Marks the picked and correct buttons with an icon + color (never color
// alone, so the result reads without relying on any visual-effects setting).
// A correct pick auto-advances; a wrong one waits for Continue, same as the
// typed-answer path pauses on a mistake.
function pickChoice(container, buttons, options, option, expected) {
  buttons.forEach((btn) => { btn.disabled = true; });
  const rightIdx = options.indexOf(expected);
  buttons[rightIdx].classList.add('correct');
  buttons[rightIdx].textContent = `✓ ${options[rightIdx]}`;
  if (option === expected) {
    setTimeout(() => answered(true, true), 550);
    return;
  }
  const pickedIdx = options.indexOf(option);
  buttons[pickedIdx].classList.add('wrong');
  buttons[pickedIdx].textContent = `✗ ${options[pickedIdx]}`;
  container.append(el('button', {
    class: 'primary', text: t('session.continue'),
    onclick: () => answered(false, true),
  }));
}

export function showTrainSession(id) {
  if (!session || session.listId !== id) return go(`#/train/${id}`);
  const list = store.getList(id);
  const view = screen();
  view.append(el('div', { class: 'sessionbar' }, [
    el('a', { class: 'back', href: `#/list/${id}`, text: t('session.quit') }),
    el('span', { class: 'muted', text: t('session.tally',
      { done: session.done.length, right: session.right, wrong: session.wrong }) }),
  ]));

  if (!session.batch) {
    const { right, wrong } = session;
    const total = right + wrong;
    const bucket = bucketFor(right, total);
    const pct = total ? Math.round((right / total) * 100) : 0;

    view.append(el('h2', { text: t('session.done') }));
    view.append(ring(pct));
    view.append(el('p', { class: 'result-msg', text: pick(bucket, lang()) }));
    view.append(el('p', { text: t('train.done.count',
      { n: session.done.length, right, wrong }) }));
    view.append(el('a', { class: 'btn', href: `#/list/${id}`, text: t('session.backToList') }));

    play(bucket);
    if (bucket === 'perfect' || bucket === 'great') confetti(document.body);
    session = null;
    return;
  }

  if (session.justRefilled) {
    view.append(el('p', { class: 'muted', text: t('train.carryOn', { n: session.done.length }) }));
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
    const container = el('div', { class: 'opts choices' });
    const buttons = options.map((option) => el('button', {
      class: 'choice', text: option,
      onclick: () => pickChoice(container, buttons, options, option, expected),
    }));
    container.append(...buttons);
    view.append(container);
    return;
  }

  const input = el('input', { class: 'answer-input', autocapitalize: 'none',
    autocorrect: 'off', spellcheck: 'false', placeholder: t('session.answerPlaceholder') });
  const form = el('form', {
    onsubmit: (event) => {
      event.preventDefault();
      const verdict = grade(expected, input.value);
      if (verdict === 'correct') return answered(true, false);
      flashWrong(document.querySelector('#screen'));
      play(verdict === 'typo' ? 'typo' : 'wrong');
      form.replaceWith(el('div', { class: `verdict ${verdict}` }, [
        el('p', { text: verdict === 'typo' ? t('session.typo', { expected })
                                           : t('session.answerWas', { expected }) }),
        el('p', { class: 'muted', text: t('session.youWrote', { typed: input.value }) }),
        el('div', { class: 'row' }, [
          el('button', { text: t('session.iWasRight'), onclick: () => answered(true, false, true) }),
          el('button', { class: 'primary',
            text: verdict === 'typo' ? t('session.gotIt') : t('session.continue'),
            onclick: () => answered(verdict === 'typo', false, true) }),
        ]),
      ]));
    },
  }, [input, el('button', { class: 'primary', type: 'submit', text: t('session.check') })]);
  view.append(form);
  input.focus();
}
