import { el, openDialog } from '../ui.js';
import {
  createProfileLock, passwordProblem, verifyProfilePassword, PROFILE_PASSWORD_MIN_LENGTH,
} from '../profilelock.js';
import { t } from '../i18n.js';

// Resolve a modal exactly once, whether a button, Escape, or verification
// closes it. Callers can await it without keeping dialog state of their own.
function resolvableDialog(build) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      dialog.close();
      resolve(value);
    };
    const dialog = openDialog(build(finish));
    dialog.addEventListener('close', () => {
      if (!settled) { settled = true; resolve(null); }
    });
  });
}

export function requestProfilePassword(profile, {
  title = t('profile.unlockTitle', { name: profile.name }),
  body = t('profile.unlockBody', { name: profile.name }),
  confirmText = t('profile.unlock'),
  danger = false,
} = {}) {
  return resolvableDialog((finish) => {
    const error = el('p', { class: 'warn profile-error', hidden: 'hidden' });
    const password = el('input', {
      type: 'password', required: 'required', autocomplete: 'off',
      autofocus: 'autofocus',
    });
    const submit = el('button', {
      class: danger ? 'danger' : 'primary', type: 'submit', text: confirmText,
    });
    const form = el('form', {
      class: 'profile-form', autocomplete: 'off',
      onsubmit: async (event) => {
        event.preventDefault();
        submit.disabled = true;
        const correct = await verifyProfilePassword(password.value, profile.lock);
        submit.disabled = false;
        if (!correct) {
          error.textContent = t('profile.passwordWrong');
          error.hidden = false;
          password.select();
          return;
        }
        finish(true);
      },
    }, [
      el('p', { class: danger ? 'warn' : '', text: body }),
      el('label', { class: 'field' }, [
        el('span', { text: t('profile.password') }), password,
      ]),
      error,
      el('div', { class: 'dialog-actions' }, [
        el('button', { type: 'button', text: t('common.cancel'), onclick: () => finish(null) }),
        submit,
      ]),
    ]);
    return [el('h2', { text: title }), form];
  });
}

export function requestNewProfileLock({
  title,
  body,
  confirmText = t('profile.protect'),
} = {}) {
  return resolvableDialog((finish) => {
    const error = el('p', { class: 'warn profile-error', hidden: 'hidden' });
    const password = el('input', {
      type: 'password', minlength: String(PROFILE_PASSWORD_MIN_LENGTH), required: 'required',
      autocomplete: 'off', autofocus: 'autofocus',
    });
    const confirmation = el('input', {
      type: 'password', minlength: String(PROFILE_PASSWORD_MIN_LENGTH),
      required: 'required', autocomplete: 'off',
    });
    const submit = el('button', { class: 'primary', type: 'submit', text: confirmText });
    const form = el('form', {
      class: 'profile-form', autocomplete: 'off',
      onsubmit: async (event) => {
        event.preventDefault();
        const problem = passwordProblem(password.value, confirmation.value);
        if (problem) {
          error.textContent = t(`profile.password.${problem}`);
          error.hidden = false;
          (problem === 'short' ? password : confirmation).focus();
          return;
        }
        submit.disabled = true;
        try {
          finish(await createProfileLock(password.value));
        } catch {
          submit.disabled = false;
          error.textContent = t('profile.password.failed');
          error.hidden = false;
        }
      },
    }, [
      ...(body ? [el('p', { text: body })] : []),
      el('p', { class: 'muted', text: t('profile.passwordHint') }),
      el('label', { class: 'field' }, [
        el('span', { text: t('profile.password') }), password,
      ]),
      el('label', { class: 'field' }, [
        el('span', { text: t('profile.passwordConfirm') }), confirmation,
      ]),
      error,
      el('div', { class: 'dialog-actions' }, [
        el('button', { type: 'button', text: t('common.cancel'), onclick: () => finish(null) }),
        submit,
      ]),
    ]);
    return [el('h2', { text: title }), form];
  });
}
