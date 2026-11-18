# Muscu - état et reprise

App de musculation perso de Louis (iPhone, PWA). Créée le 2026-11-17.

- En ligne : https://taaqz-13.github.io/muscu/ (dépôt public `Taaqz-13/muscu`, déploiement `actions/deploy-pages` à chaque push sur `main`).
- Données : `localStorage` du téléphone (`muscu.data.v1`), copie dans le dépôt **privé** `Taaqz-13/muscu-data` (`data.json`) via un jeton fine-grained créé et collé par Louis dans Réglages. Claude ne crée ni ne manipule jamais ce jeton.
- Serveur local : entrée `muscu` de `~/.claude/.claude/launch.json` (port 8655).
- Tests : `node tests/run.js` (calculs de stats, records, semaines, fusion, bibliothèque).
- Icônes : `node tools/make-icons.js`.

## Choix produit actés (Louis, 2026-11-17)
- Rien ne bloque en séance : tous les exercices visibles, ordre libre, Passer / Remplacer / Retirer / Ajouter à tout moment, exercice créé à la volée.
- Saisie d'une série : kilos + reps, RPE facultatif. Pas de note.
- Minuteur de repos (v1.2, demande du 17/11) : se lance seul après chaque série validée, choix 1:00 / 1:30 / 2:00 / 2:30 retenu par exercice, +15 s, basé sur une heure de fin. Dans la fiche exercice il est intégré au-dessus de la saisie (ne cache jamais « Valider »), ailleurs il flotte au-dessus des onglets. Limite iOS : pas de son si l'app est en arrière-plan.
- Séance type : reps (texte, ex « 8-10 ») et charge prévues par exercice, affichées « Prévu » et utilisées pour pré-remplir tant qu'il n'y a pas d'historique.
- Icône de muscle (silhouette face + dos, zone en couleur) à côté de chaque exercice.
- Pas de bouton « Séance libre » (retiré à la demande de Louis, il ne le comprenait pas).
- Pré-remplissage : 1re série = 1re série de la dernière fois, séries suivantes = série précédente du jour. « Dernière fois » affiché en haut de chaque exercice.
- Fin de séance : mise à jour de la séance type proposée (décochée par défaut) si l'ordre ou les exercices ont changé.
- Stats : bilan de la semaine vs semaine d'avant, séries par muscle (muscle principal), courbe par exercice (charge max, 1RM Epley, volume, séries) avec valeurs écrites, historique modifiable.

## Pièges connus
- Ne jamais renommer un exercice dans `js/seed.js` : l'id dérive du nom, il serait recréé en double. Renommer depuis l'app.
- Changer `CACHE` dans `sw.js` et `VERSION` dans `app.js` à chaque mise en ligne visible (témoin en bas des Réglages). Vérifier comme le téléphone, sans paramètre anti-cache.
- Avant un test UI en local : vérifier qu'aucun jeton n'est dans le localStorage de `localhost:8655`, sinon les données de test partent dans `muscu-data`.
- `data.json` > 1 Mo : géré (relecture en brut), mais à surveiller au bout de quelques années.

## Pistes (après retours d'usage)
- Notes par exercice (réglage machine), alternative « OU » dans une séance type.
- Superséries, séries d'échauffement exclues des stats.
- Objectif de progression (« +2,5 kg quand 3x10 atteint »).

## v1.3 (18/11, demandes de Louis)
- Lancer une séance ouvre directement l'exercice en cours (plus la liste). `#/` avec une séance ouverte redirige vers `#/ex/<exercice en cours>` ; la liste est sur `#/seance` (bouton « Tous les exos x/y »). Exercice en cours retenu dans `muscu.cur.v1` (le dernier ouvert s'il n'est pas fini, sinon le prochain à faire). Barre de progression cliquable en haut.
- Menu d'un exercice en couleurs et séparé : Passer (orange), Remplacer (bleu), Monter/Descendre (neutre, côte à côte), Retirer (rouge).
- Séance oubliée : plus de 3 h sans série = bandeau orange (Terminer / Supprimer / Je continue), point orange sur l'onglet Séance, message au démarrage. « Terminer » enregistre la fin à l'heure de la dernière série + 1 min, pas maintenant (Louis avait une séance ouverte depuis 9-12 h).
- Supprimer la séance en cours : bouton rouge visible en bas de la liste et dans la feuille « Terminer ». Pas de notification hors de l'app (iOS ne le permet pas sans serveur de push).

## Relecture du 18/11 (v1.2.1)
Bloc de 24 px du minuteur inactif posé sur la barre d'onglets (signalé par Louis) + 10 points d'une relecture indépendante, corrigés et testés : plan qui suivait un exercice remplacé, synchro sans délai max, fichier en ligne illisible qui aurait été écrasé, import mal formé qui plantait au démarrage, feuilles impossibles à fermer sur iOS, clavier sur la feuille, défilement débloqué sous le sélecteur, records de l'historique faussés par les séances plus récentes, Entrée qui créait au lieu de choisir, son du minuteur muet après verrouillage, séance vidée laissée dans l'historique.
- Piège de test : le serveur local Python laisse le navigateur garder l'ancien CSS/JS en cache. Avant de conclure, `fetch(f, {cache: 'reload'})` sur chaque fichier puis recharger.
