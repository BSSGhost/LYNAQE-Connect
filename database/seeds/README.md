# Dossier `seeds/` — volontairement vide

## Pourquoi ce dossier ne contient aucune donnée

Le cahier des charges de **LYNAQE Connect** interdit explicitement toute
donnée de démonstration :

- aucune suggestion fictive (« Exemple de suggestion », « Améliorer la
  cantine », « Installer des bancs »…) ;
- aucun chiffre simulé dans les statistiques ;
- aucun soutien, statut ou timeline pré-rempli ;
- aucun mode démonstration exposé dans le suivi.

La plateforme démarre donc sur une base **réellement vide**. L'interface affiche
l'état vide élégant prévu par le cahier des charges :

> **Aucune suggestion pour le moment.**
> [ Proposer une idée ]

et la page **Consulter les statistiques** affiche des compteurs à `0` avec
la même mise en page que les données réelles (aucun chiffre bidon n'est
généré côté client).

## Comment injecter des données, si vous en avez besoin plus tard

Ne modifiez pas ce dossier à la main pour « faire une démo ». Préférez :

1. **Le site lui-même** — envoyez de vraies suggestions via
   `POST /api/suggestions` ou via le formulaire « Proposer une idée », puis
   modérez-les depuis l'espace administrateur. C'est le seul moyen de garantir
   que chaque ligne en base a bien transité par l'API réelle.
2. **Un fichier SQL d'import** placé dans ce dossier, nommé
   `NNN_<nom>.sql`, et exécuté manuellement avec :
   ```bash
   npm run exec:mysql -- database/seeds/vos_fichier.sql
   ```
   (ou via MySQL Workbench)

## Commandes utiles

```bash
# Créer la base et appliquer toutes les migrations
npm run migrate

# Vérifier la structure, les index et les contraintes
npm run check

# Repartir d'une base vide (EFFACE les suggestions)
npm run db:reset
```
