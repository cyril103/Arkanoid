import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [main, game, config, styles] = await Promise.all([
  read('src/main.js'),
  read('src/game.js'),
  read('src/config.js'),
  read('css/styles.css')
]);

assert.match(
  main,
  /detectReducedPerformanceMode/,
  'bootstrap should detect WebKit/iOS-style reduced performance mode before creating the game'
);
assert.match(
  main,
  /reducedPerformanceMode/,
  'bootstrap should pass the reduced performance mode into Game'
);
assert.match(
  config,
  /performance:\s*{/,
  'GAME_CONFIG should expose performance tuning defaults'
);
assert.match(
  config,
  /reducedFps:/,
  'performance config should define the reduced FPS target'
);
assert.match(
  game,
  /canvas\.getContext\("2d",\s*\{\s*alpha:\s*false\s*\}\)/,
  'canvas context should be opaque to avoid slow transparent compositing on Safari/iOS'
);
assert.match(
  game,
  /renderStaticBackdrop/,
  'static backdrop should be cached instead of rebuilt every frame'
);
assert.match(
  game,
  /staticBackdropCacheKey/,
  'static backdrop cache should be invalidated when the active level background changes'
);
assert.match(
  game,
  /brickLayerCache/,
  'reduced performance mode should cache the mostly-static brick layer instead of drawing every brick sprite every frame'
);
assert.match(
  game,
  /invalidateBrickLayerCache/,
  'brick cache should be invalidated only when bricks change or hit animations advance'
);
assert.match(
  game,
  /setTextIfChanged/,
  'HUD updates should avoid rewriting DOM text every animation frame on Safari/iOS'
);
assert.match(
  game,
  /if \(this\.reducedPerformanceMode\)/,
  'rendering should have an explicit reduced performance path for WebKit/iOS devices'
);
assert.match(
  game,
  /return false;\s*}\s*return true;/s,
  'reduced performance mode should skip expensive decorative overlays while preserving gameplay rendering'
);
assert.match(
  main,
  /forcedMode === "reduced"/,
  'reduced performance mode should be forceable with ?performance=reduced for verification and user fallback'
);
assert.match(
  main,
  /forcedMode === "full"/,
  'full performance mode should be forceable with ?performance=full if a WebKit device performs well'
);
assert.match(
  styles,
  /body\.reduced-performance/,
  'CSS should expose a reduced-performance mode to disable expensive shadows/overlays on Safari/iOS'
);
