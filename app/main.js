import { el, clear, $ } from './ui.js';

function render() {
  const screen = $('#screen');
  clear(screen);
  screen.append(el('p', { text: 'MyQuizzlet is alive.' }));
}

render();
