# Teaching Lists Plan

A plan for seven new folders, each aimed at a CEFR reference level. This
document decides *which lists exist* and *what each contains*. It does not
contain the cards; those are generated later, folder by folder.

Status: agreed 2026-09-04. Nothing generated yet.

## Conventions

Card shape follows the existing `English` and `Spanish` folders: the target
language on the front, the French gloss on the back.

| Folder | `folder` | `frontLabel`/`backLabel` | `frontLang`→`backLang` |
|---|---|---|---|
| Spanish B1 | `Spanish B1` | `Spanish`/`French` | `es`→`fr` |
| Spanish B2 | `Spanish B2` | `Spanish`/`French` | `es`→`fr` |
| English B1 | `English B1` | `English`/`French` | `en`→`fr` |
| English B2 | `English B2` | `English`/`French` | `en`→`fr` |
| English C1 | `English C1` | `English`/`French` | `en`→`fr` |
| English C2 | `English C2` | `Word`/`Definition` | `en`→`en` |
| French C2 | `French C2` | `Mot`/`Définition` | `fr`→`fr` |

Grammar-drill lists are marked **extra**: they sit outside the 20×100
vocabulary budget and may use their own labels and direction, in the style of
the existing `verbes-irreguliers` (`fr`→`en`) and `es-present` (`es`→`es`).

Decisions taken:

- **Standalone.** These folders ignore the existing `English` and `Spanish`
  folders. Some words will repeat what is already there; the app treats them
  as separate cards with separate progress, and the old folders are not
  touched.
- **List names in the target language.** `Politics 1`, `La política`,
  `Mots rares et littéraires 1`.
- **Levels are self-sufficient, not strictly disjoint.** B2 assumes B1 but may
  repeat a word where the topic demands it; a strong learner can start at C1
  without having done B1. The word counts are therefore nominal.
- **Both directions are drilled regardless.** Every card yields `f2b` and
  `b2f` progress items, so the front/back choice only decides which side is
  shown first.

Ids are kebab-case with a level prefix: `es-b1-`, `es-b2-`, `en-b1-`,
`en-b2-`, `en-c1-`, `en-c2-`, `fr-c2-`.

### Scale

179 lists, roughly 17 500 cards, so roughly 35 000 progress items. `CLAUDE.md`
sizes the app for "a few thousand cards". Progress is stored per list, so this
should hold, but it is well past the intended scale and worth watching the
first time a folder lands.

---

## Spanish B1 — 20 lists, 2000 words

Everyday life: familiar matters at work, school and leisure, travel,
describing experiences, opinions and plans.

| id | name | n | content |
|---|---|---|---|
| `es-b1-persona-familia` | La persona y la familia | 100 | Identity, family ties, life stages, civil status, describing who someone is |
| `es-b1-cuerpo-salud` | El cuerpo y la salud | 100 | Body parts, symptoms, illness, the doctor, the pharmacy, staying well |
| `es-b1-casa-tareas` | La casa y las tareas | 100 | Housing, rooms, furniture, household objects, chores, repairs |
| `es-b1-comida-cocina` | La comida y la cocina | 100 | Ingredients, meals, cooking verbs, tastes, the restaurant, ordering |
| `es-b1-ciudad-desplazamientos` | La ciudad y los desplazamientos | 100 | City places, public transport, driving, directions, everyday services |
| `es-b1-compras-dinero` | Las compras y el dinero | 100 | Shops, prices, paying, returning, everyday banking |
| `es-b1-trabajo-oficios` | El trabajo y los oficios | 100 | Trades and professions, the workplace, contracts, looking for work |
| `es-b1-estudios` | Los estudios | 100 | School and university, subjects, exams, marks, student life |
| `es-b1-ocio-deporte` | El tiempo libre y el deporte | 100 | Hobbies, sports, games, going out, holidays as leisure |
| `es-b1-viajes-alojamiento` | Los viajes y el alojamiento | 100 | Travel, the airport and station, hotels, tourism, booking and complaining |
| `es-b1-naturaleza-animales` | La naturaleza y los animales | 100 | Landscape, weather, trees and plants, domestic and wild animals |
| `es-b1-tiempo-calendario` | El tiempo y el calendario | 100 | Clock time, dates, frequency, seasons, festivals, duration |
| `es-b1-caracter-emociones` | El carácter y las emociones | 100 | Personality adjectives, moods, feelings, reactions |
| `es-b1-aspecto-ropa` | El aspecto físico y la ropa | 100 | Appearance, height and build, hair and face, clothing, accessories |
| `es-b1-relaciones-vida-social` | Las relaciones y la vida social | 100 | Friendship, love, invitations, politeness formulas, social occasions |
| `es-b1-comunicacion-tecnologia` | La comunicación y la tecnología | 100 | Phone, post, internet, computers, basic media vocabulary |
| `es-b1-verbos-frecuentes-1` | Los verbos más frecuentes 1 | 100 | The hundred commonest verbs, with the sense a B1 learner needs first |
| `es-b1-verbos-frecuentes-2` | Los verbos más frecuentes 2 | 100 | The next hundred |
| `es-b1-conectores-adverbios` | Conectores y adverbios | 100 | Connectors, quantifiers, adverbs of manner and degree, discourse markers |
| `es-b1-expresiones-diarias` | Expresiones de la vida diaria | 100 | High-frequency set phrases: *tener ganas de*, *dar igual*, *hace falta*, *da lo mismo* |

