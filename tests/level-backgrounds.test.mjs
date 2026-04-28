import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [levelsRaw, config, game, levelsModule, editorHtml, editorJs] = await Promise.all([
  read('src/levels.json'),
  read('src/config.js'),
  read('src/game.js'),
  read('src/levels.js'),
  read('level-editor.html'),
  read('src/level-editor.js')
]);

const payload = JSON.parse(levelsRaw);
const levelBackgrounds = payload.levels.map((level) => level.background);
const uniqueBackgrounds = new Set(levelBackgrounds);

assert.match(config, /LEVEL_BACKGROUND_LIBRARY/, 'config exposes a reusable level background library');
assert.match(levelsModule, /DEFAULT_LEVEL_BACKGROUND/, 'levels have a default background during normalization');
assert.match(levelsModule, /background:\s*normalizeLevelBackground/, 'normalizeLevel preserves and sanitizes level backgrounds');
assert.match(levelsModule, /background:\s*normalizeLevelBackground\(level\.background\)/, 'cloneLevels preserves backgrounds');
assert.match(game, /renderLevelBackground/, 'game renders the current level background before entities');
assert.match(game, /this\.levels\[this\.levelIndex\]\?\.background/, 'renderer reads background from the active level');

assert.ok(payload.levels.length >= 4, 'fixture has several levels to vary backgrounds');
assert.equal(levelBackgrounds.length, payload.levels.length, 'each level declares a background');
assert.ok(levelBackgrounds.every((background) => typeof background === 'string' && background.length > 0), 'all backgrounds are non-empty ids');
assert.ok(uniqueBackgrounds.size >= 4, 'levels cycle through several original-arcade-inspired backgrounds');
assert.deepEqual(
  [...uniqueBackgrounds].slice(0, 4),
  ['blue-panel', 'green-panel', 'blue-circuit', 'red-mechanic'],
  'levels use the four first-row tileset-inspired backgrounds'
);
assert.match(config, /blue-texture/, 'first background recreates the blue textured panel procedurally');
assert.match(config, /green-grain/, 'second background recreates the green granular panel procedurally');
assert.match(config, /blue-circuit/, 'third background recreates the blue circuit panel procedurally');
assert.match(config, /red-mechanic/, 'fourth background recreates the grey and red mechanical panel procedurally');
assert.match(editorHtml, /id="level-background-select"/, 'level editor exposes a background selector');
assert.match(editorJs, /LEVEL_BACKGROUND_LIBRARY/, 'level editor lists configured backgrounds');
assert.match(editorJs, /levelBackgroundSelect/, 'level editor wires the background selector');
assert.match(editorJs, /drawPreviewBlueTexture/, 'level editor previews the blue textured tileset background');
assert.match(editorJs, /drawPreviewGreenGrain/, 'level editor previews the green granular tileset background');
assert.match(editorJs, /drawPreviewBlueCircuit/, 'level editor previews the blue circuit tileset background');
assert.match(editorJs, /drawPreviewRedMechanic/, 'level editor previews the red mechanical tileset background');
assert.match(levelsModule, /export const LEVEL_FILE_VERSION = 4/, 'backgrounds bump the persisted level format version');
assert.match(levelsModule, /applyBaseLevelDefaults/, 'legacy level overrides are migrated with base defaults');
assert.match(levelsModule, /baseBackgroundsById/, 'legacy override migration can recover base backgrounds by id');
assert.match(levelsModule, /hasLevelBackground/, 'migration detects overrides that already specify a background');
assert.match(editorJs, /background\s*:\s*DEFAULT_LEVEL_BACKGROUND/, 'new editor levels get a default background');
