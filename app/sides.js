// Swaps which side is "front" and which is "back" for a whole list: labels,
// languages, every card's text, and — the part that's easy to get wrong —
// each card's progress. Progress keys are `<cardId>:f2b` / `<cardId>:b2f`,
// naming a *skill* (recognising vs. producing), not a column. Swapping the
// columns without swapping the keys would silently swap what a card's SRS
// state means, so the keys move to keep tracking the same skill.
export function swapSides({ list, progress }) {
  const cards = list.cards.map((card) => ({ ...card, front: card.back, back: card.front }));

  const items = {};
  for (const [key, value] of Object.entries(progress.items || {})) {
    const cardId = key.slice(0, key.lastIndexOf(':'));
    const direction = key.slice(key.lastIndexOf(':') + 1);
    const swappedDirection = direction === 'f2b' ? 'b2f' : 'f2b';
    items[`${cardId}:${swappedDirection}`] = value;
  }

  return {
    list: {
      ...list,
      frontLabel: list.backLabel,
      backLabel: list.frontLabel,
      frontLang: list.backLang,
      backLang: list.frontLang,
      cards,
    },
    progress: { ...progress, items },
  };
}
