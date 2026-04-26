import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [html, css, main] = await Promise.all([
  read('index.html'),
  read('css/styles.css'),
  read('src/main.js')
]);

assert.match(html, /id="start-menu"/, 'index.html exposes a start menu overlay');
assert.match(html, /id="start-game-button"/, 'menu contains a start button');
assert.match(html, /ARKANOID LEGACY/i, 'menu displays the game title');
assert.match(html, /Appuyez sur Entr[ée]e|Appuyez sur Entrée|Cliquez sur Jouer/i, 'menu explains how to start');
assert.match(css, /\.start-menu/, 'CSS styles the start menu overlay');
assert.match(css, /\.start-menu\.is-hidden/, 'CSS can hide the menu after start');
assert.match(main, /start-game-button/, 'bootstrap wires the start button');
assert.match(main, /waitForStartMenu/, 'game loop waits for the menu before starting');
