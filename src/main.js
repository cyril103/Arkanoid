import { GAME_CONFIG } from "./config.js";
import { Game } from "./game.js";
import { createInputController } from "./input.js";
import { loadLevels } from "./levels.js";
import { getResolvedSoundManifest } from "./soundHooks.js";
import { createSoundboard } from "./sounds.js";

async function bootstrap() {
  const canvas = document.getElementById("game-canvas");
  const startMenu = document.getElementById("start-menu");
  const startButton = document.getElementById("start-game-button");
  const mobileControls = document.querySelector(".mobile-controls");
  const scoreNode = document.getElementById("score-value");
  const highScoreNode = document.getElementById("high-score-value");
  const sounds = createSoundboard(getResolvedSoundManifest());
  const levels = await loadLevels();

  canvas.width = GAME_CONFIG.canvasWidth;
  canvas.height = GAME_CONFIG.canvasHeight;

  const game = new Game({
    canvas,
    scoreNode,
    highScoreNode,
    sounds,
    levels
  });

  sounds.installUnlockHandlers();
  await game.init();
  await waitForStartMenu({ startMenu, startButton });

  const input = createInputController(canvas, { mobileControls });
  canvas.focus();

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

function waitForStartMenu({ startMenu, startButton }) {
  if (!startMenu || !startButton) {
    return Promise.resolve();
  }

  startButton.focus();

  return new Promise((resolve) => {
    const start = () => {
      startMenu.classList.add("is-hidden");
      startMenu.setAttribute("aria-hidden", "true");
      startButton.removeEventListener("click", start);
      window.removeEventListener("keydown", onKeyDown);
      resolve();
    };

    const onKeyDown = (event) => {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        start();
      }
    };

    startButton.addEventListener("click", start);
    window.addEventListener("keydown", onKeyDown);
  });
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
  const scoreNode = document.getElementById("score-value");
  if (scoreNode) {
    scoreNode.textContent = "ERROR";
  }
});
