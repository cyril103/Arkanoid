const BRICK_ROWS_TO_PADDLE = 26;
const BRICK_ROW_HEIGHT = 21;
const FRAME_Y = 16;
const FRAME_TOP_THICKNESS = 22;
const PADDLE_HEIGHT = 20;
const PADDLE_BOTTOM_OFFSET = 34;
const CANVAS_HEIGHT = FRAME_Y + FRAME_TOP_THICKNESS + (BRICK_ROWS_TO_PADDLE * BRICK_ROW_HEIGHT) + PADDLE_HEIGHT + PADDLE_BOTTOM_OFFSET;

export const GAME_CONFIG = Object.freeze({
  canvasWidth: 800,
  canvasHeight: CANVAS_HEIGHT,
  lives: {
    initial: 3
  },
  frame: {
    x: 100,
    y: FRAME_Y,
    width: 600,
    height: CANVAS_HEIGHT - (FRAME_Y * 2),
    wallThickness: 22,
    topThickness: FRAME_TOP_THICKNESS
  },
  playfield: {
    left: 122,
    right: 678,
    top: FRAME_Y + FRAME_TOP_THICKNESS,
    width: 556
  },
  paddle: {
    baseWidth: 79,
    expandedWidth: 119,
    width: 79,
    height: PADDLE_HEIGHT,
    bottomOffset: PADDLE_BOTTOM_OFFSET,
    keyboardSpeed: 620,
    pulseFps: 8,
    explodeFps: 14,
    materializeFps: 18,
    materializeDuration: 0.84,
    widthTransitionFps: 20,
    widthTransitionDuration: 0.45
  },
  ball: {
    radius: 5,
    launchSpeed: 450,
    maxBounceAngle: (70 * Math.PI) / 180
  },
  bricks: {
    topOffset: 32,
    sideMargin: 0,
    rowHeight: BRICK_ROW_HEIGHT,
    gap: 0,
    hardHitAnimationFps: 20
  },
  enemies: {
    maxActive: 3,
    spawnDelayMin: 1,
    spawnDelayMax: 5,
    spawnYOffset: 1,
    brickCollisionRadiusScale: 0.38,
    doorOpenings: {
      left: {
        x: 80,
        width: 90
      },
      right: {
        x: 386,
        width: 90
      }
    },
    speedMin: 68,
    speedMax: 104,
    decisionDelayMin: 0.55,
    decisionDelayMax: 1.45,
    score: 175,
    explosionFps: 18
  },
  powerUps: {
    width: 38,
    height: 19,
    fallSpeed: 120,
    animationFps: 10,
    spawnChance: 0.15,
    slowSpeedFactor: 0.74
  },
  laser: {
    width: 6,
    height: 15,
    speed: 420,
    cooldown: 0.3
  },
  warp: {
    transitionDuration: 0.55,
    doorFps: 14
  }
});

export const POWERUP_LIBRARY = Object.freeze({
  catch: {
    type: "catch",
    label: "Capture",
    spriteKey: "powerupCatch",
    weight: 3
  },
  duplicate: {
    type: "duplicate",
    label: "Duplication",
    spriteKey: "powerupDuplicate",
    weight: 2
  },
  laser: {
    type: "laser",
    label: "Laser",
    spriteKey: "powerupLaser",
    weight: 3
  },
  warp: {
    type: "warp",
    label: "Warp",
    spriteKey: "powerupWarp",
    weight: 1
  },
  expand: {
    type: "expand",
    label: "Extension",
    spriteKey: "powerupExpand",
    weight: 4
  },
  slow: {
    type: "slow",
    label: "Ralenti",
    spriteKey: "powerupSlow",
    weight: 3
  },
  life: {
    type: "life",
    label: "Vie",
    spriteKey: "powerupLife",
    weight: 1
  }
});

export const ENEMY_LIBRARY = Object.freeze({
  cone: {
    type: "cone",
    label: "Cone",
    spriteKey: "enemyCone",
    width: 34,
    height: 38,
    weight: 3
  },
  cube: {
    type: "cube",
    label: "Cube",
    spriteKey: "enemyCube",
    width: 36,
    height: 36,
    weight: 3
  },
  molecule: {
    type: "molecule",
    label: "Molecule",
    spriteKey: "enemyMolecule",
    width: 38,
    height: 35,
    weight: 2
  },
  pyramid: {
    type: "pyramid",
    label: "Pyramide",
    spriteKey: "enemyPyramid",
    width: 40,
    height: 27,
    weight: 2
  }
});

