import { describe, it, expect } from 'vitest';
import { swapSides } from '../app/sides.js';

describe('swapSides', () => {
  const list = {
    id: 'es-food', name: 'Spanish – Food', folder: 'Languages',
    frontLabel: 'Español', backLabel: 'Français', frontLang: 'es', backLang: 'fr',
    cards: [
      { id: 'a1', front: 'el pan', back: 'le pain' },
      { id: 'b2', front: 'la leche', back: 'le lait' },
      { id: 'c3', front: 'el agua', back: "l'eau" },
    ],
  };
  const progress = {
    listId: 'es-food',
    items: {
      'a1:f2b': { box: 3, due: '2026-09-08', seen: 7, lapses: 1, lastSeen: '2026-09-01T10:00:00Z' },
      'a1:b2f': { box: 1, due: '2026-09-02', seen: 4, lapses: 3, lastSeen: '2026-09-01T10:05:00Z' },
      'b2:f2b': { box: 2, due: '2026-09-03', seen: 2, lapses: 0, lastSeen: '2026-09-01T09:00:00Z' },
      // c3 has no progress at all.
    },
  };

  it('swaps the list labels and languages', () => {
    const { list: swapped } = swapSides({ list, progress });
    expect(swapped.frontLabel).toBe('Français');
    expect(swapped.backLabel).toBe('Español');
    expect(swapped.frontLang).toBe('fr');
    expect(swapped.backLang).toBe('es');
  });

  it('leaves other list fields untouched', () => {
    const { list: swapped } = swapSides({ list, progress });
    expect(swapped.id).toBe('es-food');
    expect(swapped.name).toBe('Spanish – Food');
    expect(swapped.folder).toBe('Languages');
  });

  it('swaps front and back text on every card, keeping ids', () => {
    const { list: swapped } = swapSides({ list, progress });
    expect(swapped.cards).toEqual([
      { id: 'a1', front: 'le pain', back: 'el pan' },
      { id: 'b2', front: 'le lait', back: 'la leche' },
      { id: 'c3', front: "l'eau", back: 'el agua' },
    ]);
  });

  it('swaps f2b and b2f progress for a card with both directions studied', () => {
    const { progress: swapped } = swapSides({ list, progress });
    expect(swapped.items['a1:b2f']).toEqual(progress.items['a1:f2b']);
    expect(swapped.items['a1:f2b']).toEqual(progress.items['a1:b2f']);
  });

  it('swaps the key of a card with only one direction studied', () => {
    const { progress: swapped } = swapSides({ list, progress });
    expect(swapped.items['b2:b2f']).toEqual(progress.items['b2:f2b']);
    expect(swapped.items['b2:f2b']).toBeUndefined();
  });

  it('has no entries for a card with no progress at all', () => {
    const { progress: swapped } = swapSides({ list, progress });
    expect(swapped.items['c3:f2b']).toBeUndefined();
    expect(swapped.items['c3:b2f']).toBeUndefined();
  });

  it('keeps listId on the progress record', () => {
    const { progress: swapped } = swapSides({ list, progress });
    expect(swapped.listId).toBe('es-food');
  });

  it('is pure: does not mutate its inputs', () => {
    const beforeList = JSON.parse(JSON.stringify(list));
    const beforeProgress = JSON.parse(JSON.stringify(progress));
    swapSides({ list, progress });
    expect(list).toEqual(beforeList);
    expect(progress).toEqual(beforeProgress);
  });
});
