import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/style.css', import.meta.url), 'utf8');

// Strips every :root block (including :root[data-theme="…"]), then returns the
// value half of every declaration that survives.
function valuesOutsideRoot(source) {
  const withoutRoot = source.replace(/:root[^{]*\{[^}]*\}/g, '');
  return [...withoutRoot.matchAll(/\{([^}]*)\}/g)]
    .flatMap((match) => match[1].split(';'))
    .map((decl) => decl.slice(decl.indexOf(':') + 1).trim())
    .filter(Boolean);
}

const TOKENS = ['--ground', '--surface', '--ink', '--rule', '--field',
                '--muted', '--accent', '--ok', '--bad', '--warn'];

describe('the colour rule', () => {
  it('states every colour as a custom property, never as a literal', () => {
    const offenders = valuesOutsideRoot(css)
      .filter((value) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(value));
    expect(offenders).toEqual([]);
  });

  it('defines the whole token set', () => {
    for (const token of TOKENS) expect(css).toContain(`${token}:`);
  });
});
