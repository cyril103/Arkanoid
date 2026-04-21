Le jeu charge automatiquement le pack d'assets de ce dossier via les manifests définis dans `src/config.js`.

## Sprites actuellement branchés

- Paddle : `paddle.png`, `paddle_pulsate_*`, `paddle_materialize_*`, `paddle_wide_*`, `paddle_wide_pulsate_*`, `paddle_laser_*`, `paddle_laser_pulsate_*`, `paddle_explode_*`, `paddle_life.png`
- Balle : `ball.png`
- Briques : `brick_blue.png`, `brick_orange.png`, `brick_green.png`, `brick_red.png`, `brick_white.png`, `brick_yellow.png`, `brick_pink.png`, `brick_cyan.png`, `brick_silver.png`, `brick_silver_1.png` à `brick_silver_10.png`, `brick_gold.png`
- Cadre : `edge_top.png`, `edge_left.png`, `edge_right.png`
- Interface : `logo.png`
- Police HUD : `fonts/emulogic.ttf`
- Bonus : `powerup_catch_*`, `powerup_duplicate_*`, `powerup_expand_*`, `powerup_laser_*`, `powerup_slow_*`, `powerup_life_*`, `powerup_warp_*`
- Projectiles et transitions : `laser_bullet.png`, `door_top_left_*`, `door_top_right_*`
- Ennemis : `enemy_cone_*`, `enemy_cube_*`, `enemy_molecule_*`, `enemy_pyramid_*`, `enemy_explosion_*`

## Sons actuellement branchés

- `sounds/ball_bounce.wav`
- `sounds/brick_bounce.wav`
- `sounds/explosion_enemy.wav`
- `sounds/explosion_padle.wav`
- `sounds/extra_life.wav`
- `sounds/padle_bounce.wav`
- `sounds/shot.wav`

## Fichiers présents mais non nominaux

- `ball.svg`, `brick_common.svg`, `brick_hard.svg`, `brick_gold.svg`, `paddle.svg`

Ces SVG restent dans le dépôt comme héritage ou fallback visuel, mais le rendu normal du jeu s'appuie sur les PNG.

## Overrides

Le hook JavaScript reste disponible via :

- `window.ARKANOID_CUSTOM_SPRITES`
- `window.ARKANOID_CUSTOM_SOUNDS`
