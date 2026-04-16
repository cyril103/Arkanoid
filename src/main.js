import { GAME_CONFIG } from "./config.js";
import { Game } from "./game.js";
import { createInputController } from "./input.js";
import { loadLevels } from "./levels.js";
import { getResolvedSoundManifest } from "./soundHooks.js";
import { createSoundboard } from "./sounds.js";

async function bootstrap() {
  const canvas = document.getElementById("game-canvas");
  const scoreNode = document.getElementById("score-value");
  const livesNode = document.getElementById("lives-value");
  const levelNode = document.getElementById("level-value");
  const effectNode = document.getElementById("effect-value");
  const statusNode = document.getElementById("status-value");
  const sounds = createSoundboard(getResolvedSoundManifest());
  const levels = await loadLevels();

  canvas.width = GAME_CONFIG.canvasWidth;
  canvas.height = GAME_CONFIG.canvasHeight;

  const game = new Game({
    canvas,
    scoreNode,
    livesNode,
    levelNode,
    effectNode,
    statusNode,
    sounds,
    levels
  });

  const input = createInputController(canvas);
  sounds.installUnlockHandlers();
  await game.init();

  let previousTime = performance.now();

  const frame = (timestamp) => {
    const dt = Math.min((timestamp - previousTime) / 1000, 1 / 30);
    previousTime = timestamp;

    if (input.consumeEditorRequest()) {
      openLevelEditor(game);
      return;
    }

    if (input.consumeNextLevelRequest()) {
      game.advanceToNextLevel();
    }

    game.update(dt, input);
    game.render();
    window.requestAnimationFrame(frame);
  };

  window.requestAnimationFrame(frame);
}

function openLevelEditor(game) {
  const currentLevel = game.levels[game.levelIndex];
  const url = new URL("../level-editor.html", import.meta.url);

  if (currentLevel?.id) {
    url.searchParams.set("level", currentLevel.id);
  }

  window.location.href = url.toString();
}

bootstrap().catch((error) => {
  console.error("Initialisation impossible", error);
  const statusNode = document.getElementById("status-value");
  if (statusNode) {
    statusNode.textContent = "Erreur d'initialisation";
  }
});
