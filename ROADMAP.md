# Muscu - état et reprise

App de musculation perso de Louis (iPhone, PWA). Créée le 2026-11-17.

- En ligne : https://taaqz-13.github.io/muscu/ (dépôt public `Taaqz-13/muscu`, déploiement `actions/deploy-pages` à chaque push sur `main`).
- Données : `localStorage` du téléphone (`muscu.data.v1`), copie dans le dépôt **privé** `Taaqz-13/muscu-data` (`data.json`) via un jeton fine-grained créé et collé par Louis dans Réglages. Claude ne crée ni ne manipule jamais ce jeton.
- Serveur local : entrée `muscu` de `~/.claude/.claude/launch.json` (port 8655).
- Tests : `node tests/run.js` (calculs de stats, records, semaines, fusion, bibliothèque).
- Icônes : `node tools/make-icons.js`.

## Choix produit actés (Louis, 2026-11-17)
- Rien ne bloque en séance : tous les exercices visibles, ordre libre, Passer / Remplacer / Retirer / Ajouter à tout moment, exercice créé à la volée.
- Saisie d'une série : kilos + reps, RPE facultatif. Pas de minuteur de repos, pas de note.
- Pré-remplissage : 1re série = 1re série de la dernière fois, séries suivantes = série précédente du jour. « Dernière fois » affiché en haut de chaque exercice.
- Fin de séance : mise à jour de la séance type proposée (décochée par défaut) si l'ordre ou les exercices ont changé.
- Stats : bilan de la semaine vs semaine d'avant, séries par muscle (muscle principal), courbe par exercice (charge max, 1RM Epley, volume, séries) avec valeurs écrites, historique modifiable.

## Pièges connus
- Ne jamais renommer un exercice dans `js/seed.js` : l'id dérive du nom, il serait recréé en double. Renommer depuis l'app.
- Changer `CACHE` dans `sw.js` et `VERSION` dans `app.js` à chaque mise en ligne visible (témoin en bas des Réglages). Vérifier comme le téléphone, sans paramètre anti-cache.
- Avant un test UI en local : vérifier qu'aucun jeton n'est dans le localStorage de `localhost:8655`, sinon les données de test partent dans `muscu-data`.
- `data.json` > 1 Mo : géré (relecture en brut), mais à surveiller au bout de quelques années.

## Pistes (après retours d'usage)
- Minuteur de repos optionnel, notes par exercice (réglage machine).
- Superséries, séries d'échauffement exclues des stats.
- Objectif de progression (« +2,5 kg quand 3x10 atteint »).
