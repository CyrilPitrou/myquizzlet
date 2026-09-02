import { el, clear, swipeable } from '../ui.js';
import { buildQueue, newItem, nextItem, parseKey } from '../srs.js';
import { grade } from '../grade.js';
import { store, go, todayStr, screen, ctx } from '../app.js';

const setup = { mode: 'write', directions: ['f2b', 'b2f'], limit: 20, includeNew: true, free: false };

export function showTestSetup(listId) {
  const list = store.getList(listId);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: `Test: ${list.name}` }));

  const front = list.frontLabel || 'Front';
  const back = list.backLabel || 'Back';
  const radio = (name, value, label, checked) => el('label', { class: 'opt' }, [
    el('input', { type: 'radio', name, value, ...(checked ? { checked: 'checked' } : {}) }),
    label,
  ]);

  const modes = el('div', { class: 'opts' }, [
    radio('mode', 'write', 'Write (type the answer)', setup.mode === 'write'),
    radio('mode', 'cards', 'Flashcards', setup.mode === 'cards'),
  ]);
  const dirs = el('div', { class: 'opts' }, [
    radio('dir', 'both', 'Both directions', setup.directions.length === 2),
    radio('dir', 'f2b', `${front} → ${back}`, setup.directions.join() === 'f2b'),
    radio('dir', 'b2f', `${back} → ${front}`, setup.directions.join() === 'b2f'),
  ]);
  const limit = el('input', { type: 'number', min: '5', max: '100', step: '5', value: String(setup.limit) });

  view.append(el('h3', { text: 'Mode' }), modes, el('h3', { text: 'Direction' }), dirs,
    el('h3', { text: 'Cards this session' }), limit);

  const free = el('input', { type: 'checkbox', ...(setup.free ? { checked: 'checked' } : {}) });
  view.append(el('label', { class: 'opt' }, [free,
    'Practise the whole list now — your schedule stays untouched']));

  view.append(el('button', {
    class: 'primary', text: 'Start',
    onclick: () => {
      setup.mode = modes.querySelector('input:checked').value;
      const dir = dirs.querySelector('input:checked').value;
      setup.directions = dir === 'both' ? ['f2b', 'b2f'] : [dir];
      setup.limit = Math.min(100, Math.max(5, Number(limit.value) || 20));
      setup.free = free.checked;
      startSession(listId);
    },
  }));
}

let session = null;

function queueFor(listId, free) {
  const list = store.getList(listId);
  const progress = store.getProgress(listId);
  return free
    ? buildQueue({ list, progress: { items: {} }, directions: setup.directions,
                   today: todayStr(), limit: setup.limit, includeNew: true })
    : buildQueue({ list, progress, directions: setup.directions,
                   today: todayStr(), limit: setup.limit, includeNew: setup.includeNew });
}

function startSession(listId, free = setup.free) {
  const queue = queueFor(listId, free);
  if (queue.length === 0) {
    if (free) return alert('This list has no cards yet.');
    const ok = confirm('Nothing is due in this list right now. Practise the whole list '
      + 'anyway? This will not affect your schedule.');
    if (!ok) return;
    return startSession(listId, true);
  }
  session = { listId, queue, at: 0, right: 0, wrong: 0, free };
  go(`#/test/${listId}/go`);
}

function answer(correct) {
  if (session.free) { session[correct ? 'right' : 'wrong'] += 1; session.at += 1; return ctx.render(); }
  const { listId, queue, at } = session;
  const key = queue[at];
  const progress = store.getProgress(listId);
  const previous = progress.items[key] || newItem(todayStr());
  progress.items[key] = nextItem(previous, correct, todayStr(), new Date().toISOString());
  store.saveProgress(progress);
  ctx.sync?.schedule();
  session[correct ? 'right' : 'wrong'] += 1;
  session.at += 1;
  ctx.render();
}

export function showTestSession(listId) {
  if (!session || session.listId !== listId) return go(`#/test/${listId}`);
  const list = store.getList(listId);
  const view = screen();

  if (session.at >= session.queue.length) {
    view.append(el('h2', { text: 'Done' }));
    view.append(el('p', { text: `${session.right} right, ${session.wrong} wrong.` }));
    view.append(el('a', { class: 'btn', href: `#/test/${listId}`, text: 'Study more' }));
    view.append(el('a', { class: 'btn', href: '#/', text: 'Back to lists' }));
    session = null;
    return;
  }

  view.append(el('div', { class: 'sessionbar' }, [
    el('a', { class: 'back', href: `#/list/${listId}`, text: '← Quit' }),
    el('span', { class: 'muted', text: `${session.at + 1} / ${session.queue.length}` }),
  ]));

  const key = session.queue[session.at];
  const { cardId, direction } = parseKey(key);
  const card = list.cards.find((c) => c.id === cardId);
  if (!card) { session.at += 1; return ctx.render(); }
  const prompt = direction === 'f2b' ? card.front : card.back;
  const expected = direction === 'f2b' ? card.back : card.front;

  if (setup.mode === 'cards') {
    const face = el('div', { class: 'card' }, [
      el('p', { class: 'prompt', text: prompt }),
      el('p', { class: 'muted', text: 'tap to reveal · swipe right if you knew it' }),
    ]);
    const reveal = () => {
      clear(face);
      face.append(el('p', { class: 'prompt', text: expected }));
      face.append(el('p', { class: 'muted', text: 'swipe right if you knew it' }));
    };
    face.addEventListener('click', reveal);
    swipeable(face, { onLeft: () => answer(false), onRight: () => answer(true) });
    view.append(face);
    view.append(el('div', { class: 'actions' }, [
      el('button', { text: 'Didn’t know', onclick: () => answer(false) }),
      el('button', { class: 'primary', text: 'Knew it', onclick: () => answer(true) }),
    ]));
    return;
  }

  view.append(el('p', { class: 'prompt', text: prompt }));

  const input = el('input', { class: 'answer-input', autocapitalize: 'none',
    autocorrect: 'off', spellcheck: 'false', placeholder: 'your answer' });
  const form = el('form', {
    onsubmit: (e) => {
      e.preventDefault();
      const verdict = grade(expected, input.value);
      if (verdict === 'correct') return answer(true);
      showVerdict(form, verdict, expected, input.value);
    },
  }, [input, el('button', { class: 'primary', type: 'submit', text: 'Check' })]);
  view.append(form);
  input.focus();
}

function showVerdict(anchor, verdict, expected, typed) {
  const panel = el('div', { class: `verdict ${verdict}` }, [
    el('p', { text: verdict === 'typo' ? `Almost — it is “${expected}”` : `Answer: ${expected}` }),
    el('p', { class: 'muted', text: `you wrote: ${typed}` }),
    el('div', { class: 'row' }, [
      el('button', { text: 'I was right', onclick: () => answer(true) }),
      el('button', { class: 'primary', text: verdict === 'typo' ? 'Got it' : 'Continue',
        onclick: () => answer(verdict === 'typo') }),
    ]),
  ]);
  anchor.replaceWith(panel);
}