**Extra (grammar)**

| id | name | labels / dir | n | content |
|---|---|---|---|---|
| `es-b1-ser-estar` | Ser o estar | `Français`/`Español`, `fr`→`es` | 60 | Sentence pairs where only one of the two is right, chosen to cover every rule |
| `es-b1-por-para` | Por o para | `Français`/`Español`, `fr`→`es` | 50 | Same shape, for the other great French-speaker trap |
| `es-b1-indefinido-irregular` | Pretérito indefinido irregular | `Verbe`/`Prétérit`, `es`→`es` | 60 | Infinitive on the front, the full irregular preterite table on the back, like `es-present` |
| `es-b1-falsos-amigos` | Falsos amigos | `Spanish`/`French` | 60 | Words a French speaker will guess wrong: *embarazada*, *largo*, *constipado*, *salir* |

---

## Spanish B2 — 20 lists, 2000 words

Complex text on concrete and abstract topics, the press, sustained argument.

| id | name | n | content |
|---|---|---|---|
| `es-b2-actualidad-prensa` | La actualidad y la prensa | 100 | News, headlines, reporting, the press and broadcast media |
| `es-b2-politica-instituciones` | La política y las instituciones | 100 | Government, parliament, elections, parties, the Spanish and Latin American state |
| `es-b2-economia-trabajo` | La economía y el trabajo | 100 | Economy, business, markets, employment, unions, unemployment |
| `es-b2-justicia-delito` | La justicia y el delito | 100 | Law, courts, crime, trial, sentencing, the police |
| `es-b2-medio-ambiente` | El medio ambiente | 100 | Climate, pollution, energy, biodiversity, conservation, waste |
| `es-b2-ciencia-tecnologia` | La ciencia y la tecnología | 100 | Research, experiment, physics and biology basics, computing, innovation |
| `es-b2-medicina-salud-publica` | La medicina y la salud pública | 100 | Disease, treatment, hospitals, epidemics, the health system |
| `es-b2-educacion` | La educación | 100 | Education systems, teaching, pedagogy, qualifications, reform debates |
| `es-b2-historia-geografia` | La historia y la geografía | 100 | Periods, war, empire, revolution, relief and regions, Spanish and Latin American history |
| `es-b2-sociedad-inmigracion` | La sociedad y la inmigración | 100 | Demography, migration, inequality, urban and rural, social change |
| `es-b2-religion-creencias` | La religión y las creencias | 100 | Religion, ritual, belief and unbelief, myth, the sacred |
| `es-b2-arte-literatura` | El arte y la literatura | 100 | Genres, movements, painting and sculpture, criticism, the writer's craft |
| `es-b2-cine-musica-espectaculo` | El cine, la música y el espectáculo | 100 | Cinema, music, theatre, television, performance, reviewing |
| `es-b2-sentimientos-psicologia` | Los sentimientos y la psicología | 100 | Nuanced emotion, mental life, motivation, psychological vocabulary |
| `es-b2-juicio-moral-caracter` | El juicio moral y el carácter | 100 | Virtues and vices, moral judgement, precise adjectives for people |
| `es-b2-argumentacion-opinion` | La argumentación y la opinión | 100 | Asserting, conceding, refuting, qualifying, the machinery of an essay |
| `es-b2-verbos-avanzados` | Verbos de nivel avanzado | 100 | Verbs beyond the everyday: *acatar*, *desglosar*, *soslayar*, *entrañar* |
| `es-b2-adjetivos-matices` | Adjetivos y matices | 100 | Precise adjectives where B1 would reach for *bueno* or *importante* |
| `es-b2-modismos-frases-hechas` | Modismos y frases hechas | 100 | Idioms and fixed phrases, with the situation each belongs to |
| `es-b2-coloquial-jerga` | Registro coloquial y jerga | 100 | Spoken register, colloquialisms, common slang, what not to write |