function createFrameSequence(prefix, count) {
  return Object.freeze(
    Array.from({ length: count }, (_, index) => `assets/${prefix}_${index + 1}.png`)
  );
}

export const DEFAULT_SPRITE_MANIFEST = Object.freeze({
  paddle: {
    src: "assets/paddle.png",
    width: 79,
    height: 20
  },
  paddlePulsate: {
    frames: createFrameSequence("paddle_pulsate", 4),
    width: 79,
    height: 20,
    fps: GAME_CONFIG.paddle.pulseFps
  },
  paddleExplode: {
    frames: createFrameSequence("paddle_explode", 8),
    width: 79,
    height: 20,
    fps: GAME_CONFIG.paddle.explodeFps
  },
  paddleMaterialize: {
    frames: createFrameSequence("paddle_materialize", 15),
    width: 79,
    height: 20,
    fps: GAME_CONFIG.paddle.materializeFps
  },
  paddleWideTransition: {
    frames: createFrameSequence("paddle_wide", 9),
    width: 119,
    height: 20,
    fps: GAME_CONFIG.paddle.widthTransitionFps
  },
  paddleShrinkTransition: {
    frames: [...createFrameSequence("paddle_wide", 9)].reverse(),
    width: 119,
    height: 20,
    fps: GAME_CONFIG.paddle.widthTransitionFps
  },
  paddleWide: {
    src: "assets/paddle_wide_9.png",
    width: 119,
    height: 20
  },
  paddleWidePulsate: {
    frames: createFrameSequence("paddle_wide_pulsate", 4),
    width: 119,
    height: 20,
    fps: GAME_CONFIG.paddle.pulseFps
  },
  paddleLaser: {
    frames: createFrameSequence("paddle_laser", 16),
    width: 79,
    height: 20,
    fps: 18
  },
  paddleLaserPulsate: {
    frames: createFrameSequence("paddle_laser_pulsate", 4),
    width: 79,
    height: 20,
    fps: GAME_CONFIG.paddle.pulseFps
  },
  ball: {
    src: "assets/ball.png",
    width: 10,
    height: 10
  },
  brickBlue: {
    src: "assets/brick_blue.png",
    width: 43,
    height: 21
  },
  brickCyan: {
    src: "assets/brick_cyan.png",
    width: 43,
    height: 21
  },
  brickGreen: {
    src: "assets/brick_green.png",
    width: 43,
    height: 21
  },
  brickOrange: {
    src: "assets/brick_orange.png",
    width: 43,
    height: 21
  },
  brickPink: {
    src: "assets/brick_pink.png",
    width: 43,
    height: 21
  },
  brickRed: {
    src: "assets/brick_red.png",
    width: 43,
    height: 21
  },
  brickWhite: {
    src: "assets/brick_white.png",
    width: 43,
    height: 21
  },
  brickYellow: {
    src: "assets/brick_yellow.png",
    width: 43,
    height: 21
  },
  brickSilverBase: {
    src: "assets/brick_silver.png",
    width: 43,
    height: 21
  },
  brickSilver1: {
    src: "assets/brick_silver_1.png",
    width: 43,
    height: 21
  },
  brickSilver2: {
    src: "assets/brick_silver_2.png",
    width: 43,
    height: 21
  },
  brickSilverHit: {
    frames: createFrameSequence("brick_silver", 10),
    width: 43,
    height: 21,
    fps: GAME_CONFIG.bricks.hardHitAnimationFps
  },
  brickGold: {
    src: "assets/brick_gold.png",
    width: 43,
    height: 21
  },
  frameTop: {
    src: "assets/edge_top.png",
    width: 556,
    height: 22
  },
  frameLeft: {
    src: "assets/edge_left.png",
    width: 22,
    height: 650
  },
  frameRight: {
    src: "assets/edge_right.png",
    width: 22,
    height: 650
  },
  logo: {
    src: "assets/logo.png",
    width: 400,
    height: 145
  },
  powerupExpand: {
    frames: createFrameSequence("powerup_expand", 8),
    width: 38,
    height: 19,
    fps: GAME_CONFIG.powerUps.animationFps
  },
  powerupCatch: {
    frames: createFrameSequence("powerup_catch", 8),
    width: 38,
    height: 19,
    fps: GAME_CONFIG.powerUps.animationFps
  },
  powerupDuplicate: {
    frames: createFrameSequence("powerup_duplicate", 8),
    width: 38,
    height: 19,
    fps: GAME_CONFIG.powerUps.animationFps
  },
  powerupLaser: {
    frames: createFrameSequence("powerup_laser", 8),
    width: 38,
    height: 19,
    fps: GAME_CONFIG.powerUps.animationFps
  },
  powerupSlow: {
    frames: createFrameSequence("powerup_slow", 8),
    width: 38,
    height: 19,
    fps: GAME_CONFIG.powerUps.animationFps
  },
  powerupLife: {
    frames: createFrameSequence("powerup_life", 8),
    width: 38,
    height: 19,
    fps: GAME_CONFIG.powerUps.animationFps
  },
  powerupWarp: {
    frames: createFrameSequence("powerup_warp", 8),
    width: 38,
    height: 19,
    fps: GAME_CONFIG.powerUps.animationFps
  },
  laserBullet: {
    src: "assets/laser_bullet.png",
    width: 6,
    height: 15
  },
  doorTopLeft: {
    frames: createFrameSequence("door_top_left", 7),
    width: 556,
    height: 22,
    fps: GAME_CONFIG.warp.doorFps
  },
  doorTopRight: {
    frames: createFrameSequence("door_top_right", 7),
    width: 556,
    height: 22,
    fps: GAME_CONFIG.warp.doorFps
  },
  paddleLife: {
    src: "assets/paddle_life.png",
    width: 43,
    height: 17
  },
  enemyCone: {
    frames: createFrameSequence("enemy_cone", 25),
    width: 34,
    height: 38,
    fps: 20
  },
  enemyCube: {
    frames: createFrameSequence("enemy_cube", 25),
    width: 36,
    height: 36,
    fps: 20
  },
  enemyMolecule: {
    frames: createFrameSequence("enemy_molecule", 25),
    width: 38,
    height: 35,
    fps: 20
  },
  enemyPyramid: {
    frames: createFrameSequence("enemy_pyramid", 25),
    width: 40,
    height: 27,
    fps: 20
  },
  enemyExplosion: {
    frames: createFrameSequence("enemy_explosion", 10),
    width: 48,
    height: 50,
    fps: GAME_CONFIG.enemies.explosionFps
  }
});

