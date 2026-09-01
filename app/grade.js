const ARTICLES = ['le', 'la', 'les', "l'", 'un', 'une', 'des', 'du',
  'el', 'los', 'las', 'lo', 'the', 'a', 'an', 'der', 'die', 'das', 'il', 'lo'];

export function normalise(text) {
  let s = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[.,!?;:¡¿"']/g, ' ').replace(/\s+/g, ' ').trim();
  const [first, ...rest] = s.split(' ');
  if (rest.length > 0 && ARTICLES.includes(first)) s = rest.join(' ');
  return s;
}

function alternatives(expected) {
  return String(expected).split(/[/,;]/).map(normalise).filter((s) => s !== '');
}

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let beforePrevious = null;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && beforePrevious) {
        current[j] = Math.min(current[j], beforePrevious[j - 2] + 1);
      }
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[b.length];
}

export function grade(expected, typed) {
  const answer = normalise(typed);
  if (answer === '') return 'wrong';
  const options = alternatives(expected);
  if (options.includes(answer)) return 'correct';
  for (const option of options) {
    if (option.length > 3 && distance(option, answer) === 1) return 'typo';
  }
  return 'wrong';
}
