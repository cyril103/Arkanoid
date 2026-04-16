# Revue de code - 2026-04-16

## Constats

1. Moyen: la perte d'une balle conserve tous les bonus temporaires après le respawn. `src/game.js:194` remet bien les effets à zéro, mais seulement dans `loadLevel()`. Le chemin de perte de vie passe par `src/game.js:216` puis `src/game.js:226` et `src/game.js:206` sans appeler `clearTimedEffects()`. Concrètement, `catch`, `expand`, `laser` et `slow` survivent à la mort, et leurs timers sont en plus gelés pendant l'animation d'explosion. Si l'intention est bien un reset de manche, c'est une régression de gameplay.

2. Moyen: la transition de largeur du paddle est désynchronisée entre visuel et collision. `src/game.js:330` applique `this.paddle.setWidth(targetWidth)` immédiatement, puis `src/game.js:1177` affiche `paddleWideTransition` / `paddleShrinkTransition` dans `this.paddle.width`. Résultat: la hitbox change avant la fin de l'animation, et la séquence de rétrécissement définie dans `src/config.js:224` est affichée compressée dans une largeur déjà réduite à 79 px dès la première frame.

3. Moyen: les overrides de sprites ne peuvent pas changer proprement le nombre de frames pour l'animation d'impact de la brique argent ou l'explosion d'ennemi. Le manifest accepte des `frames` arbitraires, mais `src/entities.js:178` et `src/entities.js:267` imposent une durée codée en dur à `10 / fps`. Si un override fournit plus ou moins de 10 frames, l'animation sera coupée trop tôt ou restera trop longtemps, malgré le contrat plus générique exposé dans `src/config.js:319` et `src/config.js:438`.

4. Faible: `paddleLaserPulsate` est actuellement du code mort, donc l'état "balle capturée pendant que le laser est actif" n'a pas de retour visuel dédié. La branche laser de `src/game.js:1192` retourne avant les branches `hasStuckBalls()` de `src/game.js:1207` et `src/game.js:1221`, et rien d'autre ne consomme le sprite déclaré dans `src/config.js:253`.

## Hypothèse

- Le point 1 part de l'hypothèse que "perte de vie = reset de manche", ce qui correspond à la documentation actuelle du projet.

## Couverture

- Revue faite par inspection statique du code dans `src/`.
- Aucun test automatisé n'a été lancé: il n'y a ni suite de tests ni script de lint dans `package.json`.
