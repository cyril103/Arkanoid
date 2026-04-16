import { GAME_CONFIG } from "./config.js";
import { Game } from "./game.js";
import { createInputController } from "./input.js";
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

  canvas.width = GAME_CONFIG.canvasWidth;
  canvas.height = GAME_CONFIG.canvasHeight;

  const game = new Game({
    canvas,
    scoreNode,
    livesNode,
    levelNode,
    effectNode,
    statusNode,
    sounds
  });

  const input = createInputController(canvas);
  sounds.installUnlockHandlers();
  await game.init();

  let previousTime = performance.now();

  const frame = (timestamp) => {
    const dt = Math.min((timestamp - previousTime) / 1000, 1 / 30);
    previousTime = timestamp;
    game.update(dt, input);
    game.render();
    window.requestAnimationFrame(frame);
  };

  window.requestAnimationFrame(frame);
}

bootstrap().catch((error) => {
  console.error("Initialisation impossible", error);
  const statusNode = document.getElementById("status-value");
  if (statusNode) {
    statusNode.textContent = "Erreur d'initialisation";
  }
});
