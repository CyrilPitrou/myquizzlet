import { el, swipeable } from '../ui.js';
import { store, screen, go, settings, saveSettings, ctx } from '../app.js';
import { shuffle } from '../srs.js';

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

function step(delta, count) {
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
    view.append(el('p', { class: 'empty', text: 'This list has no cards yet.' }));
    return;
  }

  ensure(list);
  const card = list.cards.find((c) => c.id === browse.order[browse.at]);
  const frontLabel = list.frontLabel || 'Front';
  const backLabel = list.backLabel || 'Back';

  view.append(el('p', { class: 'muted', text: `${browse.at + 1} / ${list.cards.length}` }));
  const face = el('div', {
    class: `card${browse.flipped ? ' flipped' : ''}`,
    onclick: () => { browse.flipped = !browse.flipped; ctx.render(); },
  }, [
    el('p', { class: 'muted', text: browse.flipped ? backLabel : frontLabel }),
    el('p', { class: 'prompt', text: browse.flipped ? card.back : card.front }),
  ]);
  swipeable(face, {
    onLeft: () => step(1, list.cards.length),
    onRight: () => step(-1, list.cards.length),
  });
  view.append(face);

  view.append(el('div', { class: 'actions pager' }, [
    el('button', { text: '‹ Prev', onclick: () => step(-1, list.cards.length) }),
    el('button', { text: 'Next ›', onclick: () => step(1, list.cards.length) }),
  ]));

  const shuffled = el('input', { type: 'checkbox',
    ...(settings().browseShuffle ? { checked: 'checked' } : {}),
    onchange: (event) => {
      saveSettings({ ...settings(), browseShuffle: event.target.checked });
      browse = null;
      ctx.render();
    } });
  view.append(el('label', { class: 'opt' }, [shuffled, 'Random order']));
}

// One listener for the life of the page; it only acts on the browser screen.
document.addEventListener('keydown', (event) => {
  if (!location.hash.startsWith('#/view/') || !browse) return;
  const list = store.getList(browse.listId);
  if (!list || list.cards.length === 0) return;
  if (event.key === 'ArrowLeft') step(-1, list.cards.length);
  else if (event.key === 'ArrowRight') step(1, list.cards.length);
  else if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === ' ') {
    event.preventDefault();
    browse.flipped = !browse.flipped;
    ctx.render();
  }
});
