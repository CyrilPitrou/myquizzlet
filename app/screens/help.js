import { el } from '../ui.js';
import { screen, settings, saveSettings, ctx } from '../app.js';
import { qrCard } from '../qrcard.js';
import { APP_URL } from '../setup.js';
import { isInstalled, canInstall, promptInstall } from '../install.js';

function section(title, nodes) {
  return el('section', { class: 'sect' }, [el('h3', { text: title }), ...nodes]);
}

const p = (parts) => el('p', {}, parts);
const b = (text) => el('strong', { text });

// Hidden once the browser says so, once a home-screen launch says so, or
// once you have said so — the last because a Firefox shortcut says nothing.
function installSection() {
  if (isInstalled()) return null;

  if (settings().installHidden) {
    return section('Installing the app', [el('p', { class: 'muted' }, [
      el('a', {
        href: '#/help', text: 'Show the install instructions again',
        onclick: () => { saveSettings({ ...settings(), installHidden: false }); ctx.render(); },
      }),
    ])]);
  }

  return section('Installing the app', [
    el('p', { class: 'muted', text: 'This is running in a browser tab. Installing gives it a '
      + 'home-screen icon and its own window, and it keeps working with no signal.' }),
    ...(canInstall() ? [el('button', {
      class: 'primary', text: 'Install this app',
      // The offer is spent either way, so redraw if it fails: the button
      // must not sit there promising something it can no longer do.
      onclick: () => promptInstall().catch(() => ctx.render()),
    })] : []),
    el('p', { class: 'muted', text: canInstall()
      ? 'Nothing is downloaded from a store — the app is already here.'
      : 'No button? Only Chrome offers one. Every browser installs from its own menu:' }),
    ...(canInstall() ? [] : [el('ul', { class: 'steps' }, [
      el('li', { text: 'Firefox: ⋮ → Install, or Add to Home screen.' }),
      el('li', { text: 'Chrome: ⋮ → Install app. If the bar shows ✕ and no tabs, the page '
        + 'was opened by a scan — ⋮ → Open in Chrome first, then install there.' }),
      el('li', { text: 'Samsung Internet: ≡ → Add page to → Home screen.' }),
      el('li', { text: 'iPhone: Share → Add to Home Screen.' }),
    ])]),
    el('p', { class: 'muted', text: 'Firefox makes a shortcut rather than a real app: it '
      + 'still works offline, but it opens in Firefox and cannot announce itself as '
      + 'installed. Hide this section by hand once you have done it.' }),
    el('button', {
      text: 'Already installed — hide this',
      onclick: () => {
        saveSettings({ ...settings(), installHidden: true });
        ctx.render();
      },
    }),
  ]);
}

export function showHelp() {
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'Help' }));

  const install = installSection();
  if (install) view.append(install);

  view.append(section('What the three activities are for', [
    p([b('View cards'), ' — flip through the list. Records nothing; no dates move.']),
    p([b('Train'), ' — learn a word you don’t know yet. Four choices first; once you '
      + 'pick right, you have to type it.']),
    p([b('Test'), ' — find out whether it stuck. No scaffolding: you recall it cold, '
      + 'or you grade yourself on a flashcard.']),
    p(['You can Test without Training. They are two doors into the same records, not '
      + 'two stages — Test just gives no help, so an untrained list is simply harder.']),
  ]));

  view.append(section('What “due” means', [
    p(['Every card is really two items to learn: front→back and back→front. Reading '
      + 'a word and producing it are different skills, so they have separate progress.']),
    p(['Each item carries a box (1 to 5) and a date. Answer it correctly and the box '
      + 'goes up one and the date moves further out — 3 days, then 7, then 16, then '
      + '35. Get it wrong and the box drops straight back to 1 and the date is '
      + 'tomorrow. “12 due” means twelve items whose date has arrived.']),
    p(['That is the whole idea: words you know keep getting pushed away so they stop '
      + 'eating your sessions, and the moment one slips it comes back tomorrow.']),
  ]));

  view.append(section('Which one should I use?', [
    p([b('Something due'), ' → Test. That is the review appointment, and Test is '
      + 'what clears it. Train ignores due dates entirely, so it will not reduce a '
      + 'backlog.']),
    p([b('A new list, or a word that keeps escaping you'), ' → Train. Words you fail '
      + 'most are exactly the ones a batch picks first.']),
    p([b('Nothing due but you want practice'), ' → Train, or Test with “Practise the '
      + 'whole list now”, which throws the verdicts away.']),
    p(['The two hand off to each other: fail a word in a Test and its rung resets, so '
      + 'next time you Train it comes back with four choices instead of demanding '
      + 'cold recall.']),
  ]));

  view.append(section('Why “learned” stays at 0% for a while', [
    p(['“Learned” means an item reached box 4, and each correct answer moves it one '
      + 'box. So it takes three correct answers — and you cannot rush them, because '
      + 'each one pushes the next review further out. A brand-new word realistically '
      + 'reaches “learned” about ten days in: right today, right again three days '
      + 'later, right again a week after that.']),
    p(['It is not a measure of how today went. It is a claim that something '
      + 'survived being left alone, which is why one perfect session does not move '
      + 'it.']),
    p(['Note the total counts both directions, so if you only ever study one '
      + 'direction, learned % stops at 50%.']),
  ]));

  view.append(section('Adding another device', [
    p(['Point the new device’s camera at this. It is only the app’s address and carries '
      + 'no secret.']),
    el('div', { class: 'qr-pair' }, [
      qrCard(APP_URL, 'Install it on the new device', 'A QR code of the app’s address'),
    ]),
    el('ol', { class: 'steps' }, [
      el('li', { text: 'Scan it. The app opens in whatever browser that phone uses.' }),
      el('li', { text: 'Open its own Help, which says how to install it in that '
        + 'particular browser.' }),
      el('li', { text: 'Open it from the home screen from now on.' }),
    ]),
    p(['That is the whole of setup for a device you only study on. It needs no token.']),
    p(['To let it save changes too, it needs a token. Its own ', b('Settings → Token'),
      ' will walk it through making one on GitHub — the safe route, because a token made '
      + 'there can be revoked on its own.']),
    p(['The ', b('Show token QR'), ' button on that same page is the shortcut instead: it '
      + 'hands this device’s token over. Both devices then share one token, so revoking it '
      + 'cuts off both, and the code is on screen while you scan it. The other device always '
      + 'asks before it saves anything.']),
  ]));
}
