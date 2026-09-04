import { el } from '../ui.js';
import { screen, settings, saveSettings, ctx } from '../app.js';
import { qrCard } from '../qrcard.js';
import { tokenQr } from '../tokenshare.js';
import { APP_URL } from '../setup.js';
import { isInstalled, canInstall, promptInstall } from '../install.js';
import { t, lang } from '../i18n.js';
import { helpEn } from './help.en.js';
import { helpFr } from './help.fr.js';

// Read at paint time, never at module load, so the words follow the flag.
const prose = () => (lang() === 'fr' ? helpFr : helpEn);

function section(title, nodes) {
  return el('section', { class: 'sect' }, [el('h3', { text: title }), ...nodes]);
}

// A paragraph is an array of parts: a plain string, or { b: text } for a bold
// span.
const part = (piece) => (typeof piece === 'string' ? piece : el('strong', { text: piece.b }));
const p = (parts) => el('p', {}, parts.map(part));
const steps = (items) => el('ul', { class: 'steps' }, items.map((text) => el('li', { text })));

// Hidden once the browser says so, once a home-screen launch says so, or
// once you have said so — the last because a Firefox shortcut says nothing.
function installSection(words) {
  if (isInstalled()) return null;

  if (settings().installHidden) {
    return section(words.install.heading, [el('p', { class: 'muted' }, [
      el('a', {
        href: '#/help', text: words.install.showAgain,
        onclick: () => { saveSettings({ ...settings(), installHidden: false }); ctx.render(); },
      }),
    ])]);
  }

  return section(words.install.heading, [
    el('p', { class: 'muted', text: words.install.blurb }),
    ...(canInstall() ? [el('button', {
      class: 'primary', text: words.install.installButton,
      // The offer is spent either way, so redraw if it fails: the button
      // must not sit there promising something it can no longer do.
      onclick: () => promptInstall().catch(() => ctx.render()),
    })] : []),
    el('p', { class: 'muted', text: canInstall()
      ? words.install.noStoreDownload
      : words.install.noButtonBlurb }),
    ...(canInstall() ? [] : [steps(words.install.steps)]),
    el('p', { class: 'muted', text: words.install.firefoxNote }),
    el('button', {
      text: words.install.hideButton,
      onclick: () => {
        saveSettings({ ...settings(), installHidden: true });
        ctx.render();
      },
    }),
  ]);
}

// The token section ends by describing the quick way — scan a code from a
// device already set up — so the thing that shows that code is here rather
// than named and left three screens away. It is the same control the Token
// page offers: one implementation, with its own opt-in and its own
// minute-long timer. On a device with no token there is nothing to show, so
// it becomes the way in to getting one.
function shareToken(words) {
  const current = settings();
  if (current.token) return [tokenQr(current)];
  return [
    el('p', { class: 'muted', text: words.shareToken.none }),
    el('p', {}, [el('a', { class: 'btn', href: '#/token', text: t('settings.token.manage') })]),
  ];
}

export function showHelp() {
  const active = prose();
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: t('common.back.lists') }));
  view.append(el('h2', { text: t('nav.help') }));

  const install = installSection(active);
  if (install) view.append(install);

  const [activities, due, which, learned, wishes, devices, token] = active.sections;

  view.append(section(activities.heading, activities.paragraphs.map(p)));
  view.append(section(due.heading, due.paragraphs.map(p)));
  view.append(section(which.heading, which.paragraphs.map(p)));
  view.append(section(learned.heading, learned.paragraphs.map(p)));
  view.append(section(wishes.heading, wishes.paragraphs.map(p)));

  view.append(section(devices.heading, [
    ...devices.paragraphs.map(p),
    el('div', { class: 'qr-pair' }, [
      qrCard(APP_URL, devices.qrCaption, devices.qrLabel),
    ]),
    steps(devices.steps),
    ...devices.afterSteps.map(p),
  ]));

  view.append(section(token.heading, [
    ...token.paragraphs.map(p),
    ...shareToken(active),
  ]));
}
