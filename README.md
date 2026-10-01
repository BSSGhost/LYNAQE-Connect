# LYNAQE Connect

> « Votre voix, notre lycée de demain. »

Plateforme web de dépôt et de suivi des idées d’amélioration des élèves pour le **LYNAQE de Sédhiou** (Sénégal).
Les élèves proposent des idées, l’établissement les examine, les membres de la communauté les soutiennent,
et chacun peut suivre l’avancement de sa propre suggestion.

- **Auteur** : Créé par **Ahmadou Bamba Bousso SANKHARÉ**, un développeur volontaire.
- **Interface** : français, sans build ni framework côté client (HTML/CSS/JS natifs, modules ES).
- **Licence** : projet scolaire / communautaire, utilisation et adaptation libres.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Stack technique](#stack-technique)
3. [Prérequis](#prérequis)
4. [Installation](#installation)
5. [Variables d’environnement](#variables-denvironnement)
6. [Scripts disponibles](#scripts-disponibles)
7. [Routes de l’interface](#routes-de-linterface)
8. [API REST](#api-rest)
9. [Données : statuts et catégories](#données--statuts-et-catégories)
10. [Tests](#tests)
11. [Structure du projet](#structure-du-projet)
12. [Sécurité](#sécurité)
13. [Accessibilité et design](#accessibilité-et-design)

---

## Fonctionnalités

### Côté public

- **Accueil** : présentation, chiffres clés, dernières suggestions, état vide accompagné d’un appel à l’action.
- **Proposer une idée** : formulaire complet (titre, catégorie, description, lieu, informations complémentaires),
  option d’envoi anonyme, compteur de caractères, validation côté client **et** côté serveur,
  puis écran de confirmation affichant le **numéro de suivi** et le **code secret** (affichés une seule fois).
- **Suggestions** : liste paginée, filtres par catégorie et statut, tri, état vide explicite.
- **Détail d’une suggestion** : description, progression, historique de modération, bouton de soutien
  (un soutien par appareil, le serveur faisant autorité), partage du lien.
- **Suivre ma suggestion** : accès réservé à l’auteur via son numéro de suivi **et** son code secret ;
  affiche statut, visibilité, progression et historique.
- **Pages de contenu** : « Comment ça marche », « À propos », « Règles de participation », « Confidentialité ».
- **Recherche et accessibilité** : navigation complète, liens d’évitement, thèmes clair/sombre, responsive.

### Côté administration (mot de passe unique, sans compte)

- **Connexion** par mot de passe, session par jeton signé, expiration automatique.
- **Liste des suggestions** : recherche, filtres (catégorie, statut, visibilité), tri, pagination,
  modification rapide du statut, bascule de visibilité, suppression.
- **Détail administrateur** : édition complète (titre, description, catégorie, statut, lieu, auteur, informations complémentaires),
  note interne de modération, historique et journal des actions.
- **Statistiques** : totaux par statut et par catégorie, taux de publication, répartitions, graphiques.
- **Journal d’audit** : actions de modération filtrables et paginées.

---

## Stack technique

| Couche | Choix |
| --- | --- |
| Frontend | HTML5, CSS3 (variables CSS, themes clair/sombre), JavaScript ES2022 en modules natifs, **aucun build** |
| Backend | Node.js + Express, architecture par modules |
| Base de données | MySQL 8 (InnoDB, `utf8mb4`) |
| Authentification | Jeton de session signé (HMAC), mot de passe stocké en scrypt |
| Sécurité | CSP stricte sans script inline, Helmet, limitation de débit, validation et requêtes préparées |

---

## Prérequis

- **Node.js 18+** (testé sur Node 20/22).
- **MySQL 8.0+** — sur la machine de développement, MySQL est **déjà installé** (service `MySQL80`) :
  ne pas l’installer une seconde fois. Client éventuellement hors `PATH` :
  `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`.
- Un navigateur moderne (Chrome, Edge, Firefox, Safari récents).

---

## Installation

```bash
# 1. Configuration
copy .env.example .env        # Windows (ou : cp .env.example .env)

# 2. Dépendances
cd backend
npm install
cd ..

# 3. Base de données
cd backend
npm run migrate               # crée la base si besoin et applique les 4 migrations
npm run check                 # vérifie la connexion et l'état du schéma
cd ..
```

### Générer le mot de passe administrateur

Le mot de passe n’est **jamais** stocké en clair : on n’en conserve qu’un hash scrypt.

```bash
cd backend
npm run hash-password -- "votre mot de passe ici"
```

Copiez le hash obtenu dans `.env` :

```dotenv
ADMIN_PASSWORD=            # laissé vide : utilisé une seule fois au démarrage
ADMIN_PASSWORD_HASH=hash_scrypt_renseigné_ici
```

Si vous préférez saisir le mot de passe à chaque démarrage, renseignez `ADMIN_PASSWORD` et laissez
`ADMIN_PASSWORD_HASH` vide : le serveur dérive et affiche le hash au premier lancement.

### Générer le secret de session

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Placez le résultat dans `JWT_SECRET`.

### Démarrage

```bash
cd backend
npm run dev     # développement, rechargement automatique (node --watch)
npm start       # production
```

Ouvrez ensuite <http://localhost:3000>. Le backend sert l’API **et** le frontend ; aucun second serveur n’est nécessaire.

---

## Variables d’environnement

Le fichier `.env` est à la racine du projet, **ignoré par Git**. `.env.example` documente toutes les variables.

| Variable | Rôle |
| --- | --- |
| `NODE_ENV`, `PORT`, `HOST`, `APP_URL` | Serveur d’écoute |
| `CORS_ORIGINS` | Origines autorisées, séparées par des virgules |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Connexion MySQL (serveur uniquement) |
| `DB_CREATE_IF_MISSING`, `DB_CONNECTION_LIMIT`, `DB_SSL` | Options de connexion |
| `ADMIN_PASSWORD`, `ADMIN_PASSWORD_HASH` | Accès administration (serveur uniquement) |
| `ADMIN_SESSION_TTL`, `JWT_SECRET`, `JWT_ISSUER` | Sessions administrateur |
| `RATE_LIMIT_*` | Limitation de débit par famille de routes |
| `LOG_LEVEL` | Niveau de journalisation serveur |

> `.env` contient des secrets : il ne doit **jamais** être commité, partagé ou copié dans le frontend.
> `.env.example` ne contient que des valeurs vides ou neutres.

---

## Scripts disponibles

Depuis `backend/` :

| Script | Rôle |
| --- | --- |
| `npm start` | Démarre le serveur |
| `npm run dev` | Démarre avec rechargement automatique |
| `npm run migrate` | Applique les migrations (crée la base si absent) |
| `npm run migrate:status` | Affiche l’état des migrations |
| `npm run db:reset` | Réinitialise le schéma (destructif) |
| `npm run check` | Vérifie connexion et schéma |
| `npm run hash-password` | Génère un hash scrypt pour l’administration |
| `npm test` | Lance toute la suite de tests |

---

## Routes de l’interface

SPA à base de hash, servie par le backend (repli sur `index.html`).

| Route | Page |
| --- | --- |
| `#/` | Accueil |
| `#/proposer` | Déposer une idée |
| `#/suggestions` | Liste des suggestions |
| `#/suggestions/:id` | Détail d’une suggestion |
| `#/suivre` | Suivre ma suggestion |
| `#/comment-ca-marche` | Comment ça marche |
| `#/a-propos` | À propos |
| `#/regles` | Règles de participation |
| `#/confidentialite` | Confidentialité |
| `#/admin` | Connexion administration |
| `#/admin/suggestions` | Liste administrateur |
| `#/admin/suggestions/:id` | Détail administrateur |
| `#/admin/statistiques` | Statistiques |
| `#/admin/journal` | Journal d’audit |
| route inconnue | Page 404 |

---

## API REST

Format uniforme : `{ "success": true, "data": …, "meta": { page, limit, total, totalPages } }`
ou `{ "success": false, "error": { code, message, details? } }`.

### Public

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | État du service |
| `GET` | `/api/meta` | Statuts, catégories, limites, messages du projet |
| `GET` | `/api/suggestions` | Liste paginée et filtrable des suggestions publiques |
| `GET` | `/api/suggestions/:id` | Détail d’une suggestion publique |
| `POST` | `/api/suggestions` | Dépôt d’une suggestion (retourne numéro de suivi et code secret) |
| `POST` | `/api/suggestions/:id/support` | Soutien (un par appareil) |
| `POST` | `/api/tracking` | Suivi par numéro de suivi + code secret |

### Administration (en-tête `Authorization: Bearer <jeton>`)

| Méthode | Route | Description |
| --- | --- | --- |
| `POST` | `/api/admin/login` | Connexion par mot de passe |
| `GET` | `/api/admin/session` | Vérifie la session |
| `POST` | `/api/admin/logout` | Révoque la session |
| `GET` | `/api/admin/statistics` | Statistiques globales |
| `GET` | `/api/admin/suggestions` | Liste administrateur (tous statuts, tous Auteur) |
| `GET` | `/api/admin/suggestions/:id` | Détail administrateur |
| `PATCH` | `/api/admin/suggestions/:id` | Édition |
| `PATCH` | `/api/admin/suggestions/:id/status` | Changement de statut |
| `PATCH` | `/api/admin/suggestions/:id/moderation` | Note interne et visibilité |
| `GET` | `/api/admin/suggestions/:id/logs` | Historique d’une suggestion |
| `DELETE` | `/api/admin/suggestions/:id` | Suppression |
| `GET` | `/api/admin/logs` | Journal d’audit filtrable |

---

## Données : statuts et catégories

**Statuts** : `En attente`, `Reçue`, `À l’étude`, `En cours`, `Réalisée`, `Non retenue`, `Archivée`.

**Catégories** : Vie scolaire ; Infrastructures et matériel ; Propreté et hygiène ;
Restauration et cadre de vie ; Activités culturelles et sportives ; Enseignement et apprentissage ;
Environnement ; Autres.

Ces listes, les libellés, les limites de saisie et les messages du projet sont définis **une seule fois**
dans `shared/constants.js`, chargé par le backend et servi au frontend sur `/shared/constants.js` :
le client et le serveur ne peuvent pas diverger.

Migrations : `database/migrations/001…004` (suggestions, historique, soutiens, journal de modération).
Aucune donnée fictive n’est insérée en production.

---

## Tests

```bash
cd backend
npm test
```

- **68 tests** au total : 26 tests unitaires (validation, formatage, règles métier) et 42 tests d’intégration
  (API complète : dépôt, liste, détail, soutien, suivi, authentification, administration, statistiques, journal).
- Les tests utilisent la base `lynaqe_connect_test`, créée puis remise à zéro automatiquement ;
  **la base de production n’est jamais touchée**.
- Vérifications complémentaires possibles : `npm run check` (schéma) et `npm run migrate:status`.

---

## Structure du projet

```text
LYNAQE Connect/
├── .env.example              # modèle de configuration (sans secret)
├── README.md
├── shared/
│   └── constants.js          # source de vérité partagée (statuts, catégories, limites, messages)
├── database/
│   ├── migrations/           # 4 migrations SQL versionnées
│   └── seeds/                # reserved (aucune donnée de production)
├── frontend/
│   ├── index.html            # coquille SPA
│   └── assets/
│       ├── css/              # base, thème, composants, pages
│       ├── img/              # favicon
│       └── js/
│           ├── theme-boot.js # thème appliqué avant peinture (aucun script inline)
│           ├── app.js        # routes et amorçage
│           ├── core/         # dom, router, api, store, icons, ui, validation, format
│           ├── components/   # header, footer, layout, suggestions, pagination, charts, support
│           └── pages/        # pages publiques + pages/admin/
└── backend/
    ├── package.json
    ├── scripts/hash-password.js
    ├── src/
    │   ├── app.js            # middlewares, API, statique, repli SPA
    │   ├── server.js         # démarrage et vérification MySQL
    │   ├── config/  db/  http/  middleware/  utils/  validation/
    │   └── modules/          # suggestions, tracking, admin, statistics, meta
    └── tests/                # unitaires + intégration
```

---

## Sécurité

- **CSP stricte** : aucun script inline ; le thème est appliqué par `theme-boot.js` avant la première peinture.
- **Mots de passe** : hash **scrypt** avec sel aléatoire ; jamais de clair en base, jamais dans le frontend.
- **Sessions** : jeton signé (HMAC), durée de vie configurable, révocation à la déconnexion,
  transmis uniquement via `Authorization: Bearer`.
- **Données personnelles** : les suggestions anonymes ne stockent ni nom ni contact ;
  le suivi exige le couple numéro de suivi + code secret, le message d’erreur étant volontairement identique
  dans tous les cas d’échec (pas de fuite d’information).
- **SQL injection** : requêtes exclusivement préparées.
- **XSS** : échappement systématique des données dans le DOM, aucune insertion de HTML brut provenant de l’API.
- **Limitation de débit** par famille de routes, notamment sur le dépôt, le suivi et la connexion.
- **Secrets** : `.env` ignoré par Git ; ne jamais commiter de mot de passe, de hash ou de jeton.

---

## Accessibilité et design

- Thèmes **clair et sombre** (bascule mémorisée, respect de `prefers-color-scheme`, appliqué avant peinture).
- Palette : `#123B6D` (bleu lycée), `#38BDF8` (accent), `#F8FAFC` (fond clair), `#D4AF37` (or).
- Responsive mobile-first, mise en page fluide, formulaires adaptés au tactile.
- Lien d’évitement, repères ARIA, libellés associés, focus visible, contrastes conformes,
  icônes décoratives masquées aux lecteurs d’écran, animations désactivées si `prefers-reduced-motion`.
