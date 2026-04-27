import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [html, css, main, input] = await Promise.all([
  read('index.html'),
  read('css/styles.css'),
  read('src/main.js'),
  read('src/input.js')
]);

assert.match(html, /id="start-menu"/, 'index.html exposes a start menu overlay');
assert.match(html, /id="start-game-button"/, 'menu contains a start button');
assert.match(html, /ARKANOID LEGACY/i, 'menu displays the game title');
assert.match(html, /Appuyez sur Entr[ée]e|Appuyez sur Entrée|Cliquez sur Jouer/i, 'menu explains how to start');
assert.match(css, /\.start-menu/, 'CSS styles the start menu overlay');
assert.match(css, /\.start-menu\.is-hidden/, 'CSS can hide the menu after start');
assert.match(main, /start-game-button/, 'bootstrap wires the start button');
assert.match(main, /waitForStartMenu/, 'game loop waits for the menu before starting');

assert.match(html, /class="mobile-controls"/, 'index.html exposes touch controls for phones');
assert.match(html, /data-mobile-action="left"/, 'mobile controls include a left button');
assert.match(html, /data-mobile-action="right"/, 'mobile controls include a right button');
assert.match(html, /data-mobile-action="launch"/, 'mobile controls include a launch/fire button');
assert.match(css, /touch-action:\s*none/, 'canvas disables browser gestures while playing on touch screens');
assert.match(css, /\.mobile-controls/, 'CSS styles the mobile controls');
assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.mobile-controls/, 'mobile controls are enabled in the phone breakpoint');
assert.match(main, /mobileControls/, 'bootstrap passes mobile controls to input');
assert.match(input, /pointerdown/, 'input supports pointerdown for touch play');
assert.match(input, /setPointerCapture/, 'input captures touch pointers while dragging');
assert.match(input, /mobileControls/, 'input wires optional mobile controls');
assert.match(input, /data-mobile-action/, 'input reads action names from mobile control buttons');
