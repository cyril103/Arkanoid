## 1. Description du Projet
Récréation du jeu d'arcade classique "Arkanoid" pour navigateur web. Le projet est un jeu HTML5 Canvas modulaire, pensé pour exploiter en priorité le pack de sprites personnalisé déjà présent dans `assets/`.

## 2. État Actuel
- Le jeu charge par défaut les sprites PNG du dossier `assets/`.
- Les placeholders SVG sont encore présents dans le dépôt, mais ne constituent plus le rendu nominal.
- Le moteur gère plusieurs balles simultanées.
- Le HUD est minimaliste et placé à droite du canvas : `1 UP` affiche le score courant, `HIGH SCORE` affiche le meilleur score local.
- Le meilleur score est persisté dans `localStorage` avec la clé `arkanoid.highScore`.
- La police du HUD est chargée depuis `assets/fonts/emulogic.ttf`.
- Le curseur système est masqué quand il survole le canvas de jeu.
- La zone de jeu a une hauteur logique de `544px`, avec `frame.height: 512`.
- Les niveaux source sont définis dans `src/levels.json`, puis relancés en cycle.
- Un éditeur de niveaux est disponible dans `level-editor.html`.
- Les sons sont chargés depuis `assets/sounds/` avec manifest surchargable.

## 3. Architecture Technique
- **Moteur :** HTML5 Canvas / JavaScript ES modules.
- **Entrée :** souris, clavier (`flèches`, `A/D`, `Q/D`), clic et barre d'espace.
- **Rendu :** sprites fixes et séquences animées via manifest.
- **Audio :** manifest de sons + pool d'instances audio HTML5.
- **Configuration :** `src/config.js`
- **Boucle de jeu :** `src/game.js`
- **Entités :** `src/entities.js`
- **Entrée :** `src/input.js`
- **Niveaux source :** `src/levels.json`
- **Chargement / normalisation / overrides :** `src/levels.js`
- **Éditeur :** `src/level-editor.js` + `level-editor.html`
- **Bootstrap :** `src/main.js`

## 4. Entités et Composants
### A. Le Vaus
- **Sprites principaux :** `assets/paddle.png`, `assets/paddle_pulsate_*`, `assets/paddle_materialize_*`
- **Variantes actives :** `assets/paddle_wide_*`, `assets/paddle_wide_pulsate_*`, `assets/paddle_laser_*`, `assets/paddle_laser_pulsate_*`, `assets/paddle_explode_*`
- **Comportement :** suit l'axe X de la souris ou du clavier.
- **Transition laser :** la séquence `paddle_laser_*` est jouée une seule fois à l'activation du bonus, puis le paddle reste figé sur sa dernière frame pendant l'effet.
- **Destruction :** la séquence `paddle_explode_*` est jouée lors de la perte de la dernière balle active avant respawn ou reset de partie.
- **Physique :** l'impact sur la raquette module l'angle de rebond.
- **Reset visuel :** le paddle redevient normal à la perte d'une vie ou au changement de niveau.

### B. Les Balles
- **Sprite :** `assets/ball.png`
- **Comportement :** rebond sur murs, plafond, raquette et briques.
- **Vitesse :** démarre à `GAME_CONFIG.ball.launchSpeed`, augmente seulement après les rebonds contre les briques via `speedIncreasePerBounce`, plafonne à `maxSpeed`, puis revient à la normale après perte de balle ou changement de niveau.
- **État spécial :** une ou plusieurs balles peuvent être collées à la raquette avec le bonus `catch`.

### C. Les Briques
- **Sprites actifs :** `brick_blue`, `brick_orange`, `brick_green`, `brick_red`, `brick_white`, `brick_yellow`, `brick_pink`, `brick_cyan`, `brick_silver`, `brick_silver_1..10`, `brick_gold`
- **Types :**
  - standard : 1 coup
  - renforcée : 2 coups
  - or : indestructible
- **Brique renforcée grise :**
  - état initial : `assets/brick_silver.png`
  - premier impact : animation `assets/brick_silver_1.png` à `assets/brick_silver_10.png`
  - après animation : la brique reste endommagée avant destruction au second coup
  - ne génère jamais de capsule bonus

### D. Les Bonus
- **Bonus implémentés :**
  - `catch`
  - `duplicate`
  - `expand`
  - `laser`
  - `slow`
  - `life`
  - `warp`
