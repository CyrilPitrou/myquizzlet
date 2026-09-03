import { el, swipeable } from '../ui.js';
import { store, screen, go, settings, saveSettings, ctx } from '../app.js';
import { shuffle } from '../srs.js';
import { t } from '../i18n.js';
import { flip, flyOut, slideIn, lift } from '../fx.js';

// Kept across renders so paging does not lose your place. Reset whenever the
// list changes (tracked via its updatedAt stamp) or the shuffle preference changes.
let browse = null;

function order(list) {
  const ids = list.cards.map((card) => card.id);
  return settings().browseShuffle ? shuffle(ids) : ids;
}

function ensure(list) {
  const wanted = Boolean(settings().browseShuffle);
  if (!browse || browse.listId !== list.id
      || browse.updatedAt !== list.updatedAt || browse.shuffled !== wanted) {
    browse = { listId: list.id, order: order(list), at: 0, flipped: false,
               shuffled: wanted, updatedAt: list.updatedAt };
  }
  browse.at = Math.min(browse.at, Math.max(list.cards.length - 1, 0));
}

// Which way the previous card left, so the next one arrives from that side.
let arriving = null;

async function step(delta, count, node) {
  const dir = delta > 0 ? 'left' : 'right';   // Next sends the card off to the left
  if (node) await flyOut(node, dir);
  // Content moved left, so the next card comes in from the right, and back.
  arriving = dir === 'left' ? 'right' : 'left';
  browse.at = (browse.at + delta + count) % count;
  browse.flipped = false;
  ctx.render();
}

export function showView(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: `#/list/${id}`, class: 'back', text: `← ${list.name}` }));

  if (list.cards.length === 0) {
    view.append(el('p', { class: 'empty', text: t('view.empty') }));
    return;
  }

  ensure(list);
  const card = list.cards.find((c) => c.id === browse.order[browse.at]);
  const frontLabel = list.frontLabel || t('side.front');
  const backLabel = list.backLabel || t('side.back');

  view.append(el('p', { class: 'muted', text: t('view.position', { at: browse.at + 1, total: list.cards.length }) }));
  const faceNode = (labelText, valueText, side) => el('div', { class: `face ${side}` }, [
    el('p', { class: 'muted', text: labelText }),
    el('p', { class: 'prompt', text: valueText }),
  ]);

  // Both faces live in the DOM at once; flipping toggles a class on a node
  // that stays put, so there is an old state to animate from.
  const face = el('div', { class: `card deck${browse.flipped ? ' flipped' : ''}` }, [
    el('div', { class: 'faces' }, [
      faceNode(frontLabel, card.front, 'front'),
      faceNode(backLabel, card.back, 'back'),
    ]),
  ]);
  face.addEventListener('click', () => {
    browse.flipped = !browse.flipped;   // kept in step for the next real render
    flip(face);
  });
  if (arriving) { slideIn(face, arriving); arriving = null; }

  swipeable(face, {
    onDrag: (dx) => lift(face, Math.abs(dx) > 8),
    onLeft: () => step(1, list.cards.length, face),
    onRight: () => step(-1, list.cards.length, face),
  });
  view.append(face);

  view.append(el('div', { class: 'actions pager' }, [
    el('button', { text: t('view.prev'), onclick: () => step(-1, list.cards.length, face) }),
    el('button', { text: t('view.next'), onclick: () => step(1, list.cards.length, face) }),
  ]));

  const shuffled = el('input', { type: 'checkbox',
    ...(settings().browseShuffle ? { checked: 'checked' } : {}),
    onchange: (event) => {
      saveSettings({ ...settings(), browseShuffle: event.target.checked });
      browse = null;
      ctx.render();
    } });
  view.append(el('label', { class: 'opt' }, [shuffled, t('view.randomOrder')]));
}

// One listener for the life of the page; it only acts on the browser screen.
document.addEventListener('keydown', (event) => {
  if (!location.hash.startsWith('#/view/') || !browse) return;
  const list = store.getList(browse.listId);
  if (!list || list.cards.length === 0) return;
  const card = () => document.querySelector('#screen .card');
  if (event.key === 'ArrowLeft') step(-1, list.cards.length, card());
  else if (event.key === 'ArrowRight') step(1, list.cards.length, card());
  else if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === ' ') {
    event.preventDefault();
    const node = document.querySelector('#screen .card');
    if (!node) return;
    browse.flipped = !browse.flipped;
    flip(node);
  }
});