**Extra (grammar)**

| id | name | labels / dir | n | content |
|---|---|---|---|---|
| `es-b2-subjuntivo-disparadores` | El subjuntivo: disparadores | `Français`/`Español`, `fr`→`es` | 60 | The expressions that force the subjunctive, one sentence each |
| `es-b2-perifrasis-verbales` | Perífrasis verbales | `Français`/`Español`, `fr`→`es` | 60 | *ir a*, *acabar de*, *ponerse a*, *llevar* + gerund, *volver a*, *dejar de* |
| `es-b2-regimen-preposicional` | Régimen preposicional | `Spanish`/`French` | 60 | Verbs and adjectives with the preposition they take, given as a phrase |

---

## English B1 — 20 lists, 2000 words

The same everyday spine as Spanish B1, so the two languages stay comparable
and a topic can be revised in both at once.

| id | name | n | content |
|---|---|---|---|
| `en-b1-people-family` | People and Family | 100 | Identity, family ties, life stages, civil status, describing who someone is |
| `en-b1-body-health` | The Body and Health | 100 | Body parts, symptoms, illness, the doctor, the chemist, staying well |
| `en-b1-house-housework` | The House and Housework | 100 | Housing, rooms, furniture, household objects, chores, repairs |
| `en-b1-food-cooking` | Food and Cooking | 100 | Ingredients, meals, cooking verbs, tastes, the restaurant, ordering |
| `en-b1-town-transport` | Town and Transport | 100 | Town places, public transport, driving, directions, everyday services |
| `en-b1-shopping-money` | Shopping and Money | 100 | Shops, prices, paying, returning, everyday banking |
| `en-b1-work-jobs` | Work and Jobs | 100 | Trades and professions, the workplace, contracts, looking for work |
| `en-b1-school-studies` | School and Studies | 100 | School and university, subjects, exams, marks, student life |
| `en-b1-free-time-sport` | Free Time and Sport | 100 | Hobbies, sports, games, going out, leisure |
| `en-b1-travel-holidays` | Travel and Holidays | 100 | Travel, the airport and station, hotels, tourism, booking and complaining |
| `en-b1-nature-animals` | Nature and Animals | 100 | Landscape, weather, trees and plants, domestic and wild animals |
| `en-b1-time-calendar` | Time and the Calendar | 100 | Clock time, dates, frequency, seasons, festivals, duration |
| `en-b1-character-feelings` | Character and Feelings | 100 | Personality adjectives, moods, feelings, reactions |
| `en-b1-appearance-clothes` | Appearance and Clothes | 100 | Appearance, height and build, hair and face, clothing, accessories |
| `en-b1-friends-relationships` | Friends and Relationships | 100 | Friendship, love, invitations, politeness formulas, social occasions |
| `en-b1-phones-internet-media` | Phones, Internet and Media | 100 | Phone, post, internet, computers, basic media vocabulary |
| `en-b1-common-verbs-1` | Common Verbs 1 | 100 | The hundred commonest verbs, with the sense a B1 learner needs first |
| `en-b1-common-verbs-2` | Common Verbs 2 | 100 | The next hundred |
| `en-b1-linking-words` | Linking Words and Adverbs | 100 | Connectors, quantifiers, adverbs of manner and degree, discourse markers |
| `en-b1-everyday-expressions` | Everyday Expressions | 100 | High-frequency set phrases: *to feel like*, *it's worth*, *I'd rather*, *never mind* |

