import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

// The service worker's SHELL is a promise: these files will be there offline.
// Nothing enforces it at runtime — cache.addAll rejects atomically, so one
// wrong path silently strands every client on the previous cache, and a file
// merely left out breaks only later, only offline, only for that one thing.
// CLAUDE.md states the rule; this is the part that checks it.
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const root = new URL('../', import.meta.url);

const shell = [...sw.match(/const SHELL = \[(.*?)\];/s)[1].matchAll(/'\.\/([^']*)'/g)]
  .map((match) => match[1])
  .filter(Boolean);

const modulesOnDisk = [
  ...readdirSync(new URL('app/', root)).filter((name) => name.endsWith('.js')).map((n) => `app/${n}`),
  ...readdirSync(new URL('app/screens/', root)).filter((name) => name.endsWith('.js')).map((n) => `app/screens/${n}`),
];

describe('the service worker shell', () => {
  it('lists nothing that is not there', () => {
    expect(shell.filter((path) => !existsSync(new URL(path, root)))).toEqual([]);
  });

  it('lists every module in app/, so none is missed and breaks offline', () => {
    expect(modulesOnDisk.filter((path) => !shell.includes(path))).toEqual([]);
  });

  it('lists the icons the manifest names, so an install can always draw one', () => {
    const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
    const icons = manifest.icons.map((icon) => icon.src.replace(/^\.?\//, ''));
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.filter((path) => !shell.includes(path))).toEqual([]);
  });

  it('names a cache version, which every shell change must move', () => {
    expect(sw).toMatch(/const CACHE = 'myquizzlet-v\d+';/);
  });

  // A failed fetch must fail as itself. Answering an icon or a module with
  // index.html hands the browser HTML where it asked for a PNG, and Firefox
  // then draws a generated icon instead of ours.
  it('falls back to the app shell only for a navigation', () => {
    const fallback = sw.slice(sw.indexOf('.catch(() => caches.match(request)'));
    expect(fallback).toContain("request.mode === 'navigate'");
    expect(fallback.indexOf("request.mode === 'navigate'"))
      .toBeLessThan(fallback.indexOf("caches.match('./index.html')"));
  });
});