export const DEFAULT_SOUND_MANIFEST = Object.freeze({
  ballBounce: {
    src: "assets/sounds/ball_bounce.wav",
    volume: 0.4,
    poolSize: 4,
    cooldownMs: 30
  },
  brickBounce: {
    src: "assets/sounds/brick_bounce.wav",
    volume: 0.45,
    poolSize: 4,
    cooldownMs: 35
  },
  enemyExplosion: {
    src: "assets/sounds/explosion_enemy.wav",
    volume: 0.6,
    poolSize: 3,
    cooldownMs: 50
  },
  paddleExplosion: {
    src: "assets/sounds/explosion_padle.wav",
    volume: 0.65,
    poolSize: 2,
    cooldownMs: 120
  },
  extraLife: {
    src: "assets/sounds/extra_life.wav",
    volume: 0.55,
    poolSize: 2,
    cooldownMs: 120
  },
  paddleBounce: {
    src: "assets/sounds/padle_bounce.wav",
    volume: 0.5,
    poolSize: 4,
    cooldownMs: 35
  },
  shot: {
    src: "assets/sounds/shot.wav",
    volume: 0.42,
    poolSize: 4,
    cooldownMs: 60
  }
});

export function resolveSpriteManifest(overrides = {}) {
  const keys = new Set([
    ...Object.keys(DEFAULT_SPRITE_MANIFEST),
    ...Object.keys(overrides)
  ]);

  return Object.fromEntries(
    Array.from(keys, (key) => [
      key,
      {
        ...(DEFAULT_SPRITE_MANIFEST[key] ?? {}),
        ...(overrides[key] ?? {})
      }
    ])
  );
}

export function resolveSoundManifest(overrides = {}) {
  const keys = new Set([
    ...Object.keys(DEFAULT_SOUND_MANIFEST),
    ...Object.keys(overrides)
  ]);

  return Object.fromEntries(
    Array.from(keys, (key) => [
      key,
      {
        ...(DEFAULT_SOUND_MANIFEST[key] ?? {}),
        ...(overrides[key] ?? {})
      }
    ])
  );
}