**Extra (grammar)**

| id | name | labels / dir | n | content |
|---|---|---|---|---|
| `en-b1-irregular-verbs` | Irregular Verbs | `French`/`English`, `fr`→`en` | 180 | French infinitive on the front, the three English forms on the back, the `verbes-irreguliers` shape |
| `en-b1-phrasal-verbs-1` | Phrasal Verbs 1 | `English`/`French` | 80 | The commonest phrasal verbs, one clear sense each |
| `en-b1-prepositions` | Prepositions after Verbs and Adjectives | `English`/`French` | 70 | *depend on*, *good at*, *afraid of*, given as a phrase, not a rule |
| `en-b1-false-friends` | False Friends | `English`/`French` | 70 | *actually*, *eventually*, *library*, *sensible*, *to attend* |

---

## English B2 — 20 lists, 2000 words

| id | name | n | content |
|---|---|---|---|
| `en-b2-news-press` | News and the Press | 100 | News, headlines, reporting, the press and broadcast media |
| `en-b2-politics-institutions` | Politics and Institutions | 100 | Government, parliament, elections, parties, the British and American state |
| `en-b2-economy-business` | Economy and Business | 100 | Economy, business, markets, trade, finance basics |
| `en-b2-work-employment` | Work and Employment | 100 | Employment, careers, unions, unemployment, workplace conflict |
| `en-b2-law-crime` | Law and Crime | 100 | Law, courts, crime, trial, sentencing, the police |
| `en-b2-environment-climate` | Environment and Climate | 100 | Climate, pollution, energy, biodiversity, conservation, waste |
| `en-b2-science-technology` | Science and Technology | 100 | Research, experiment, physics and biology basics, computing, innovation |
| `en-b2-medicine-health` | Medicine and Health | 100 | Disease, treatment, hospitals, epidemics, the health system |
| `en-b2-education` | Education | 100 | Education systems, teaching, pedagogy, qualifications, reform debates |
| `en-b2-history-geography` | History and Geography | 100 | Periods, war, empire, revolution, relief and regions |
| `en-b2-society-migration` | Society and Migration | 100 | Demography, migration, inequality, urban and rural, social change |
| `en-b2-religion-belief` | Religion and Belief | 100 | Religion, ritual, belief and unbelief, myth, the sacred |
| `en-b2-art-literature` | Art and Literature | 100 | Genres, movements, painting and sculpture, criticism, the writer's craft |
| `en-b2-cinema-music-entertainment` | Cinema, Music and Entertainment | 100 | Cinema, music, theatre, television, performance, reviewing |
| `en-b2-feelings-psychology` | Feelings and Psychology | 100 | Nuanced emotion, mental life, motivation, psychological vocabulary |
| `en-b2-character-judgement` | Character and Judgement | 100 | Virtues and vices, moral judgement, precise adjectives for people |
| `en-b2-argument-opinion` | Argument and Opinion | 100 | Asserting, conceding, refuting, qualifying, the machinery of an essay |
| `en-b2-advanced-verbs` | Advanced Verbs | 100 | Verbs beyond the everyday: *to undermine*, *to curb*, *to entail*, *to waive* |
| `en-b2-precise-adjectives` | Precise Adjectives | 100 | Adjectives where B1 would reach for *good*, *bad* or *important* |
| `en-b2-idioms-fixed-phrases` | Idioms and Fixed Phrases | 100 | Idioms and fixed phrases, with the situation each belongs to |

**Extra (grammar)**

