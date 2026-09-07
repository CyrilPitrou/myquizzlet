import { el, clear, openDialog } from '../ui.js';
import { store } from '../app.js';
import { EMOJIS, createProfile, validateProfileName } from '../profiles.js';
import {
  createProfileLock, isProfileLocked, passwordProblem, PROFILE_PASSWORD_MIN_LENGTH,
} from '../profilelock.js';
import { requestProfilePassword } from './profilelockdialog.js';
import { t } from '../i18n.js';

export function openProfileDialog({ onSelect, onCancel, canCancel = true, forceCreate = false } = {}) {
  let mode = forceCreate || store.getProfiles().length === 0 ? 'create' : 'list';
  let selectedEmoji = EMOJIS[1]; // default 🐻
  let settled = false;

  const content = el('div', { class: 'profile-dialog-content' });
  const dialog = openDialog([content]);

  dialog.addEventListener('close', () => {
    if (!settled && onCancel) onCancel();
  });

  function render() {
    clear(content);
    if (mode === 'list') {
      renderList();
    } else {
      renderCreate();
    }
  }

  function renderList() {
    const profiles = store.getProfiles();
    const activeId = store.getActiveProfile();

    const title = el('h2', { text: t('profile.choose') });
    const list = el('div', { class: 'profile-list' }, profiles.map((p) => {
      const isActive = p.id === activeId;
      const item = el('button', {
        class: `profile-item${isActive ? ' active' : ''}`,
        type: 'button',
        onclick: async () => {
          if (isProfileLocked(p) && !(await requestProfilePassword(p))) return;
          settled = true;
          store.setActiveProfile(p.id);
          dialog.close();
          if (onSelect) onSelect(p);
        },
      }, [
        el('span', { class: 'profile-emoji', text: p.emoji }),
        el('span', { class: 'profile-name', text: p.name }),
        ...(isProfileLocked(p)
          ? [el('span', { class: 'profile-lock', title: t('profile.protected'), text: '🔒' })]
          : []),
        ...(isActive ? [el('span', { class: 'profile-check', text: '✓' })] : []),
      ]);
      return item;
    }));

    const createBtn = el('button', {
      class: 'btn profile-create-btn',
      type: 'button',
      text: `＋ ${t('profile.new')}`,
      onclick: () => {
        mode = 'create';
        render();
      },
    });

    const actions = el('div', { class: 'dialog-actions' }, [
      ...(canCancel ? [el('button', {
        class: 'btn',
        type: 'button',
        text: t('common.cancel'),
        onclick: () => {
          settled = true;
          dialog.close();
          if (onCancel) onCancel();
        },
      })] : []),
    ]);

    content.append(title, list, createBtn, actions);
  }

  function renderCreate() {
    const title = el('h2', { text: t('profile.new') });
    const errorMsg = el('p', { class: 'warn profile-error', hidden: 'hidden' });

    const nameInput = el('input', {
      type: 'text',
      class: 'profile-name-input',
      maxlength: '20',
      placeholder: t('profile.namePlaceholder'),
      required: 'required',
      autofocus: 'autofocus',
    });
    const passwordInput = el('input', {
      type: 'password', minlength: String(PROFILE_PASSWORD_MIN_LENGTH),
      required: 'required', autocomplete: 'off',
    });
    const passwordConfirm = el('input', {
      type: 'password', minlength: String(PROFILE_PASSWORD_MIN_LENGTH),
      required: 'required', autocomplete: 'off',
    });

    const emojiButtons = EMOJIS.map((emoji) => el('button', {
      class: `profile-emoji-btn${emoji === selectedEmoji ? ' selected' : ''}`,
      type: 'button',
      text: emoji,
      onclick: () => {
        selectedEmoji = emoji;
        emojiButtons.forEach((btn) => btn.classList.toggle('selected', btn.textContent === emoji));
      },
    }));

    const emojisGrid = el('div', { class: 'profile-emojis' }, emojiButtons);
    const createBtn = el('button', {
      class: 'btn primary', type: 'submit', text: t('profile.create'),
    });

    const form = el('form', {
      class: 'profile-form', autocomplete: 'off',
      onsubmit: async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const err = validateProfileName(name, store.getProfiles());
        if (err === 'duplicate') {
          errorMsg.textContent = t('profile.exists');
          errorMsg.hidden = false;
          return;
        }
        if (err === 'empty') {
          nameInput.focus();
          return;
        }

        const passwordError = passwordProblem(passwordInput.value, passwordConfirm.value);
        if (passwordError) {
          errorMsg.textContent = t(`profile.password.${passwordError}`);
          errorMsg.hidden = false;
          (passwordError === 'short' ? passwordInput : passwordConfirm).focus();
          return;
        }

        createBtn.disabled = true;
        let lock;
        try {
          lock = await createProfileLock(passwordInput.value);
        } catch {
          createBtn.disabled = false;
          errorMsg.textContent = t('profile.password.failed');
          errorMsg.hidden = false;
          return;
        }
        const newProfile = { ...createProfile(name, selectedEmoji, store.getProfiles()), lock };
        store.saveProfiles([...store.getProfiles(), newProfile]);
        store.setActiveProfile(newProfile.id);
        settled = true;
        dialog.close();
        if (onSelect) onSelect(newProfile);
      },
    }, [
      el('label', { class: 'field' }, [
        el('span', { text: t('profile.name') }),
        nameInput,
      ]),
      el('div', { class: 'field' }, [
        el('span', { text: t('profile.pickIcon') }),
        emojisGrid,
      ]),
      el('p', { class: 'muted', text: t('profile.passwordHint') }),
      el('label', { class: 'field' }, [
        el('span', { text: t('profile.password') }),
        passwordInput,
      ]),
      el('label', { class: 'field' }, [
        el('span', { text: t('profile.passwordConfirm') }),
        passwordConfirm,
      ]),
      errorMsg,
      el('div', { class: 'dialog-actions' }, [
        el('button', {
          class: 'btn profile-cancel-btn',
          type: 'button',
          text: t('common.cancel'),
          onclick: () => {
            if (store.getProfiles().length > 0) {
              mode = 'list';
              render();
            } else {
              settled = true;
              dialog.close();
              if (onCancel) onCancel();
            }
          },
        }),
        createBtn,
      ]),
    ]);

    content.append(title, form);
    requestAnimationFrame(() => nameInput.focus());
  }

  render();
  return dialog;
}
