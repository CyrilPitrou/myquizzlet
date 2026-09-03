import { el, clear, swipeable } from '../ui.js';
import { buildQueue, newItem, nextItem, parseKey } from '../srs.js';
import { grade } from '../grade.js';
import { store, go, todayStr, screen, ctx } from '../app.js';
import { t } from '../i18n.js';

const setup = { mode: 'write', directions: ['f2b', 'b2f'], limit: 20, includeNew: true, free: false };

export function showTestSetup(listId) {
  const list = store.getList(listId);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: t('common.back.lists') }));
  view.append(el('h2', { text: t('test.title', { name: list.name }) }));

  const front = list.frontLabel || t('side.front');
  const back = list.backLabel || t('side.back');
  const radio = (name, value, label, checked) => el('label', { class: 'opt' }, [
    el('input', { type: 'radio', name, value, ...(checked ? { checked: 'checked' } : {}) }),
    label,
  ]);

  const modes = el('div', { class: 'opts' }, [
    radio('mode', 'write', t('test.mode.write'), setup.mode === 'write'),
    radio('mode', 'cards', t('test.mode.cards'), setup.mode === 'cards'),
  ]);
  const dirs = el('div', { class: 'opts' }, [
    radio('dir', 'both', t('train.dir.both'), setup.directions.length === 2),
    radio('dir', 'f2b', t('train.dir.f2b', { front, back }), setup.directions.join() === 'f2b'),
    radio('dir', 'b2f', t('train.dir.f2b', { front: back, back: front }), setup.directions.join() === 'b2f'),
  ]);
  const limit = el('input', { type: 'number', min: '5', max: '100', step: '5', value: String(setup.limit) });

  view.append(el('h3', { text: t('test.mode') }), modes, el('h3', { text: t('test.direction') }), dirs,
    el('h3', { text: t('test.count') }), limit);

  const free = el('input', { type: 'checkbox', ...(setup.free ? { checked: 'checked' } : {}) });
  view.append(el('label', { class: 'opt' }, [free, t('test.free')]));

  view.append(el('button', {
    class: 'primary', text: t('test.start'),
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
    if (free) return alert(t('test.empty'));
    const ok = confirm(t('test.nothingDue'));
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
    view.append(el('h2', { text: t('session.done') }));
    view.append(el('p', { text: t('test.done.count', { right: session.right, wrong: session.wrong }) }));
    view.append(el('a', { class: 'btn', href: `#/test/${listId}`, text: t('test.studyMore') }));
    view.append(el('a', { class: 'btn', href: '#/', text: t('test.backToLists') }));
    session = null;
    return;
  }

  view.append(el('div', { class: 'sessionbar' }, [
    el('a', { class: 'back', href: `#/list/${listId}`, text: t('session.quit') }),
    el('span', { class: 'muted', text: t('test.progress', { at: session.at + 1, total: session.queue.length }) }),
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
      el('p', { class: 'muted', text: t('test.tapToReveal') }),
    ]);
    const reveal = () => {
      clear(face);
      face.append(el('p', { class: 'prompt', text: expected }));
      face.append(el('p', { class: 'muted', text: t('test.swipeIfKnown') }));
    };
    face.addEventListener('click', reveal);
    swipeable(face, { onLeft: () => answer(false), onRight: () => answer(true) });
    view.append(face);
    view.append(el('div', { class: 'actions' }, [
      el('button', { text: t('test.didntKnow'), onclick: () => answer(false) }),
      el('button', { class: 'primary', text: t('test.knewIt'), onclick: () => answer(true) }),
    ]));
    return;
  }

  view.append(el('p', { class: 'prompt', text: prompt }));

  const input = el('input', { class: 'answer-input', autocapitalize: 'none',
    autocorrect: 'off', spellcheck: 'false', placeholder: t('session.answerPlaceholder') });
  const form = el('form', {
    onsubmit: (e) => {
      e.preventDefault();
      const verdict = grade(expected, input.value);
      if (verdict === 'correct') return answer(true);
      showVerdict(form, verdict, expected, input.value);
    },
  }, [input, el('button', { class: 'primary', type: 'submit', text: t('session.check') })]);
  view.append(form);
  input.focus();
}

function showVerdict(anchor, verdict, expected, typed) {
  const panel = el('div', { class: `verdict ${verdict}` }, [
    el('p', { text: verdict === 'typo' ? t('session.typo', { expected })
                                       : t('session.answerWas', { expected }) }),
    el('p', { class: 'muted', text: t('session.youWrote', { typed }) }),
    el('div', { class: 'row' }, [
      el('button', { text: t('session.iWasRight'), onclick: () => answer(true) }),
      el('button', { class: 'primary',
        text: verdict === 'typo' ? t('session.gotIt') : t('session.continue'),
        onclick: () => answer(verdict === 'typo') }),
    ]),
  ]);
  anchor.replaceWith(panel);
}