| id | name | labels / dir | n | content |
|---|---|---|---|---|
| `en-b2-phrasal-verbs-2` | Phrasal Verbs 2 | `English`/`French` | 80 | Less common phrasal verbs, and second senses of the common ones |
| `en-b2-collocations` | Make, Do, Take, Get: Collocations | `English`/`French` | 80 | The fixed partners of the four verbs that carry most of English |
| `en-b2-confusable-words` | Confusable Words | `English`/`French` | 70 | *affect/effect*, *lie/lay*, *economic/economical*, *historic/historical* |

---

## English C1 — 40 lists, 4000 words

The most important folder. Topic-organised, and each topic split into two
levels:

- **1** — the register of a well-written broadsheet article. Advanced, but
  current and in daily use.
- **2** — the register of an educated native reading a serious book on the
  subject: lower-frequency, Latinate, literary, technical, densely idiomatic.

### Paired topics (14 topics, 28 lists)

| id | name | n | content |
|---|---|---|---|
| `en-c1-politics-1` | Politics and Power 1 | 100 | Legislation, coalitions, mandates, lobbying, the vocabulary of a political leader |
| `en-c1-politics-2` | Politics and Power 2 | 100 | Political theory and invective: *hegemony*, *demagogue*, *realpolitik*, *plebiscite*, *irredentism* |
| `en-c1-economy-1` | Economy and Finance 1 | 100 | Inflation, fiscal and monetary policy, markets, growth, the business pages |
| `en-c1-economy-2` | Economy and Finance 2 | 100 | Technical economics and finance: *arbitrage*, *fungible*, *rentier*, *countercyclical*, *seigniorage* |
| `en-c1-law-1` | Law and Justice 1 | 100 | Courts, procedure, verdicts, rights, the vocabulary of a legal news report |
| `en-c1-law-2` | Law and Justice 2 | 100 | Legal English proper: *tort*, *estoppel*, *prima facie*, *jurisprudence*, *mens rea* |
| `en-c1-science-1` | Science and Research 1 | 100 | Method, evidence, peer review, hypothesis, the science section |
| `en-c1-science-2` | Science and Research 2 | 100 | Terms crossing from the disciplines into serious prose: *stochastic*, *emergent*, *isotope*, *entropy* |
| `en-c1-medicine-1` | Medicine and the Body 1 | 100 | Diagnosis, treatment, public health, the health desk |
| `en-c1-medicine-2` | Medicine and the Body 2 | 100 | Clinical and anatomical vocabulary: *iatrogenic*, *idiopathic*, *palliative*, *comorbidity* |
| `en-c1-environment-1` | Environment and Climate 1 | 100 | Emissions, mitigation, habitats, energy transition, the environment desk |
| `en-c1-environment-2` | Environment and Climate 2 | 100 | Ecology and earth science: *anthropogenic*, *eutrophication*, *albedo*, *sequestration* |
| `en-c1-history-1` | History and War 1 | 100 | Periods, treaties, campaigns, empire, the vocabulary of a history article |
| `en-c1-history-2` | History and War 2 | 100 | Historiography and the specialist term: *interregnum*, *suzerainty*, *attainder*, *casus belli* |
| `en-c1-literature-1` | Literature and Criticism 1 | 100 | Genre, plot, character, style, the book review |
| `en-c1-literature-2` | Literature and Criticism 2 | 100 | Critical apparatus: *bildungsroman*, *free indirect style*, *prosody*, *palimpsest*, *bathos* |
| `en-c1-idioms-1` | Idioms and Figurative Language 1 | 100 | Idioms an educated speaker uses without thinking, and what they mean |
| `en-c1-idioms-2` | Idioms and Figurative Language 2 | 100 | Literary and less common idiom, dead metaphors revived, extended figures |
| `en-c1-business-1` | Business and Work 1 | 100 | Strategy, management, negotiation, corporate life |
| `en-c1-business-2` | Business and Work 2 | 100 | The specialist and the satirical: *fiduciary*, *indemnity*, *synergy*, the language of the consultant |
| `en-c1-society-1` | Society, Class and Identity 1 | 100 | Class, inequality, demography, identity, the comment pages |
| `en-c1-society-2` | Society, Class and Identity 2 | 100 | Sociological vocabulary: *anomie*, *habitus*, *precariat*, *acculturation*, *bourgeois* |
| `en-c1-philosophy-1` | Philosophy, Ethics and Ideas 1 | 100 | Argument, principle, value, the vocabulary of a serious essay |
| `en-c1-philosophy-2` | Philosophy, Ethics and Ideas 2 | 100 | Technical philosophy: *a priori*, *teleology*, *epistemic*, *reification*, *supervenience* |
| `en-c1-rhetoric-1` | Rhetoric, Argument and Register 1 | 100 | Conceding, qualifying, refuting, the connective tissue of a long argument |
| `en-c1-rhetoric-2` | Rhetoric, Argument and Register 2 | 100 | Named figures and modes: *litotes*, *anaphora*, *apophasis*, *tendentious*, *sophistry* |
| `en-c1-character-1` | Character and Human Judgement 1 | 100 | Precise adjectives for people and conduct, praise and blame |
| `en-c1-character-2` | Character and Human Judgement 2 | 100 | The literary register: *pusillanimous*, *obsequious*, *magnanimous*, *saturnine*, *mendacious* |

