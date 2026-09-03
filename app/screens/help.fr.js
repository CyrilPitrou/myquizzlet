// La prose d’Aide en français. Même forme que help.en.js — help.js lit les
// deux et choisit selon la langue en cours.
export const helpFr = {
  install: {
    heading: 'Installer l’appli',
    showAgain: 'Réafficher les instructions d’installation',
    blurb: 'Ceci tourne dans un onglet de navigateur. L’installer lui donne une icône sur l’écran d’accueil et sa propre fenêtre, et elle continue de fonctionner sans réseau.',
    installButton: 'Installer cette appli',
    noStoreDownload: 'Rien n’est téléchargé depuis un store — l’appli est déjà là.',
    noButtonBlurb: 'Pas de bouton ? Seul Chrome en propose un. Chaque navigateur installe depuis son propre menu :',
    steps: [
      'Firefox : ⋮ → Installer, ou Ajouter à l’écran d’accueil.',
      'Chrome : ⋮ → Installer l’appli. Si la barre affiche ✕ et aucun onglet, la page a été ouverte par un scan — ⋮ → Ouvrir dans Chrome d’abord, puis installer depuis là.',
      'Samsung Internet : ≡ → Ajouter la page à → Écran d’accueil.',
      'iPhone : Partager → Sur l’écran d’accueil.',
    ],
    firefoxNote: 'Firefox crée un raccourci plutôt qu’une vraie appli : elle continue de fonctionner hors ligne, mais s’ouvre dans Firefox et ne peut pas se signaler comme installée. Masquez cette section à la main une fois que c’est fait.',
    hideButton: 'Déjà installée — masquer',
  },
  shareToken: {
    none: 'Cet appareil n’a pas de jeton, il n’a donc rien à partager.',
  },
  sections: [
    {
      heading: 'À quoi servent les trois activités',
      paragraphs: [
        [{ b: 'Voir les cartes' }, ' — feuilleter la liste. Rien n’est enregistré ; aucune date ne bouge.'],
        [{ b: 'S’entraîner' }, ' — apprendre un mot que vous ne connaissez pas encore. Quatre choix d’abord ; une fois la bonne réponse trouvée, il faut la taper.'],
        [{ b: 'Test' }, ' — vérifier si ça a été retenu. Aucune aide : vous le rappelez à froid, ou vous vous notez vous-même sur une carte.'],
        ['Vous pouvez faire un Test sans être passé par l’entraînement. Ce sont deux portes vers les mêmes enregistrements, pas deux étapes — Test ne donne simplement aucune aide, donc une liste non entraînée est simplement plus difficile.'],
      ],
    },
    {
      heading: 'Ce que signifie « à revoir »',
      paragraphs: [
        ['Chaque carte représente en réalité deux éléments à apprendre : recto→verso et verso→recto. Lire un mot et le produire sont deux compétences différentes, donc leur progression est séparée.'],
        ['Chaque élément porte une case (1 à 5) et une date. Une bonne réponse fait monter la case d’un cran et repousse la date plus loin — 3 jours, puis 7, puis 16, puis 35. Une mauvaise réponse ramène la case à 1 et fixe la date à demain. « 12 à revoir » veut dire douze éléments dont la date est arrivée.'],
        ['C’est toute l’idée : les mots que vous connaissez sont repoussés de plus en plus loin pour ne pas encombrer vos séances, et dès qu’un mot glisse, il revient dès le lendemain.'],
      ],
    },
    {
      heading: 'Lequel utiliser ?',
      paragraphs: [
        [{ b: 'Quelque chose à revoir' }, ' → Test. C’est le rendez-vous de révision, et Test est ce qui le solde. S’entraîner ignore complètement les dates à revoir, donc cela ne réduira pas un retard.'],
        [{ b: 'Une nouvelle liste, ou un mot qui vous échappe sans cesse' }, ' → S’entraîner. Les mots que vous ratez le plus sont justement ceux qu’un lot choisit en premier.'],
        [{ b: 'Rien à revoir mais vous voulez pratiquer' }, ' → S’entraîner, ou Test avec « Réviser toute la liste maintenant », qui jette les verdicts.'],
        ['Les deux se relaient : ratez un mot dans un Test et son échelon revient à zéro, donc la prochaine fois vous l’entraînerez avec quatre choix au lieu d’exiger un rappel à froid.'],
      ],
    },
    {
      heading: 'Pourquoi « appris » reste à 0% un moment',
      paragraphs: [
        ['« Appris » signifie qu’un élément a atteint la case 4, et chaque bonne réponse le fait avancer d’une case. Il faut donc trois bonnes réponses — et vous ne pouvez pas les précipiter, puisque chacune repousse la révision suivante plus loin. Un mot tout neuf atteint « appris » réalistement au bout d’une dizaine de jours : bon aujourd’hui, bon de nouveau trois jours plus tard, bon de nouveau une semaine après.'],
        ['Ce n’est pas une mesure de la séance du jour. C’est une affirmation que quelque chose a survécu à être laissé de côté, d’où le fait qu’une séance parfaite ne le fait pas bouger.'],
        ['Remarquez que le total compte les deux sens, donc si vous n’étudiez jamais qu’un seul sens, le pourcentage appris plafonne à 50%.'],
      ],
    },
    {
      heading: 'Ajouter un autre appareil',
      paragraphs: [
        ['Pointez la caméra du nouvel appareil sur ceci. C’est uniquement l’adresse de l’appli, sans aucun secret.'],
      ],
      qrCaption: 'L’installer sur le nouvel appareil',
      qrLabel: 'Un QR code de l’adresse de l’appli',
      steps: [
        'Scannez-le. L’appli s’ouvre dans le navigateur que ce téléphone utilise.',
        'Ouvrez sa propre page Aide, qui explique comment l’installer dans ce navigateur en particulier.',
        'Ouvrez-la depuis l’écran d’accueil à partir de maintenant.',
      ],
      afterSteps: [
        ['C’est tout ce qu’il faut pour un appareil qui ne fait qu’étudier. Il n’a besoin d’aucun jeton.'],
        ['Pour qu’il puisse aussi enregistrer des modifications, il lui faut un jeton. Sa propre page ', { b: 'Réglages → Jeton' },
          ' l’accompagnera pour en créer un sur GitHub — la voie sûre, car un jeton créé là-bas peut être révoqué indépendamment.'],
        ['Vous pouvez aussi transmettre directement le jeton de cet appareil. L’autre appareil demande toujours confirmation avant d’enregistrer quoi que ce soit.'],
      ],
    },
  ],
};
