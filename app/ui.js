export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export const $ = (selector) => document.querySelector(selector);

// A ⋮ button with a popover of actions. Closes on the next click anywhere,
// which is the whole of its dismissal logic. `label` names the button for a
// screen reader and a tooltip; it comes from the caller rather than from a
// dictionary lookup in here, so this module never has to know about i18n.js.
export function menu(items, label) {
  const close = () => { pop.hidden = true; };
  const pop = el('div', { class: 'menu-pop', hidden: 'hidden' }, items.map((item) =>
    el('button', {
      class: 'menu-item', text: item.label,
      onclick: () => { close(); item.onclick(); },
    })));
  const button = el('button', {
    class: 'menu-button', text: '⋮', title: label, 'aria-label': label,
    onclick: (event) => {
      event.stopPropagation();
      if (pop.hidden) {
        pop.hidden = false;
        document.addEventListener('click', close, { once: true });
      } else close();
    },
  });
  return el('div', { class: 'menu' }, [button, pop]);
}

// A native <dialog>-backed modal. The caller supplies its full content,
// including whatever closes it (a button calling the returned node's
// .close()) — Escape and .close() both fire the dialog's own 'close' event,
// which is the only cleanup needed: no framework, no extra dismissal logic.
export function openDialog(children) {
  const node = el('dialog', { class: 'dialog' }, children);
  document.body.append(node);
  node.addEventListener('close', () => node.remove());
  node.showModal();
  return node;
}

// Claims the pointer only once horizontal movement clearly dominates, so a
// vertical drag still scrolls the page.
export function swipeable(node, { onLeft, onRight, threshold = 0.25 }) {
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let claimed = false;

  const move = (dx) => { node.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`; };
  const release = () => {
    node.style.transition = 'transform .18s ease-out';
    node.style.transform = '';
    setTimeout(() => { node.style.transition = ''; }, 200);
  };

  node.addEventListener('pointerdown', (event) => {
    dragging = true;
    claimed = false;
    startX = event.clientX;
    startY = event.clientY;
  });

  node.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!claimed) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy)) return;
      claimed = true;
      node.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    move(dx);
  });

  const end = (event) => {
    if (!dragging) return;
    dragging = false;
    if (!claimed) return;
    const dx = event.clientX - startX;
    const far = Math.abs(dx) > node.offsetWidth * threshold;
    release();
    if (!far) return;
    if (dx > 0) onRight(); else onLeft();
  };

  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', () => { dragging = false; release(); });
}