### Single topics (12 lists)

| id | name | n | content |
|---|---|---|---|
| `en-c1-religion` | Religion and the Sacred | 100 | Doctrine, liturgy, schism, the vocabulary of belief and of writing about it |
| `en-c1-art-architecture` | Art and Architecture | 100 | Movements, technique, the built environment, the exhibition review |
| `en-c1-music-performance` | Music and Performance | 100 | Form, instrument, performance, the concert and theatre review |
| `en-c1-cinema-media` | Cinema, Television and Media Criticism | 100 | Film craft, broadcasting, and the language critics use about both |
| `en-c1-sport` | Sport and Competition | 100 | The sports pages, including the figurative use of sport in other writing |
| `en-c1-technology-data` | Technology, Data and the Internet | 100 | Computing, networks, data, algorithms, platform and privacy debates |
| `en-c1-food-senses` | Food, Drink and the Senses | 100 | Cooking, wine, taste and smell, the vocabulary of describing sensation |
| `en-c1-nature-landscape` | Nature, Landscape and Weather | 100 | Terrain, flora and fauna, weather, the literary description of place |
| `en-c1-psychology` | Psychology and Mental Life | 100 | Cognition, motivation, disorder, the vocabulary of the inner life |
| `en-c1-education-academy` | Education and the Academy | 100 | Universities, scholarship, curricula, the vocabulary of academic life |
| `en-c1-diplomacy` | Diplomacy and International Affairs | 100 | Treaties, sanctions, sovereignty, alliance, the foreign desk |
| `en-c1-journalism` | Journalism: Headlines, Hedging and House Style | 100 | Headline compression (*mulls*, *slams*, *bid*, *row*, *probe*) and the hedging of attribution (*reportedly*, *is said to*, *alleged*) — the furniture of news prose that never appears in a topic list |

**Extra**

| id | name | labels / dir | n | content |
|---|---|---|---|---|
| `en-c1-roots` | Latin and Greek Roots | `English`/`French` | 80 | The roots that unlock whole families of words, each with three examples |
| `en-c1-foreign-phrases` | Foreign Phrases in English | `English`/`French` | 80 | *sine qua non*, *tour de force*, *schadenfreude*, *ad hoc*, *bête noire* |
| `en-c1-allusions` | Proverbs and Allusions | `English`/`French` | 80 | Biblical, Shakespearean and classical references an educated speaker is assumed to catch |
| `en-c1-advanced-false-friends` | Advanced False Friends | `English`/`French` | 80 | *prevaricate*, *ostensibly*, *to demand*, *inconvenient*, *disposed* |

---

## English C2 — 20 lists, 2000 words

Monolingual. Front is the word or expression, back is its definition in
English, with a short usage example where the definition alone will not fix
it. Because the app drills both directions, `b2f` shows the definition and
asks for the word — the harder direction, and the one that builds active
literary vocabulary.

Organised by *kind of difficulty* rather than by topic: English C1 has already
covered the topics.

