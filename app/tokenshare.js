// app/tokenshare.js
//
// The one place this app ever puts a secret on screen, so it is one piece of
// code rather than two: the Token page offers it, and so does Help, where the
// instructions for adding a device are — and being told about a button three
// screens away is not being offered it.
import { el, clear } from './ui.js';
import { qrCard } from './qrcard.js';
import { setupLink } from './setup.js';
import { t } from './i18n.js';

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
    const card = qrCard(link, t('tokenshare.qr.caption'), t('tokenshare.qr.label'));
    const timer = setTimeout(() => { if (box.isConnected) show(); }, SHOW_FOR);

    clear(box);
    box.append(el('h4', { text: t('tokenshare.reveal.heading') }));
    box.append(card);
    box.append(el('p', { class: 'muted', text: t('tokenshare.reveal.hint') }));
    box.append(el('button', { text: t('tokenshare.reveal.hideButton'),
      onclick: () => { clearTimeout(timer); show(); } }));
  };

  const show = () => {
    clear(box);
    box.append(el('h4', { text: t('tokenshare.setup.heading') }));
    box.append(el('p', { class: 'muted', text: t('tokenshare.setup.hint') }));
    box.append(el('button', { text: t('tokenshare.setup.button'), onclick: reveal }));
  };

  show();
  return box;
}