- **Sprites actifs :** `powerup_catch_*`, `powerup_duplicate_*`, `powerup_expand_*`, `powerup_laser_*`, `powerup_slow_*`, `powerup_life_*`, `powerup_warp_*`
- **Cumul :** les effets de pilules ne se cumulent pas ; une nouvelle pilule annule l'effet persistant précédent.
- **Durée :** `catch`, `expand`, `laser` et `slow` restent actifs sans timer jusqu'à perte de balle ou changement de niveau.
- **Instantanés :** `duplicate`, `life` et `warp` annulent aussi l'effet précédent, même s'ils appliquent un effet immédiat.

### E. Projectiles et Transition
- **Laser :** `assets/laser_bullet.png`
- **Warp :** `assets/door_top_left_*`, `assets/door_top_right_*`

### F. Ennemis
- **Sprites actifs :** `enemy_cone_*`, `enemy_cube_*`, `enemy_molecule_*`, `enemy_pyramid_*`
- **Explosion :** `enemy_explosion_*`
- **Comportement :**
  - un seul type d'ennemi par niveau, défini par `enemyType`
  - entrée centrée sur l'ouverture réelle d'une des portes du haut avec animation de porte
  - dérive aléatoire vers le bas, collisions avec murs et briques
  - collision contre les briques via un cercle réduit pour leur laisser plus de liberté de mouvement
  - explosion au contact de la raquette ou sous les tirs laser
  - si un ennemi atteint le bas sans toucher la raquette, il est replacé en haut et ressort par une des deux portes

## 5. Logique de Jeu
- **Collisions :** cercle/rectangle pour les balles, rectangle/rectangle pour bonus, lasers et contacts ennemis ; les ennemis utilisent un cercle réduit uniquement pour leur blocage contre les briques.
- **Multi-balles :** le moteur maintient une liste de balles actives.
- **Accélération de balle :** le comptage de rebonds utilisé pour accélérer la balle ne prend en compte que les collisions balle/brique.
- **Vies :** compteur de vies avec animation d'explosion du paddle, reset de manche et relance de partie.
- **Progression :** niveaux version `3` décrits par matrices JSON dans `src/levels.json`, normalisés par `src/levels.js`.
- **Types d'ennemis :** chaque niveau porte `enemyType` (`cone`, `cube`, `molecule`, `pyramid`) et l'éditeur permet de le choisir.
- **Overrides legacy :** les overrides locaux de niveaux antérieurs à la version courante sont migrés avec les `enemyType` du fichier source quand c'est possible.
- **Score :** points de briques, ennemis et bonus de collecte ; meilleur score sauvegardé localement.
- **Cycle :** la fin du dernier niveau recharge le premier.
- **Raccourcis debug :**
  - `F2` ouvre l'éditeur de niveaux sur le niveau courant
  - `N` force le passage au niveau suivant

## 6. Personnalisation des Sprites et Sons
- Le manifest de sprites par défaut est défini dans `src/config.js`.
- Le manifest audio par défaut est aussi défini dans `src/config.js`.
- Les overrides de sprites passent par `window.ARKANOID_CUSTOM_SPRITES`.
- Les overrides audio passent par `window.ARKANOID_CUSTOM_SOUNDS`.
- Les overrides de niveaux passent par `window.ARKANOID_CUSTOM_LEVELS` ou par l'override local enregistré par l'éditeur.
- Un exemple complet de surcharge de sprites est fourni dans `src/sprite-overrides.example.js`.
- Priorité de chargement des niveaux :
  - `window.ARKANOID_CUSTOM_LEVELS`
  - override local `localStorage`
  - `src/levels.json`
  - `FALLBACK_LEVEL_DATA`
- Le manifest sprite supporte :
  - `src` pour un sprite fixe
  - `frames` pour une animation
  - `fps` pour la cadence d'animation
  - `width` et `height` pour les dimensions logiques
- Le manifest audio supporte :
  - `src`
  - `volume`
  - `poolSize`
  - `cooldownMs`

## 7. Travail Restant
- Éventuellement enrichir le `warp` avec un comportement plus proche de l'arcade originale.
- Documenter ou intégrer un état visuel de sortie du bonus `laser` si un retour animé vers le paddle standard devient nécessaire.
- Ajouter davantage de niveaux si l'on veut dépasser le cycle actuel.

## 8. Conventions de Travail
- Préserver la structure `/src`, `/assets`, `/css`.
- Garder les mécaniques centralisées dans `src/game.js` et les données statiques dans `src/config.js`.
- Considérer `src/levels.json` comme la source durable des niveaux du projet ; l'override de l'éditeur sert surtout au test local.
- Toute évolution du format de niveau doit rester compatible avec l'éditeur et avec la normalisation de `src/levels.js`.
- Toute nouvelle mécanique doit être branchée sur les sprites existants avant d'introduire de nouveaux placeholders.
- Toute mise à jour documentaire doit rester alignée avec les manifests et le comportement réel du code.