| id | name | n | content |
|---|---|---|---|
| `en-c2-rare-literary-1` | Rare and Literary Words 1 | 100 | Words met in good prose and rarely elsewhere: *lambent*, *susurrus*, *crepuscular* |
| `en-c2-rare-literary-2` | Rare and Literary Words 2 | 100 | Further out, still current in literature |
| `en-c2-precise-word` | The Precise Word | 100 | Near-synonyms told apart: *imply/infer*, *refute/rebut*, *fulsome*, *enormity*, *disinterested* |
| `en-c2-character-vice` | Words of Character and Vice | 100 | *pusillanimous*, *mendacious*, *obsequious*, *magnanimous*, *venal* |
| `en-c2-shades-of-feeling` | Shades of Feeling | 100 | Fine-grained emotion: *wistful*, *rueful*, *saturnine*, *ebullient*, *querulous* |
| `en-c2-archaic-poetic` | Archaic and Poetic English | 100 | Alive only in literature: *erstwhile*, *whilom*, *betimes*, *anon*, *fain* |
| `en-c2-figures-of-speech` | Figures of Speech and Rhetoric | 100 | *litotes*, *zeugma*, *anaphora*, *chiasmus*, *metonymy*, each with an example |
| `en-c2-literary-form` | Literary Criticism and Form | 100 | *bildungsroman*, *free indirect style*, *caesura*, *picaresque*, *sprung rhythm* |
| `en-c2-idioms-origins` | Idioms with Obscure Origins | 100 | *hoist with one's own petard*, *beyond the pale*, *at loggerheads* — meaning and where it came from |
| `en-c2-proverbs` | Proverbs and Sayings | 100 | Full forms, meanings, and the situation each is used in |
| `en-c2-allusions` | Allusions: Classical and Biblical | 100 | *Sisyphean*, *Pyrrhic*, *shibboleth*, *jeremiad*, *Damoclean* |
| `en-c2-latinate-legal` | Latinate and Legal English | 100 | *habeas corpus*, *tort*, *estoppel*, *prima facie*, *ultra vires* |
| `en-c2-scientific-general` | Scientific Terms in General Use | 100 | Words borrowed from science by general prose: *entropy*, *symbiosis*, *vestigial*, *catalyst* |
| `en-c2-words-about-words` | Words about Words | 100 | *philology*, *solecism*, *malapropism*, *neologism*, *catachresis* |
| `en-c2-verbs-precision` | Verbs of Precision | 100 | *to inveigh*, *to descry*, *to inure*, *to vitiate*, *to abrogate* |
| `en-c2-adjectives-precision` | Adjectives of Precision | 100 | *recondite*, *otiose*, *invidious*, *meretricious*, *parlous* |
| `en-c2-abstract-nouns` | Nouns of the Abstract | 100 | *hauteur*, *insouciance*, *opprobrium*, *alacrity*, *sangfroid* |
| `en-c2-register` | Register: Formal, Colloquial, Vulgar | 100 | The same idea across three registers, so the right one can be chosen |
| `en-c2-old-trades-objects` | Old Trades, Objects and Institutions | 100 | The furniture of the nineteenth-century novel: *hansom*, *scullery*, *curate*, *ostler* |
| `en-c2-confusable-native` | Confusable Pairs for Native Speakers | 100 | *militate/mitigate*, *flout/flaunt*, *discreet/discrete*, *hone/home*, *forego/forgo* |

---

## French C2 — 20 lists, 2000 words, plus 1 extra

Monolingual, same shape as English C2: `Mot` on the front, `Définition` on the
back, with an example where needed. The same twenty axes, chosen for French.

