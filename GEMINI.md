# Arkanoid Legacy Blueprint

## 1. Description
Jeu Arkanoid pour navigateur web, basé sur HTML5 Canvas et modules ES. Le projet est déjà branché sur le pack de sprites PNG de `assets/` et n'utilise plus les SVG comme chemin nominal de rendu.

## 2. État actuel
- Multi-balles actives.
- HUD complet : score, vies, niveau, effets, statut.
- Bonus jouables : `catch`, `duplicate`, `expand`, `laser`, `slow`, `life`, `warp`.
- Ennemis animés avec portes d'entrée en haut de l'aire de jeu.
- Sons chargés depuis `assets/sounds/`.
- Explosion du paddle et rematérialisation déjà intégrées.
- Niveaux source chargés depuis `src/levels.json`.
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
- L'activation laser joue `paddle_laser_*` puis maintient la dernière frame pendant l'effet.
- Le cycle de niveaux repart au début après le dernier niveau défini.
- `F2` ouvre l'éditeur sur le niveau courant.
- `N` passe immédiatement au niveau suivant.
- Priorité de chargement des niveaux : override runtime, override `localStorage`, `src/levels.json`, puis `FALLBACK_LEVEL_DATA`.

## 6. Travail restant
- Raffiner le comportement du `warp` pour se rapprocher davantage de l'arcade originale.
- Éventuellement ajouter une transition visuelle de sortie du bonus `laser`.
- Étendre la banque de niveaux si l'on veut sortir du cycle actuel de deux stages.
