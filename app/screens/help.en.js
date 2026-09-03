// The Help prose, as data. help.js owns the layout; this file owns the words.
// A paragraph is an array of parts: a plain string, or { b: text } for a bold
// span — help.js turns that into <strong> when it builds the <p>.
export const helpEn = {
  install: {
    heading: 'Installing the app',
    showAgain: 'Show the install instructions again',
    blurb: 'This is running in a browser tab. Installing gives it a home-screen icon and its own window, and it keeps working with no signal.',
    installButton: 'Install this app',
    noStoreDownload: 'Nothing is downloaded from a store — the app is already here.',
    noButtonBlurb: 'No button? Only Chrome offers one. Every browser installs from its own menu:',
    steps: [
      'Firefox: ⋮ → Install, or Add to Home screen.',
      'Chrome: ⋮ → Install app. If the bar shows ✕ and no tabs, the page was opened by a scan — ⋮ → Open in Chrome first, then install there.',
      'Samsung Internet: ≡ → Add page to → Home screen.',
      'iPhone: Share → Add to Home Screen.',
    ],
    firefoxNote: 'Firefox makes a shortcut rather than a real app: it still works offline, but it opens in Firefox and cannot announce itself as installed. Hide this section by hand once you have done it.',
    hideButton: 'Already installed — hide this',
  },
  shareToken: {
    none: 'This device has no token, so it has none to share.',
  },
  sections: [
    {
      heading: 'What the three activities are for',
      paragraphs: [
        [{ b: 'View cards' }, ' — flip through the list. Records nothing; no dates move.'],
        [{ b: 'Train' }, ' — learn a word you don’t know yet. Four choices first; once you pick right, you have to type it.'],
        [{ b: 'Test' }, ' — find out whether it stuck. No scaffolding: you recall it cold, or you grade yourself on a flashcard.'],
        ['You can Test without Training. They are two doors into the same records, not two stages — Test just gives no help, so an untrained list is simply harder.'],
      ],
    },
    {
      heading: 'What “due” means',
      paragraphs: [
        ['Every card is really two items to learn: front→back and back→front. Reading a word and producing it are different skills, so they have separate progress.'],
        ['Each item carries a box (1 to 5) and a date. Answer it correctly and the box goes up one and the date moves further out — 3 days, then 7, then 16, then 35. Get it wrong and the box drops straight back to 1 and the date is tomorrow. “12 due” means twelve items whose date has arrived.'],
        ['That is the whole idea: words you know keep getting pushed away so they stop eating your sessions, and the moment one slips it comes back tomorrow.'],
      ],
    },
    {
      heading: 'Which one should I use?',
      paragraphs: [
        [{ b: 'Something due' }, ' → Test. That is the review appointment, and Test is what clears it. Train ignores due dates entirely, so it will not reduce a backlog.'],
        [{ b: 'A new list, or a word that keeps escaping you' }, ' → Train. Words you fail most are exactly the ones a batch picks first.'],
        [{ b: 'Nothing due but you want practice' }, ' → Train, or Test with “Practise the whole list now”, which throws the verdicts away.'],
        ['The two hand off to each other: fail a word in a Test and its rung resets, so next time you Train it comes back with four choices instead of demanding cold recall.'],
      ],
    },
    {
      heading: 'Why “learned” stays at 0% for a while',
      paragraphs: [
        ['“Learned” means an item reached box 4, and each correct answer moves it one box. So it takes three correct answers — and you cannot rush them, because each one pushes the next review further out. A brand-new word realistically reaches “learned” about ten days in: right today, right again three days later, right again a week after that.'],
        ['It is not a measure of how today went. It is a claim that something survived being left alone, which is why one perfect session does not move it.'],
        ['Note the total counts both directions, so if you only ever study one direction, learned % stops at 50%.'],
      ],
    },
    {
      heading: 'Asking for a list',
      paragraphs: [
        ['The ', { b: '🪄' }, ' button opens a box where you write what you would like: a new list on a topic, more words in a list you already have, or a translation you think is wrong. Say how many words and how hard they should be.'],
        ['The box is shared with everyone using the app, so you will see what other people have asked for. Add yours underneath rather than replacing theirs.'],
        ['Nothing happens straight away. Cyril reads the box, does the work with an AI that checks its sources before changing a word you already have, and pushes the result. What has been done recently is listed under the box.'],
      ],
    },
    {
      heading: 'Adding another device',
      paragraphs: [
        ['Point the new device’s camera at this. It is only the app’s address and carries no secret.'],
      ],
      qrCaption: 'Install it on the new device',
      qrLabel: 'A QR code of the app’s address',
      steps: [
        'Scan it. The app opens in whatever browser that phone uses.',
        'Open its own Help, which says how to install it in that particular browser.',
        'Open it from the home screen from now on.',
      ],
      afterSteps: [
        ['That is the whole of setup for a device you only study on. It needs no token. To let it save changes too, read on.'],
      ],
    },
    {
      heading: 'What is a token?',
      paragraphs: [
        ['A token is a password this app uses to write to GitHub on your behalf. Without one it is still a complete trainer: you can study, add lists, edit cards, and nothing is missing from the screen. What is missing is everywhere else. Changes stay in this browser, they never reach your other devices, and clearing the browser’s data takes them with it.'],
        ['With one, every change is saved to GitHub within seconds, and every other device with a token picks it up. A device with no token still reads: it stays up to date, it just cannot contribute.'],
        [{ b: 'The quick way to get one' }, ' — on a device with a camera, scan the code from a device that is already set up. Its ', { b: 'Settings → Token' }, ' shows one. That is the whole procedure: no GitHub page, nothing to type. The scanning device asks you to confirm before it saves anything.'],
        [{ b: 'The other way' }, ' — make a token of its own on GitHub. This device’s ', { b: 'Settings → Token' }, ' walks through the form field by field. It is longer, but the token is separate: revoking it later stops that one device and no other.'],
        ['Two devices sharing one token share its fate — revoke it and both stop saving. That is usually fine, and it is why the quick way is worth taking. Either way, the token lives only in the browser that holds it. It is never written into a list, never exported, and this app has no server to keep it on.'],
      ],
    },
  ],
};
