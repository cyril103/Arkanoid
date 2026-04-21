# Arkanoid Legacy Blueprint

## 1. Description
Jeu Arkanoid pour navigateur web, basé sur HTML5 Canvas et modules ES. Le projet est déjà branché sur le pack de sprites PNG de `assets/` et n'utilise plus les SVG comme chemin nominal de rendu.

## 2. État actuel
- Multi-balles actives.
- HUD minimaliste à droite du canvas : `1 UP` et `HIGH SCORE`.
- Meilleur score sauvegardé localement dans `localStorage` (`arkanoid.highScore`).
- Police arcade du HUD chargée depuis `assets/fonts/emulogic.ttf`.
- Curseur système masqué au-dessus du canvas de jeu.
- Bonus jouables : `catch`, `duplicate`, `expand`, `laser`, `slow`, `life`, `warp`.
- Bonus non cumulables : une pilule remplace l'effet persistant précédent.
- Effets `catch`, `expand`, `laser` et `slow` sans timer ; ils cessent à la perte de balle ou au changement de niveau.
- La balle accélère uniquement après les rebonds contre les briques, jusqu'à `GAME_CONFIG.ball.maxSpeed`, puis revient à la vitesse normale après perte de balle ou changement de niveau.
- Les briques argent ne donnent pas de capsule bonus.
- Ennemis animés avec portes d'entrée en haut de l'aire de jeu et type choisi par niveau.
- Sons chargés depuis `assets/sounds/`.
- Explosion du paddle et rematérialisation déjà intégrées.
- Niveaux source version `3` chargés depuis `src/levels.json`.
- Éditeur de niveaux disponible dans `level-editor.html`.

## 3. Architecture
- `src/config.js` : configuration gameplay, manifests sprites et sons.
- `src/game.js` : logique centrale, collisions, transitions, HUD.
- `src/entities.js` : entités runtime.
- `src/input.js` : souris, clavier, clic, espace, raccourcis debug.
- `src/levels.json` : données de niveaux.
- `src/levels.js` : chargement, normalisation, compat legacy, overrides.
- `src/level-editor.js` + `level-editor.html` : édition et export des niveaux.
- `src/main.js` : bootstrap.

## 4. Règles de rendu
- Préférer les sprites existants de `assets/` avant toute création de placeholder.
- Conserver les mécaniques dans `src/game.js` et les données statiques dans `src/config.js`.
- Respecter les hooks `window.ARKANOID_CUSTOM_SPRITES` et `window.ARKANOID_CUSTOM_SOUNDS`.
- Respecter aussi `window.ARKANOID_CUSTOM_LEVELS`.

## 5. Points d'attention
- La brique argent utilise `brick_silver.png` puis l'animation `brick_silver_1..10`.
- La brique argent est exclue du tirage de capsules bonus.
- Le comptage des rebonds pour l'accélération de balle ne prend en compte que les collisions balle/brique.
- L'activation laser joue `paddle_laser_*` puis maintient la dernière frame pendant l'effet.
- La perte d'une vie ou le changement de niveau remet le paddle à l'état normal.
- Le cycle de niveaux repart au début après le dernier niveau défini.
- Chaque niveau définit `enemyType` (`cone`, `cube`, `molecule`, `pyramid`) ; l'éditeur expose ce choix.
- Les ennemis spawnent centrés sur l'ouverture de porte correspondante.
- Les ennemis utilisent un cercle réduit uniquement pour leur blocage contre les briques.
- `F2` ouvre l'éditeur sur le niveau courant.
- `N` passe immédiatement au niveau suivant.
- Priorité de chargement des niveaux : override runtime, override `localStorage`, `src/levels.json`, puis `FALLBACK_LEVEL_DATA`.
- Les overrides locaux antérieurs au format courant sont migrés avec les types d'ennemis du fichier source quand c'est possible.

## 6. Travail restant
- Raffiner le comportement du `warp` pour se rapprocher davantage de l'arcade originale.
- Éventuellement ajouter une transition visuelle de sortie du bonus `laser`.
- Étendre la banque de niveaux si l'on veut sortir du cycle actuel des niveaux définis dans `src/levels.json`.
