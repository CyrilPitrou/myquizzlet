// app/qrcard.js
//
// A QR code as DOM. The encoder lives in qr.js and knows nothing of the page;
// this is the other half — the <svg> and its caption — shared by the Token
// screen and Help, which both hand a camera something to point at.
import { el } from './ui.js';
import { encode } from './qr.js';

// One <rect> per dark module inside a viewBox of modules, so the browser
// scales it and nothing has to know about pixels. Deliberately black on white
// in every theme, with the four-module quiet zone the standard asks for: this
// is an image meant for a camera, not a piece of the interface, and a scanner
// pointed at a dark theme is a scanner that fails. Those two colours are set
// here rather than in the stylesheet for exactly that reason.
export function qrNode(text, label) {
  const matrix = encode(text);
  const size = matrix.length;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size + 8} ${size + 8}`);
  svg.setAttribute('class', 'qr');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);

  const ground = document.createElementNS(ns, 'rect');
  ground.setAttribute('width', String(size + 8));
  ground.setAttribute('height', String(size + 8));
  ground.setAttribute('fill', '#ffffff');
  svg.append(ground);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!matrix[row][col]) continue;
      const cell = document.createElementNS(ns, 'rect');
      cell.setAttribute('x', String(col + 4));
      cell.setAttribute('y', String(row + 4));
      cell.setAttribute('width', '1');
      cell.setAttribute('height', '1');
      cell.setAttribute('fill', '#000000');
      svg.append(cell);
    }
  }
  return svg;
}

export function qrCard(text, caption, label) {
  return el('figure', { class: 'qr-card' }, [qrNode(text, label),
    el('figcaption', { class: 'muted', text: caption })]);
}

