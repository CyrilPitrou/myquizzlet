import { messagesEn } from './messages.en.js';
import { messagesFr } from './messages.fr.js';

const SETS = { en: messagesEn, fr: messagesFr };

// Pure. An empty session is not a triumph, so zero out of zero lands in the
// middle rather than at the top.
export function bucketFor(right, total) {
  if (total <= 0) return 'ok';
  const share = right / total;
  if (share === 1) return 'perfect';
  if (share >= 0.85) return 'great';
  if (share >= 0.6) return 'ok';
  return 'rough';
}

// The die is an argument, so the choice can be tested.
export function pick(bucket, langCode, rand = Math.random) {
  const lines = (SETS[langCode] || messagesEn)[bucket];
  return lines[Math.floor(rand() * lines.length)];
}
