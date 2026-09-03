// app/tokenshare.js
//
// The one place this app ever puts a secret on screen, so it is one piece of
// code rather than two: the Token page offers it, and so does Help, where the
// instructions for adding a device are — and being told about a button three
// screens away is not being offered it.
import { el, clear } from './ui.js';
import { qrCard } from './qrcard.js';
import { setupLink } from './setup.js';

const SHOW_FOR = 60_000;

// The token itself, on screen, as a link the other phone's camera can open.
// Boxed off and behind a button because it is the only secret this app ever
// displays, and hidden again on a timer so it does not sit there forgotten.
export function tokenQr(current) {
  const box = el('div', { class: 'optin' });

  const reveal = () => {
    const link = setupLink({ token: current.token, expiry: current.tokenExpiry || null });
    // Built before clear(box): encode() can throw on an oversized payload,
    // and if it does the box must be left with its "Show token QR" button
    // still standing, not a bare heading with no way back.
    const card = qrCard(link, 'Opens the app and asks before saving',
      'A QR code carrying this device’s token');
    const timer = setTimeout(() => { if (box.isConnected) show(); }, SHOW_FOR);

    clear(box);
    box.append(el('h4', { text: 'Scan this on the other device' }));
    box.append(card);
    box.append(el('p', { class: 'muted', text: 'The other device will ask you to confirm '
      + 'before it saves anything. This code hides itself again in a minute.' }));
    box.append(el('button', { text: 'Hide it now',
      onclick: () => { clearTimeout(timer); show(); } }));
  };

  const show = () => {
    clear(box);
    box.append(el('h4', { text: 'Copy this token to another device' }));
    box.append(el('p', { class: 'muted', text: 'Faster than making a second token, and the '
      + 'honest price: both devices then share one, so revoking it cuts off both. The token '
      + 'is briefly on screen, so do this where nobody is watching.' }));
    box.append(el('button', { text: 'Show token QR', onclick: reveal }));
  };

  show();
  return box;
}