| id | name | n | content |
|---|---|---|---|
| `fr-c2-mots-rares-1` | Mots rares et littéraires 1 | 100 | *chatoyant*, *diaphane*, *obombrer*, *vespéral* |
| `fr-c2-mots-rares-2` | Mots rares et littéraires 2 | 100 | Further out, still met in literature |
| `fr-c2-mot-juste` | Le mot juste | 100 | *achalandé*, *décimer*, *pallier*, *éponyme*, *acception* — the words most often misused |
| `fr-c2-caractere-vices` | Le caractère et les vices | 100 | *pusillanime*, *matois*, *madré*, *cauteleux*, *magnanime* |
| `fr-c2-nuances-sentiment` | Les nuances du sentiment | 100 | *spleen*, *aigreur*, *mansuétude*, *allégresse*, *dépit* |
| `fr-c2-classique-archaismes` | Français classique et archaïsmes | 100 | The language of Racine and Molière still met in books: *céans*, *naguère*, *courroux* |
| `fr-c2-figures-de-style` | Figures de style et rhétorique | 100 | *litote*, *zeugme*, *hypallage*, *prétérition*, *anacoluthe*, each with an example |
| `fr-c2-critique-versification` | Critique littéraire et versification | 100 | *alexandrin*, *hémistiche*, *diérèse*, *blason*, *apologue* |
| `fr-c2-expressions-imagees` | Expressions imagées et leur origine | 100 | *tirer les marrons du feu*, *un travail de Romain*, *à la Saint-Glinglin* |
| `fr-c2-proverbes-locutions` | Proverbes et locutions | 100 | Full forms, meanings, and when each is used |
| `fr-c2-references-classiques` | Références classiques et bibliques | 100 | *un travail d'Hercule*, *l'épée de Damoclès*, *un veau d'or*, *la pomme de discorde* |
| `fr-c2-juridique-administratif` | Le vocabulaire juridique et administratif | 100 | *nonobstant*, *préjudice*, *ester en justice*, *forclusion*, *idoine* |
| `fr-c2-termes-scientifiques` | Termes scientifiques passés dans la langue | 100 | *entropie*, *symbiose*, *catalyseur*, *épistémologie*, *paradigme* |
| `fr-c2-mots-sur-les-mots` | Les mots pour parler des mots | 100 | *solécisme*, *barbarisme*, *néologisme*, *paronyme*, *hapax* |
| `fr-c2-verbes-precision` | Verbes de précision | 100 | *pérorer*, *atermoyer*, *obvier*, *échoir*, *gauchir* |
| `fr-c2-adjectifs-precision` | Adjectifs de précision | 100 | *spécieux*, *insigne*, *prégnant*, *délétère*, *roboratif* |
| `fr-c2-substantifs-abstraits` | Substantifs abstraits | 100 | *mansuétude*, *outrecuidance*, *déréliction*, *aménité*, *forfaiture* |
| `fr-c2-registres` | Registres : soutenu, familier, argotique | 100 | The same idea across three registers, so the right one can be chosen |
| `fr-c2-metiers-objets-autrefois` | Métiers, objets et institutions d'autrefois | 100 | The furniture of Balzac and Zola: *fiacre*, *office*, *tabellion*, *palefrenier* |
| `fr-c2-pieges-confusions` | Pièges et confusions | 100 | *pallier/remédier*, *alternative*, *second/deuxième*, *acception/acceptation* |

**Extra**

| id | name | n | content |
|---|---|---|---|
| `fr-c2-locutions-latines` | Locutions latines et étrangères | 80 | *sine die*, *mutatis mutandis*, *ex abrupto*, *in fine*, *grosso modo* — the English side is covered by `en-c1-foreign-phrases` |

---

## Totals

| Folder | Lists | Cards |
|---|---|---|
| Spanish B1 | 20 + 4 extra | 2000 + 230 |
| Spanish B2 | 20 + 3 extra | 2000 + 180 |
| English B1 | 20 + 4 extra | 2000 + 400 |
| English B2 | 20 + 3 extra | 2000 + 250 |
| English C1 | 40 + 4 extra | 4000 + 320 |
| English C2 | 20 | 2000 |
| French C2 | 20 + 1 extra | 2000 + 80 |
| **Total** | **179** | **~17 460** |

## Generating

One folder at a time, and within a folder one list at a time: a list is a
single `data/lists/<id>.json` on the `data` branch, in the shape of the
existing files, with a fresh six-character id per card. Nothing in
`data/progress/` is written. The order below puts the most important folder
first, but any folder can be done on its own.

1. English C1 — the folder that matters most
2. English B2, English B1
3. English C2
4. Spanish B1, Spanish B2
5. French C2
