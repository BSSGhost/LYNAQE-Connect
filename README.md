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
  ajout facultatif de cinq photos privées maximum, puis écran de confirmation affichant le
  **numéro de suivi** et le **code secret** (affichés une seule fois).
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
  photos jointes visibles uniquement par l’administration, note interne de modération, historique et journal des actions.
- **Statistiques** : totaux par statut et par catégorie, taux de publication, répartitions, graphiques.
- **Journal d’audit** : actions de modération filtrables et paginées.

---

## Stack technique

| Couche | Choix |
| --- | --- |
| Frontend | HTML5, CSS3 (variables CSS, themes clair/sombre), JavaScript ES2022 en modules natifs, **aucun build** |
| Backend | Node.js + Express, architecture par modules |
| Base de données | MySQL 8 (InnoDB, `utf8mb4`) ; métadonnées des photos uniquement |
| Photos privées | Fichiers optimisés WebP hors du répertoire public, références en MySQL |
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

Le fichier `.env` est à la racine du projet, **ignoré par Git**. `.env.example` documente toutes les variables
en développement, `.env.production.example` pour un hébergeur (Render, VPS).

| Variable | Rôle |
| --- | --- |
| `NODE_ENV`, `PORT`, `HOST`, `APP_URL` | Serveur d’écoute |
| `CORS_ORIGINS` | Origines autorisées, séparées par des virgules |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Connexion MySQL (serveur uniquement) |
| `DB_CREATE_IF_MISSING`, `DB_CONNECTION_LIMIT`, `DB_SSL` | Options de connexion |
| `ADMIN_PASSWORD`, `ADMIN_PASSWORD_HASH` | Accès administration (serveur uniquement) |
| `ADMIN_SESSION_TTL`, `JWT_SECRET`, `JWT_ISSUER` | Sessions administrateur |
| `PHOTO_STORAGE_DIR` | Répertoire privé et persistant des photos (défaut : `backend/data/suggestion-photos`) |
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
| `POST` | `/api/suggestions/:id/photos` | Ajout/remplacement des photos (multipart `photos`, autorisé par le code secret de la suggestion) |
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
| `GET` | `/api/admin/suggestions/:id/photos/:photoId/content` | Photo privée, session administrateur obligatoire |
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

Migrations : `database/migrations/001…005` (suggestions, historique, soutiens, journal de modération, photos).
Aucune donnée fictive n’est insérée en production.

---

## Tests

```bash
cd backend
npm test
```

- **69 tests** au total : 26 tests unitaires (validation, formatage, règles métier) et 43 tests d’intégration
  (API complète : dépôt, photos privées, liste, détail, soutien, suivi, authentification, administration, statistiques, journal).
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

## Déploiement en ligne

L’application est conçue pour tourner telle quelle sur un hébergeur Node :
elle n’écrit jamais sur le disque (les logs partent sur stdout) et résout ses
chemins depuis son propre emplacement, donc aucun ajustement de code n’est requis.

**Attention : Vercel et les Mutualisés classic ne conviennent pas** — ils ne
gèrent ni processus Node permanent, ni base de données. Un hébergeur de type
**Render**, **Railway** ou un **VPS Linux** convient.

### Étape 1 — Publier le code

Le dépôt doit contenir **tout le projet**, pas seulement `backend/` : l’application
sert elle-même `frontend/`, `shared/` et `database/`.

```bash
git init
git add .
git status          # vérifiez que .env et node_modules/ sont bien ignorés
git commit -m "LYNAQE Connect"
```

Si `.env` apparaît dans `git status`, **arrêtez-vous** : il contient vos secrets.

### Étape 2 — Préparer la base de données

Render ne fournit pas MySQL : il faut une base managée. **Évitez PlanetScale et
TiDB Serverless**, qui n’acceptent pas les clés étrangères — or le schéma en utilise
(historique, soutiens, journal de modération). **Aiven** fonctionne et convient au
schéma (InnoDB, utf8mb4).

Depuis votre machine, avec un `.env` temporaire pointant vers la base distante :

```bash
cd backend
npm run migrate      # applique les 4 migrations
npm run check        # vérifie le schéma
```

Si votre fournisseur exige une base non préfixée, adaptez `DB_NAME`
(attention : `DB_CREATE_IF_MISSING=false`, la base existe déjà).

### Étape 3 — Configurer Render

| Champ | Valeur |
| --- | --- |
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Puis saisissez les variables dans **Environment**, en vous appuyant sur
`.env.production.example`. Les deux points sensibles :

- **`HOST=0.0.0.0`** — sans cela le site est inaccessible *sans erreur dans les logs*.
  Le serveur écrit un avertissement explicite au démarrage si la valeur reste sur `127.0.0.1`.
- **`JWT_SECRET`** —générez-en un **nouveau** pour la production, jamais celui du `.env` local.

### Étape 4 — Vérifier

```bash
curl https://votre-domaine/api/health      # doit répondre ok
curl https://votre-domaine/api/meta        # 7 statuts, 8 catégories
```

Puis, dans le navigateur : déposer une suggestion, la suivre, et vous connecter
à `#/admin`.

### Limites connues en hébergement mutualisé type Render

- **Mise en veille** : le service gratuit s’endort après quelques minutes
  d’inactivité ; la première visite attend ensuite le redémarrage (~30 s).
- **Quotas approximatifs** : la limitation de débit est stockée en mémoire, donc
  par instance. Sur plusieurs instances, les quotas ne sont pas partagés.
  Pour un usage scolaire cela reste acceptable ; pour un service très exposé,
  il faudrait un compteur en base ou Redis.
- **Sauvegardes** : aucune automatique. Exportez régulièrement vos données,
  car une offre gratuite peut être interrompue sans préavis.

---

## Sécurité

- **CSP stricte** : aucun script inline ; le thème est appliqué par `theme-boot.js` avant la première peinture.
- **Photos privées** : format vérifié par décodage puis réencodé en WebP (métadonnées EXIF retirées),
  5 fichiers maximum de 5 Mo à l’entrée. Les fichiers ne sont jamais servis comme ressources statiques ;
  l’envoi exige le code secret de la suggestion et la lecture passe par une route réservée à l’administration.
- **Stockage persistant** : le répertoire `PHOTO_STORAGE_DIR` doit être hors du dossier `frontend` et sur un
  volume persistant en production. Sur un hébergeur à disque éphémère, configurez un disque persistant avant
  d’activer les photos, sinon elles seront perdues au redémarrage ou au redéploiement.
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
