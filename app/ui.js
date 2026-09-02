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
// which is the whole of its dismissal logic.
export function menu(items) {
  const close = () => { pop.hidden = true; };
  const pop = el('div', { class: 'menu-pop', hidden: 'hidden' }, items.map((item) =>
    el('button', {
      class: 'menu-item', text: item.label,
      onclick: () => { close(); item.onclick(); },
    })));
  const button = el('button', {
    class: 'menu-button', text: '⋮', title: 'Actions', 'aria-label': 'Actions',
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
