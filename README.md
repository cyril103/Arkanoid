# Arkanoid Legacy

Récréation d'Arkanoid pour navigateur web, développée en HTML5 Canvas avec modules ES. Le jeu utilise par défaut le pack PNG présent dans `assets/`, conserve quelques placeholders SVG en héritage, et expose des hooks simples pour surcharger les sprites et les sons.

## État actuel

- Rendu nominal sur sprites PNG, sans dépendre des placeholders SVG.
- Gestion de plusieurs balles simultanées.
- HUD avec score, vies, niveau, statut et effets temporaires.
- Bonus actifs : `catch`, `duplicate`, `expand`, `laser`, `slow`, `life`, `warp`.
- Ennemis animés entrant par les portes du haut.
- Explosion du paddle, transition de matérialisation, séquences laser et élargissement.
- Deux niveaux actuellement définis dans `src/levels.json`, bouclés en cycle.
- Un éditeur visuel est disponible dans `level-editor.html`.

## Démarrage

Le projet ne nécessite pas de build.

```bash
npm run serve
```

Puis ouvrez `http://localhost:8080/`.

Équivalent direct :

```bash
python -m http.server 8080
```

## Commandes

- Souris : déplacement horizontal du paddle.
- Clavier : `Flèche gauche/droite`, `A/D` ou `Q/D`.
- `Espace` ou clic : lancer la balle.
- `Espace` ou clic avec `laser` actif : tirer.
- `F2` : ouvrir l'éditeur de niveaux sur le niveau courant.
- `N` : passer immédiatement au niveau suivant.

## Architecture

- `src/config.js` : constantes de gameplay, bibliothèques d'entités, manifests par défaut.
- `src/game.js` : boucle de jeu, collisions, bonus, progression, HUD.
- `src/entities.js` : paddle, balles, briques, bonus, lasers, ennemis.
- `src/input.js` : souris, clavier, clic et file d'actions.
- `src/levels.json` : données de niveaux éditables.
- `src/levels.js` : chargement, normalisation, overrides et helpers de placement.
- `src/main.js` : bootstrap, canvas, HUD, chargement audio.

## Personnalisation

Le jeu lit automatiquement :

- `window.ARKANOID_CUSTOM_SPRITES`
- `window.ARKANOID_CUSTOM_SOUNDS`
- `window.ARKANOID_CUSTOM_LEVELS`

Ces overrides doivent être définis avant le chargement de `src/main.js`.

Exemple pour les sprites :

```html
<script src="src/sprite-overrides.example.js"></script>
<script type="module" src="src/main.js"></script>
```

Le manifest des sprites supporte :

- `src` pour une image fixe
- `frames` pour une animation
- `fps` pour la cadence
- `width` / `height` pour les dimensions logiques

Le manifest audio supporte notamment :

- `src`
- `volume`
- `poolSize`
- `cooldownMs`

## Audio

Les sons chargés par défaut depuis `assets/sounds/` couvrent :

- rebonds balle et paddle
- impact sur brique
- tir laser
- explosion d'ennemi
- explosion du paddle
- bonus de vie

## Niveaux et progression

- Les niveaux sont chargés depuis `src/levels.json`.
- Le format recommandé est un objet JSON avec `version` et `levels`.
- Chaque niveau contient `id`, `name` et `layout`.
- Les cellules de `layout` utilisent `null`, `blue`, `orange`, `green`, `red`, `white`, `yellow`, `pink`, `cyan`, `silver` ou `gold`.
- Le chargeur conserve une compatibilité avec l'ancien format numérique `0/1/2/3`.
- `level-editor.html` permet d'éditer la grille, d'exporter le JSON et d'appliquer un override local relu ensuite par le jeu.

- Les briques standards valent 100 points.
- Les briques argent résistent à deux impacts et jouent une animation sur le premier.
- Les briques or sont indestructibles.
- Finir le dernier niveau relance le cycle au niveau 1.
