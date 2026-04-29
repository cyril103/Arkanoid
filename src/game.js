import { Ball, Brick, Enemy, EnemyExplosion, LaserShot, Paddle, PowerUp } from "./entities.js";
import { ENEMY_LIBRARY, GAME_CONFIG, LEVEL_BACKGROUND_LIBRARY, POWERUP_LIBRARY } from "./config.js";
import { buildBrickPlacements, normalizeEnemyType } from "./levels.js";
import { loadSprites } from "./sprites.js";
import { getResolvedSpriteManifest } from "./spriteHooks.js";
import { clamp, isCircleCollidingWithRect } from "./utils.js";

const HIGH_SCORE_STORAGE_KEY = "arkanoid.highScore";

export class Game {
  constructor({
    canvas,
    scoreNode,
    highScoreNode = null,
    levelNode = null,
    statusNode = null,
    livesNode = null,
    effectNode = null,
    sounds = null,
    levels = [],
    reducedPerformanceMode = false
  }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.scoreNode = scoreNode;
    this.highScoreNode = highScoreNode;
    this.levelNode = levelNode;
    this.statusNode = statusNode;
    this.livesNode = livesNode;
    this.effectNode = effectNode;
    this.sounds = sounds;
    this.levels = levels;
    this.reducedPerformanceMode = reducedPerformanceMode;

    this.paddle = new Paddle();
    this.balls = [new Ball()];
    this.levelIndex = 0;
    this.score = 0;
    this.highScore = loadHighScore();
    this.lives = GAME_CONFIG.lives.initial;
    this.bricks = [];
    this.powerUps = [];
    this.lasers = [];
    this.enemies = [];
    this.enemyExplosions = [];
    this.enemyDoorAnimations = [];
    this.statusText = "Chargement...";
    this.levelCompleteCooldown = 0;
    this.pendingLevelIndex = null;
    this.pendingTransitionReason = null;
    this.elapsed = 0;
    this.paddleRespawnElapsed = 0;
    this.currentBallSpeed = GAME_CONFIG.ball.launchSpeed;
    this.laserCooldownRemaining = 0;
    this.enemySpawnCooldown = getRandomEnemySpawnDelay();
    this.activeEffects = {
      catch: 0,
      expand: 0,
      laser: 0,
      slow: 0
    };
    this.paddleWidthTransition = null;
    this.paddleLaserTransitionElapsed = 0;
    this.paddleDestruction = null;
    this.levelBackgroundCache = new Map();
    this.staticBackdropCache = null;
    this.staticBackdropCacheKey = null;
  }

  async init() {
    if (!Array.isArray(this.levels) || this.levels.length === 0) {
      throw new Error("Aucun niveau disponible");
    }

    this.sprites = await loadSprites(getResolvedSpriteManifest());
    this.loadLevel(0);
    this.updateHud();
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.bricks = buildBricks(this.levels[index].layout);
    this.powerUps = [];
    this.lasers = [];
    this.enemies = [];
    this.enemyExplosions = [];
    this.enemyDoorAnimations = [];
    this.enemySpawnCooldown = getRandomEnemySpawnDelay();
    this.clearActivePowerUpEffect({ clearLasers: true });
    this.resetBallState();
    this.statusText = "Prêt à lancer";
    this.levelCompleteCooldown = 0;
    this.pendingLevelIndex = null;
    this.pendingTransitionReason = null;
    this.paddleDestruction = null;
    this.updateHud();
  }

  update(dt, input) {
    if (this.paddleDestruction) {
      this.updatePaddleDestruction(dt);
      return;
    }

    this.elapsed += dt;
    this.paddleRespawnElapsed += dt;
    this.laserCooldownRemaining = Math.max(0, this.laserCooldownRemaining - dt);
    this.updateActiveEffects(dt);
    this.updatePaddleTransition(dt);
    this.updateDoorAnimations(dt);
    this.updateEnemyExplosions(dt);
    this.updateBrickAnimations(dt);
    this.paddle.update(dt, input.state);
    this.syncAttachedBalls();
    this.updateEffectHud();
    this.updatePowerUps(dt);
    this.updateLasers(dt);

    if (this.levelCompleteCooldown > 0) {
      this.levelCompleteCooldown -= dt;
      if (this.levelCompleteCooldown <= 0 && this.pendingLevelIndex !== null) {
        const reason = this.pendingTransitionReason;
        this.loadLevel(this.pendingLevelIndex);
        if (reason === "warp") {
          this.statusText = "Warp réussi";
          this.updateHud();
        } else if (reason === "clear" && this.levelIndex === 0) {
          this.statusText = "Cycle relancé";
          this.updateHud();
        }
      }
      return;
    }

    const actionRequested = input.consumeLaunch();
    if (actionRequested) {
      if (this.hasStuckBalls()) {
        this.releaseStuckBalls();
      } else if (this.activeEffects.laser > 0 && this.laserCooldownRemaining === 0) {
        this.fireLaserShots();
      }
    }

    this.updateEnemies(dt);
    this.handleEnemyBallCollisions();

    if (this.balls.every((ball) => ball.stuckToPaddle)) {
      return;
    }

    for (const ball of this.balls) {
      if (ball.stuckToPaddle) {
        continue;
      }

      ball.move(dt);
      this.handleWallCollisions(ball);
      this.handlePaddleCollision(ball);
      this.handleBrickCollisions(ball);
    }

    this.handleEnemyBallCollisions();

    this.balls = this.balls.filter(
      (ball) => ball.stuckToPaddle || ball.y - ball.radius <= GAME_CONFIG.frame.y + GAME_CONFIG.frame.height
    );

    if (this.balls.length === 0) {
      this.handleLostBall();
      return;
    }

    if (this.areDestructibleBricksCleared()) {
      this.scheduleLevelTransition(
        this.levelIndex < this.levels.length - 1 ? this.levelIndex + 1 : 0,
        1.2,
        this.levelIndex < this.levels.length - 1 ? "Niveau suivant" : "Victoire",
        "clear"
      );
    }
  }

  hasStuckBalls() {
    return this.balls.some((ball) => ball.stuckToPaddle);
  }

  hasMovingBall() {
    return this.balls.some((ball) => !ball.stuckToPaddle);
  }

  releaseStuckBalls({ updateStatus = true } = {}) {
    for (const ball of this.balls) {
      if (!ball.stuckToPaddle) {
        continue;
      }

      ball.launch();
      this.applyCurrentBallSpeed(ball);
    }

    if (updateStatus) {
      this.statusText = "En cours";
      this.updateHud();
    }
  }

  restartRun(statusText = "Partie relancée") {
    this.score = 0;
    this.lives = GAME_CONFIG.lives.initial;
    this.loadLevel(0);
    this.statusText = statusText;
    this.updateHud();
  }

  advanceToNextLevel(statusText = "Cheat: niveau suivant") {
    const nextLevelIndex = this.levelIndex < this.levels.length - 1 ? this.levelIndex + 1 : 0;
    this.loadLevel(nextLevelIndex);
    this.statusText = statusText;
    this.updateHud();
  }

  clearActivePowerUpEffect({ releaseCaughtBalls = false, clearLasers = false } = {}) {
    const hadCatch = this.activeEffects.catch > 0;
    const hadSlow = this.activeEffects.slow > 0;

    this.activeEffects.catch = 0;
    this.activeEffects.expand = 0;
    this.activeEffects.laser = 0;
    this.activeEffects.slow = 0;
    this.laserCooldownRemaining = 0;
    this.paddleWidthTransition = null;
    this.paddleLaserTransitionElapsed = 0;

    if (clearLasers) {
      this.lasers = [];
    }

    this.paddle.setWidth(GAME_CONFIG.paddle.baseWidth);
    this.syncAttachedBalls();

    if (hadSlow) {
      for (const ball of this.balls) {
        if (!ball.stuckToPaddle) {
          this.applyCurrentBallSpeed(ball);
        }
      }
    }

    if (releaseCaughtBalls && hadCatch) {
      this.releaseStuckBalls({ updateStatus: false });
    }
  }

  resetBallState() {
    this.resetBallSpeedProgression();
    this.paddle = new Paddle();
    this.syncPaddleWidthWithEffects();
    const ball = new Ball();
    ball.attachToPaddle(this.paddle);
    this.balls = [ball];
    this.lasers = [];
    this.paddleRespawnElapsed = 0;
  }

  handleLostBall() {
    this.lives -= 1;
    this.clearActivePowerUpEffect({ clearLasers: true });
    this.playSound("paddleExplosion");
    this.paddleDestruction = {
      elapsed: 0
    };
    this.statusText = this.lives > 0 ? "Balle perdue" : "Partie perdue";
    this.updateHud();
  }

  updatePaddleDestruction(dt) {
    if (!this.paddleDestruction) {
      return;
    }

    this.paddleDestruction.elapsed += dt;

    if (this.paddleDestruction.elapsed < getAnimationDuration(this.sprites?.paddleExplode)) {
      return;
    }

    this.paddleDestruction = null;

    if (this.lives > 0) {
      this.resetBallState();
      this.statusText = "Prêt à lancer";
      this.updateHud();
      return;
    }

    this.restartRun("Partie perdue");
  }

  updateActiveEffects(dt) {
    if (this.activeEffects.laser > 0) {
      const laserTransitionDuration = getAnimationDuration(this.sprites?.paddleLaser);
      if (this.paddleLaserTransitionElapsed < laserTransitionDuration) {
        this.paddleLaserTransitionElapsed = Math.min(
          laserTransitionDuration,
          this.paddleLaserTransitionElapsed + dt
        );
      }
    } else {
      this.paddleLaserTransitionElapsed = 0;
    }
  }

  updatePaddleTransition(dt) {
    if (!this.paddleWidthTransition) {
      return;
    }

    this.paddleWidthTransition.elapsed += dt;

    if (this.paddleWidthTransition.elapsed >= GAME_CONFIG.paddle.widthTransitionDuration) {
      const width = this.paddleWidthTransition.mode === "expand"
        ? GAME_CONFIG.paddle.expandedWidth
        : GAME_CONFIG.paddle.baseWidth;
      this.paddle.setWidth(width);
      this.paddleWidthTransition = null;
      this.syncAttachedBalls();
    }
  }

  updateDoorAnimations(dt) {
    for (const animation of this.enemyDoorAnimations) {
      animation.elapsed += dt;
    }

    const duration = 7 / GAME_CONFIG.warp.doorFps;
    this.enemyDoorAnimations = this.enemyDoorAnimations.filter((animation) => animation.elapsed < duration);
  }

  updateEnemyExplosions(dt) {
    for (const explosion of this.enemyExplosions) {
      explosion.update(dt);
    }

    this.enemyExplosions = this.enemyExplosions.filter((explosion) => !explosion.expired);
  }

  updateBrickAnimations(dt) {
    for (const brick of this.bricks) {
      if (brick.destroyed) {
        continue;
      }

      brick.update(dt);
    }
  }

  startPaddleWidthTransition(mode) {
    const targetWidth = mode === "expand" ? GAME_CONFIG.paddle.expandedWidth : GAME_CONFIG.paddle.baseWidth;
    if (this.paddle.width === targetWidth && !this.paddleWidthTransition) {
      return;
    }

    this.paddleWidthTransition = {
      mode,
      elapsed: 0
    };
    this.paddle.setWidth(targetWidth);
    this.syncAttachedBalls();
  }

  syncPaddleWidthWithEffects() {
    const width = this.activeEffects.expand > 0
      ? GAME_CONFIG.paddle.expandedWidth
      : GAME_CONFIG.paddle.baseWidth;
    this.paddle.setWidth(width);
  }

  syncAttachedBalls() {
    for (const ball of this.balls) {
      ball.syncWithPaddle(this.paddle);
    }
  }

  applyCurrentBallSpeed(ball) {
    ball.setSpeed(this.getCurrentBallSpeed());
  }

  getCurrentBallSpeed() {
    const speed = this.currentBallSpeed || GAME_CONFIG.ball.launchSpeed;
    if (this.activeEffects.slow > 0) {
      return speed * GAME_CONFIG.powerUps.slowSpeedFactor;
    }

    return speed;
  }

  resetBallSpeedProgression() {
    this.currentBallSpeed = GAME_CONFIG.ball.launchSpeed;
  }

  increaseBallSpeedAfterBounce() {
    const maxSpeed = Math.max(GAME_CONFIG.ball.launchSpeed, GAME_CONFIG.ball.maxSpeed);
    const nextSpeed = Math.min(
      maxSpeed,
      this.currentBallSpeed + GAME_CONFIG.ball.speedIncreasePerBounce
    );

    if (nextSpeed === this.currentBallSpeed) {
      return;
    }

    this.currentBallSpeed = nextSpeed;
    for (const ball of this.balls) {
      if (!ball.stuckToPaddle) {
        this.applyCurrentBallSpeed(ball);
      }
    }
  }

  updatePowerUps(dt) {
    for (const powerUp of this.powerUps) {
      if (powerUp.collected || powerUp.expired) {
        continue;
      }

      powerUp.update(dt);

      if (isRectColliding(powerUp, this.paddle)) {
        powerUp.collected = true;
        this.applyPowerUp(powerUp);
      }
    }

    this.powerUps = this.powerUps.filter((powerUp) => !powerUp.collected && !powerUp.expired);
  }

  updateLasers(dt) {
    for (const laser of this.lasers) {
      if (laser.expired) {
        continue;
      }

      laser.update(dt);
      this.handleLaserEnemyCollisions(laser);
      if (!laser.expired) {
        this.handleLaserBrickCollisions(laser);
      }
    }

    this.lasers = this.lasers.filter((laser) => !laser.expired);
  }

  updateEnemies(dt) {
    if (this.hasMovingBall()) {
      this.enemySpawnCooldown -= dt;
      if (this.enemySpawnCooldown <= 0 && this.enemies.length < GAME_CONFIG.enemies.maxActive) {
        this.spawnEnemy();
        this.enemySpawnCooldown = getRandomEnemySpawnDelay();
      }
    }

    for (const enemy of this.enemies) {
      if (enemy.destroyed) {
        continue;
      }

      enemy.update(dt);
      if (enemy.decisionRemaining <= 0) {
        this.randomizeEnemyVelocity(enemy, { preferDownward: true });
      }

      this.moveEnemy(enemy, dt);
      this.resolveEnemyPaddleCollision(enemy);
    }

    this.enemies = this.enemies.filter((enemy) => !enemy.destroyed);
  }

  spawnEnemy() {
    const enemyType = normalizeEnemyType(this.levels[this.levelIndex]?.enemyType);
    const definition = ENEMY_LIBRARY[enemyType];
    if (!definition) {
      return;
    }

    const enemy = new Enemy({
      x: 0,
      y: 0,
      definition,
      speed: randomRange(GAME_CONFIG.enemies.speedMin, GAME_CONFIG.enemies.speedMax)
    });

    this.placeEnemyAtTopDoor(enemy);
    this.enemies.push(enemy);
  }

  randomizeEnemyVelocity(enemy, { preferDownward = true, horizontalSign = null } = {}) {
    let dx = randomRange(-0.9, 0.9);
    let dy = preferDownward
      ? randomRange(0.35, 1)
      : randomRange(-1, 1);

    if (horizontalSign !== null) {
      dx = Math.abs(dx || 0.25) * horizontalSign;
    }

    if (Math.abs(dx) < 0.12) {
      dx = dx < 0 ? -0.22 : 0.22;
    }

    if (preferDownward && dy < 0.25) {
      dy = 0.25 + Math.abs(dy);
    }

    enemy.setVelocity(dx, dy);
    enemy.decisionRemaining = randomRange(
      GAME_CONFIG.enemies.decisionDelayMin,
      GAME_CONFIG.enemies.decisionDelayMax
    );
  }

  moveEnemy(enemy, dt) {
    const nextX = enemy.x + (enemy.dx * dt);
    if (!this.isEnemyBlocked(nextX, enemy.y, enemy.width, enemy.height)) {
      enemy.x = nextX;
    } else {
      enemy.dx = -enemy.dx;
      enemy.decisionRemaining = 0.08;
    }

    const nextY = enemy.y + (enemy.dy * dt);
    const nextRect = {
      x: enemy.x,
      y: nextY,
      width: enemy.width,
      height: enemy.height
    };

    if (this.isRectTouchingPaddle(nextRect)) {
      enemy.y = nextY;
      return;
    }

    if (nextY + enemy.height >= GAME_CONFIG.frame.y + GAME_CONFIG.frame.height) {
      this.placeEnemyAtTopDoor(enemy);
      return;
    }

    if (!this.isEnemyBlocked(enemy.x, nextY, enemy.width, enemy.height)) {
      enemy.y = nextY;
    } else {
      enemy.dy = -enemy.dy;
      enemy.decisionRemaining = 0.08;
    }
  }

  isEnemyBlocked(x, y, width, height) {
    const rect = { x, y, width, height };

    if (
      x <= GAME_CONFIG.playfield.left ||
      x + width >= GAME_CONFIG.playfield.right ||
      y <= GAME_CONFIG.playfield.top
    ) {
      return true;
    }

    const brickCollisionCircle = getEnemyBrickCollisionCircle(rect);
    for (const brick of this.bricks) {
      if (!brick.destroyed && isCircleCollidingWithRect(brickCollisionCircle, brick)) {
        return true;
      }
    }

    return false;
  }

  resolveEnemyPaddleCollision(enemy) {
    if (!this.isRectTouchingPaddle(enemy)) {
      return;
    }

    this.destroyEnemy(enemy);
  }

  isRectTouchingPaddle(rect) {
    return (
      rect.x <= this.paddle.x + this.paddle.width &&
      rect.x + rect.width >= this.paddle.x &&
      rect.y <= this.paddle.y + this.paddle.height &&
      rect.y + rect.height >= this.paddle.y
    );
  }

  placeEnemyAtTopDoor(enemy, side = Math.random() < 0.5 ? "left" : "right") {
    const opening = GAME_CONFIG.enemies.doorOpenings[side] ?? GAME_CONFIG.enemies.doorOpenings.left;
    const openingCenterX = GAME_CONFIG.playfield.left + opening.x + (opening.width / 2);
    enemy.x = clamp(
      openingCenterX - (enemy.width / 2),
      GAME_CONFIG.playfield.left,
      GAME_CONFIG.playfield.right - enemy.width
    );
    enemy.y = GAME_CONFIG.playfield.top + GAME_CONFIG.enemies.spawnYOffset;
    enemy.elapsed = 0;

    this.randomizeEnemyVelocity(enemy, {
      preferDownward: true,
      horizontalSign: side === "left" ? 1 : -1
    });

    this.enemyDoorAnimations.push({
      side,
      elapsed: 0
    });
    this.statusText = "Intrusion ennemie";
    this.updateHud();
  }

  handleEnemyBallCollisions() {
    for (const enemy of this.enemies) {
      if (enemy.destroyed) {
        continue;
      }

      for (const ball of this.balls) {
        if (ball.stuckToPaddle) {
          continue;
        }

        if (!isCircleCollidingWithRect(ball, enemy)) {
          continue;
        }

        resolveBallRectResponse(ball, enemy);
        this.destroyEnemy(enemy);
        break;
      }
    }
  }

  handleLaserEnemyCollisions(laser) {
    for (const enemy of this.enemies) {
      if (enemy.destroyed) {
        continue;
      }

      if (!isRectColliding(laser, enemy)) {
        continue;
      }

      laser.expired = true;
      this.destroyEnemy(enemy);
      break;
    }
  }

  destroyEnemy(enemy) {
    enemy.destroyed = true;
    this.playSound("enemyExplosion");
    this.enemyExplosions.push(
      new EnemyExplosion({
        x: enemy.x + (enemy.width / 2),
        y: enemy.y + (enemy.height / 2)
      })
    );
    this.score += GAME_CONFIG.enemies.score;
    this.statusText = "Ennemi détruit";
    this.updateHud();
  }

  applyPowerUp(powerUp) {
    let shouldOverrideStatus = true;
    this.clearActivePowerUpEffect({ releaseCaughtBalls: true });

    switch (powerUp.type) {
      case "catch":
        this.activeEffects.catch = 1;
        break;
      case "duplicate":
        this.spawnDuplicateBalls();
        break;
      case "expand":
        this.activeEffects.expand = 1;
        this.startPaddleWidthTransition("expand");
        break;
      case "laser":
        this.activeEffects.laser = 1;
        this.paddleLaserTransitionElapsed = 0;
        this.laserCooldownRemaining = 0;
        break;
      case "life":
        this.lives += 1;
        this.playSound("extraLife");
        break;
      case "slow":
        this.activeEffects.slow = 1;
        for (const ball of this.balls) {
          if (!ball.stuckToPaddle) {
            this.applyCurrentBallSpeed(ball);
          }
        }
        break;
      case "warp":
        this.activateWarp();
        shouldOverrideStatus = false;
        break;
      default:
        return;
    }

    this.score += 50;
    if (shouldOverrideStatus) {
      this.statusText = `Bonus: ${powerUp.label}`;
    }
    this.updateHud();
  }

  activateWarp() {
    const nextLevel = this.levelIndex < this.levels.length - 1 ? this.levelIndex + 1 : 0;
    this.scheduleLevelTransition(nextLevel, GAME_CONFIG.warp.transitionDuration, "Warp", "warp");
  }

  scheduleLevelTransition(nextLevelIndex, duration, statusText, reason) {
    this.clearActivePowerUpEffect({ clearLasers: true });
    this.powerUps = [];
    this.lasers = [];
    this.enemies = [];
    this.enemyExplosions = [];
    this.enemyDoorAnimations = [];
    this.levelCompleteCooldown = duration;
    this.pendingLevelIndex = nextLevelIndex;
    this.pendingTransitionReason = reason;
    this.statusText = statusText;
    this.updateHud();
  }

  spawnDuplicateBalls() {
    const maxBalls = 3;
    const availableSlots = maxBalls - this.balls.length;
    if (availableSlots <= 0 || this.balls.length === 0) {
      return;
    }

    const source = this.balls.find((ball) => !ball.stuckToPaddle) ?? this.balls[0];
    const speed = Math.hypot(source.dx, source.dy) || GAME_CONFIG.ball.launchSpeed;
    const angles = [-0.42, 0.42];

    for (let index = 0; index < availableSlots; index += 1) {
      const clone = source.clone();

      if (source.stuckToPaddle) {
        const offsets = [-18, 18];
        clone.attachToPaddle(this.paddle, offsets[index] ?? 0);
      } else {
        const angle = angles[index] ?? 0.22;
        const rotated = rotateVector(source.dx, source.dy, angle);
        clone.dx = rotated.x;
        clone.dy = rotated.y;
        clone.setSpeed(speed);
      }

      this.balls.push(clone);
    }
  }

  fireLaserShots() {
    this.laserCooldownRemaining = GAME_CONFIG.laser.cooldown;
    this.playSound("shot");

    this.lasers.push(
      new LaserShot({
        x: this.paddle.x + 8,
        y: this.paddle.y - GAME_CONFIG.laser.height
      }),
      new LaserShot({
        x: this.paddle.x + this.paddle.width - GAME_CONFIG.laser.width - 8,
        y: this.paddle.y - GAME_CONFIG.laser.height
      })
    );

    this.statusText = "Tir laser";
    this.updateHud();
  }

  maybeSpawnPowerUp(brick) {
    if (brick.indestructible || brick.type === "hard" || Math.random() > GAME_CONFIG.powerUps.spawnChance) {
      return;
    }

    const definition = pickWeightedDefinition(POWERUP_LIBRARY);
    if (!definition) {
      return;
    }

    this.powerUps.push(
      new PowerUp({
        x: brick.x + ((brick.width - GAME_CONFIG.powerUps.width) / 2),
        y: brick.y + ((brick.height - GAME_CONFIG.powerUps.height) / 2),
        definition
      })
    );
  }

  handleWallCollisions(ball) {
    let collided = false;

    if (ball.x - ball.radius <= GAME_CONFIG.playfield.left) {
      ball.x = GAME_CONFIG.playfield.left + ball.radius;
      ball.dx = Math.abs(ball.dx);
      collided = true;
    }

    if (ball.x + ball.radius >= GAME_CONFIG.playfield.right) {
      ball.x = GAME_CONFIG.playfield.right - ball.radius;
      ball.dx = -Math.abs(ball.dx);
      collided = true;
    }

    if (ball.y - ball.radius <= GAME_CONFIG.playfield.top) {
      ball.y = GAME_CONFIG.playfield.top + ball.radius;
      ball.dy = Math.abs(ball.dy);
      collided = true;
    }

    if (collided) {
      this.playSound("ballBounce");
    }
  }

  handlePaddleCollision(ball) {
    const paddleRect = {
      x: this.paddle.x,
      y: this.paddle.y,
      width: this.paddle.width,
      height: this.paddle.height
    };

    if (!isCircleCollidingWithRect(ball, paddleRect) || ball.dy <= 0) {
      return;
    }

    if (this.activeEffects.catch > 0) {
      this.playSound("paddleBounce");
      ball.attachToPaddle(this.paddle, ball.x - this.paddle.centerX);
      this.statusText = "Balle capturée";
      this.updateHud();
      return;
    }

    ball.y = this.paddle.y - ball.radius - 1;
    const impact = clamp((ball.x - this.paddle.centerX) / (this.paddle.width / 2), -1, 1);
    const speed = Math.hypot(ball.dx, ball.dy) || GAME_CONFIG.ball.launchSpeed;
    const angle = impact * GAME_CONFIG.ball.maxBounceAngle;

    ball.dx = speed * Math.sin(angle);
    ball.dy = -Math.abs(speed * Math.cos(angle));
    this.playSound("paddleBounce");
    this.statusText = "En cours";
    this.updateHud();
  }

  handleBrickCollisions(ball) {
    for (const brick of this.bricks) {
      if (brick.destroyed) {
        continue;
      }

      if (!isCircleCollidingWithRect(ball, brick)) {
        continue;
      }

      resolveBallRectResponse(ball, brick);
      this.increaseBallSpeedAfterBounce();
      this.playSound("brickBounce");
      this.damageBrick(brick);
      break;
    }
  }

  handleLaserBrickCollisions(laser) {
    for (const brick of this.bricks) {
      if (brick.destroyed) {
        continue;
      }

      if (!isRectColliding(laser, brick)) {
        continue;
      }

      laser.expired = true;
      this.playSound("brickBounce");
      this.damageBrick(brick);
      break;
    }
  }

  damageBrick(brick) {
    const points = brick.hit();
    const wasDestroyed = brick.destroyed;
    this.score += points;
    if (wasDestroyed) {
      this.maybeSpawnPowerUp(brick);
    }
    this.updateHud();
  }

  areDestructibleBricksCleared() {
    return this.bricks.every((brick) => brick.indestructible || brick.destroyed);
  }

  getActiveEffectText() {
    if (this.activeEffects.catch > 0) {
      return "Capture";
    }

    if (this.activeEffects.expand > 0) {
      return "Extension";
    }

    if (this.activeEffects.laser > 0) {
      return "Laser";
    }

    if (this.activeEffects.slow > 0) {
      return "Ralenti";
    }

    return "Aucun";
  }

  updateHud() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.highScore);
    }

    if (this.scoreNode) {
      this.scoreNode.textContent = formatHudScore(this.score);
    }

    if (this.highScoreNode) {
      this.highScoreNode.textContent = formatHudScore(this.highScore);
    }

    if (this.levelNode) {
      this.levelNode.textContent = `${this.levelIndex + 1} - ${this.levels[this.levelIndex].name}`;
    }

    if (this.statusNode) {
      this.statusNode.textContent = this.statusText;
    }

    if (this.livesNode) {
      this.livesNode.textContent = String(this.lives);
    }

    if (this.effectNode) {
      this.effectNode.textContent = this.getActiveEffectText();
    }
  }

  updateEffectHud() {
    if (this.effectNode) {
      this.effectNode.textContent = this.getActiveEffectText();
    }
  }

  playSound(key) {
    this.sounds?.play(key);
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderBackdrop();
    this.renderBricks();
    this.renderEnemies();
    this.renderEnemyExplosions();
    this.renderPowerUps();
    this.renderLasers();
    this.renderPaddle();
    this.renderBalls();
    this.renderLives();
  }

  renderBackdrop() {
    this.renderStaticBackdrop();

    if (!this.shouldDrawDecorativeOverlays()) {
      return;
    }

    if (this.pendingTransitionReason === "warp") {
      const warpElapsed = GAME_CONFIG.warp.transitionDuration - this.levelCompleteCooldown;
      drawSprite(this.ctx, this.sprites.doorTopLeft, {
        x: GAME_CONFIG.playfield.left,
        y: GAME_CONFIG.frame.y,
        width: GAME_CONFIG.playfield.width,
        height: GAME_CONFIG.frame.topThickness
      }, undefined, warpElapsed, false);
      drawSprite(this.ctx, this.sprites.doorTopRight, {
        x: GAME_CONFIG.playfield.left,
        y: GAME_CONFIG.frame.y,
        width: GAME_CONFIG.playfield.width,
        height: GAME_CONFIG.frame.topThickness
      }, undefined, warpElapsed, false);
    } else {
      for (const animation of this.enemyDoorAnimations) {
        const sprite = animation.side === "left" ? this.sprites.doorTopLeft : this.sprites.doorTopRight;
        drawSprite(this.ctx, sprite, {
          x: GAME_CONFIG.playfield.left,
          y: GAME_CONFIG.frame.y,
          width: GAME_CONFIG.playfield.width,
          height: GAME_CONFIG.frame.topThickness
        }, undefined, animation.elapsed, false);
      }
    }

    drawSprite(this.ctx, this.sprites.frameLeft, {
      x: GAME_CONFIG.frame.x,
      y: GAME_CONFIG.frame.y,
      width: GAME_CONFIG.frame.wallThickness,
      height: GAME_CONFIG.frame.height
    }, () => {
      this.ctx.fillStyle = "#a6afbb";
      this.ctx.fillRect(
        GAME_CONFIG.frame.x,
        GAME_CONFIG.frame.y,
        GAME_CONFIG.frame.wallThickness,
        GAME_CONFIG.frame.height
      );
    });

    drawSprite(this.ctx, this.sprites.frameRight, {
      x: GAME_CONFIG.frame.x + GAME_CONFIG.frame.width - GAME_CONFIG.frame.wallThickness,
      y: GAME_CONFIG.frame.y,
      width: GAME_CONFIG.frame.wallThickness,
      height: GAME_CONFIG.frame.height
    }, () => {
      this.ctx.fillStyle = "#a6afbb";
      this.ctx.fillRect(
        GAME_CONFIG.frame.x + GAME_CONFIG.frame.width - GAME_CONFIG.frame.wallThickness,
        GAME_CONFIG.frame.y,
        GAME_CONFIG.frame.wallThickness,
        GAME_CONFIG.frame.height
      );
    });
  }

  shouldDrawDecorativeOverlays() {
    if (this.reducedPerformanceMode) {
      return false;
    }
    return true;
  }

  renderStaticBackdrop() {
    const backgroundId = this.levels[this.levelIndex]?.background ?? "blue-panel";
    const cacheKey = `${backgroundId}:${this.canvas.width}x${this.canvas.height}:reduced=${this.reducedPerformanceMode}`;

    if (!this.staticBackdropCache || this.staticBackdropCacheKey !== cacheKey) {
      const canvas = document.createElement("canvas");
      canvas.width = this.canvas.width;
      canvas.height = this.canvas.height;
      const ctx = canvas.getContext("2d", { alpha: false });
      this.drawStaticBackdrop(ctx);
      this.staticBackdropCache = canvas;
      this.staticBackdropCacheKey = cacheKey;
    }

    this.ctx.drawImage(this.staticBackdropCache, 0, 0);
  }

  drawStaticBackdrop(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "#05090f");
    gradient.addColorStop(1, "#02040b");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = "#010306";
    ctx.fillRect(
      GAME_CONFIG.playfield.left,
      GAME_CONFIG.playfield.top,
      GAME_CONFIG.playfield.width,
      GAME_CONFIG.frame.height - GAME_CONFIG.frame.topThickness
    );

    this.renderLevelBackground(ctx);

    if (this.shouldDrawDecorativeOverlays()) {
      this.drawPlayfieldGrid(ctx);
      this.drawBackdropLogo(ctx);
    }

    this.drawFrameSprites(ctx);
  }

  drawPlayfieldGrid(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      GAME_CONFIG.playfield.left,
      GAME_CONFIG.playfield.top,
      GAME_CONFIG.playfield.width,
      GAME_CONFIG.frame.height - GAME_CONFIG.frame.topThickness
    );
    ctx.clip();

    ctx.strokeStyle = "rgba(113, 162, 255, 0.08)";
    ctx.lineWidth = 1;

    for (let x = GAME_CONFIG.playfield.left; x < GAME_CONFIG.playfield.right; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, GAME_CONFIG.playfield.top);
      ctx.lineTo(x, GAME_CONFIG.frame.y + GAME_CONFIG.frame.height);
      ctx.stroke();
    }

    for (let y = GAME_CONFIG.playfield.top; y < GAME_CONFIG.frame.y + GAME_CONFIG.frame.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(GAME_CONFIG.playfield.left, y);
      ctx.lineTo(GAME_CONFIG.playfield.right, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawBackdropLogo(ctx) {
    if (!this.sprites?.logo) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = 0.18;
    drawSprite(ctx, this.sprites.logo, {
      x: (this.canvas.width / 2) - 140,
      y: 24,
      width: 280,
      height: 102
    });
    ctx.restore();
  }

  drawFrameSprites(ctx) {
    drawSprite(ctx, this.sprites.frameTop, {
      x: GAME_CONFIG.playfield.left,
      y: GAME_CONFIG.frame.y,
      width: GAME_CONFIG.playfield.width,
      height: GAME_CONFIG.frame.topThickness
    }, () => {
      ctx.fillStyle = "#b6bcc7";
      ctx.fillRect(
        GAME_CONFIG.playfield.left,
        GAME_CONFIG.frame.y,
        GAME_CONFIG.playfield.width,
        GAME_CONFIG.frame.topThickness
      );
    });

    drawSprite(ctx, this.sprites.frameLeft, {
      x: GAME_CONFIG.frame.x,
      y: GAME_CONFIG.frame.y,
      width: GAME_CONFIG.frame.wallThickness,
      height: GAME_CONFIG.frame.height
    }, () => {
      ctx.fillStyle = "#a6afbb";
      ctx.fillRect(
        GAME_CONFIG.frame.x,
        GAME_CONFIG.frame.y,
        GAME_CONFIG.frame.wallThickness,
        GAME_CONFIG.frame.height
      );
    });

    drawSprite(ctx, this.sprites.frameRight, {
      x: GAME_CONFIG.frame.x + GAME_CONFIG.frame.width - GAME_CONFIG.frame.wallThickness,
      y: GAME_CONFIG.frame.y,
      width: GAME_CONFIG.frame.wallThickness,
      height: GAME_CONFIG.frame.height
    }, () => {
      ctx.fillStyle = "#a6afbb";
      ctx.fillRect(
        GAME_CONFIG.frame.x + GAME_CONFIG.frame.width - GAME_CONFIG.frame.wallThickness,
        GAME_CONFIG.frame.y,
        GAME_CONFIG.frame.wallThickness,
        GAME_CONFIG.frame.height
      );
    });
  }

  renderLevelBackground(ctx = this.ctx) {
    const backgroundId = this.levels[this.levelIndex]?.background;
    const background = LEVEL_BACKGROUND_LIBRARY[backgroundId] ?? LEVEL_BACKGROUND_LIBRARY["blue-panel"];
    const left = GAME_CONFIG.playfield.left;
    const top = GAME_CONFIG.playfield.top;
    const width = GAME_CONFIG.playfield.width;
    const height = GAME_CONFIG.frame.height - GAME_CONFIG.frame.topThickness;
    const cacheKey = `${background.id}:${width}x${height}`;

    let cached = this.levelBackgroundCache.get(cacheKey);
    if (!cached) {
      cached = this.createLevelBackgroundCanvas(background, width, height);
      this.levelBackgroundCache.set(cacheKey, cached);
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cached, left, top);
    ctx.restore();
  }

  createLevelBackgroundCanvas(background, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    switch (background.pattern) {
      case "green-grain":
        this.drawGreenGrainPanel(ctx, background, 0, 0, width, height);
        break;
      case "blue-circuit":
        this.drawBlueCircuitPanel(ctx, background, 0, 0, width, height);
        break;
      case "red-mechanic":
        this.drawRedMechanicPanel(ctx, background, 0, 0, width, height);
        break;
      case "blue-texture":
      default:
        this.drawBlueTexturePanel(ctx, background, 0, 0, width, height);
        break;
    }

    return canvas;
  }

  drawBlueTexturePanel(ctx, background, left, top, width, height) {
    const palette = background.colors;
    const step = 4;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const wave = Math.sin((x + y * 1.35) * 0.075) + Math.sin((x * 0.36 - y * 0.18) * 0.11) * 0.55;
        const noise = pseudoNoise2D(x >> 2, y >> 2, 17) * 1.25;
        const value = wave + noise;
        const index = value < -0.45 ? 0 : value < 0.25 ? 1 : value < 1.05 ? 2 : 3;
        ctx.fillStyle = palette[index];
        ctx.fillRect(left + x, top + y, step, step);
      }
    }

    ctx.fillStyle = hexToRgba(background.secondaryAccent, 0.16);
    for (let y = -20; y < height; y += 54) {
      ctx.beginPath();
      ctx.moveTo(left, top + y + 10);
      ctx.lineTo(left + width, top + y - 52);
      ctx.lineTo(left + width, top + y - 38);
      ctx.lineTo(left, top + y + 24);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawGreenGrainPanel(ctx, background, left, top, width, height) {
    const palette = background.colors;
    const step = 3;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const fine = pseudoNoise2D(x, y, 31);
        const broad = pseudoNoise2D(Math.floor(x / 18), Math.floor(y / 18), 43);
        const value = fine * 0.72 + broad * 0.28;
        const index = value < 0.2 ? 0 : value < 0.52 ? 1 : value < 0.86 ? 2 : 3;
        ctx.fillStyle = palette[index];
        ctx.fillRect(left + x, top + y, step, step);
      }
    }

    ctx.fillStyle = hexToRgba(background.secondaryAccent, 0.32);
    for (let index = 0; index < 230; index += 1) {
      const x = left + Math.floor(pseudoRandom(index, 211) * width / 3) * 3;
      const y = top + Math.floor(pseudoRandom(index, 223) * height / 3) * 3;
      ctx.fillRect(x, y, 3, 3);
    }
  }

  drawBlueCircuitPanel(ctx, background, left, top, width, height) {
    ctx.fillStyle = background.colors[0];
    ctx.fillRect(left, top, width, height);

    ctx.fillStyle = background.colors[1];
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        if (pseudoNoise2D(x, y, 59) > 0.82) {
          ctx.fillRect(left + x, top + y, 4, 4);
        }
      }
    }

    const cell = 32;
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        this.drawCircuitCell(ctx, left + x, top + y, cell, background, x, y);
      }
    }
  }

  drawCircuitCell(ctx, x, y, size, background, gridX, gridY) {
    const variant = Math.floor(pseudoNoise2D(gridX, gridY, 71) * 4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#00091e";
    this.strokeOrthogonalPath(ctx, x + 5, y + 8, [[x + 22, y + 8], [x + 22, y + 18], [x + 13, y + 18]]);
    this.strokeOrthogonalPath(ctx, x + 7, y + 26, [[x + 26, y + 26], [x + 26, y + 14]]);

    ctx.lineWidth = 2;
    ctx.strokeStyle = background.accent;
    this.strokeOrthogonalPath(ctx, x + 4, y + 7, [[x + 21, y + 7], [x + 21, y + 17], [x + 12, y + 17]]);
    this.strokeOrthogonalPath(ctx, x + 6, y + 25, [[x + 25, y + 25], [x + 25, y + 13]]);

    ctx.fillStyle = background.secondaryAccent;
    ctx.fillRect(x + 10, y + 15, 5, 5);
    ctx.fillRect(x + 23, y + 11, 4, 4);
    if (variant % 2 === 0) {
      ctx.fillRect(x + 4, y + 4, 5, 5);
    } else {
      ctx.strokeRect(x + 16, y + 3, 10, 10);
    }
  }

  drawRedMechanicPanel(ctx, background, left, top, width, height) {
    const greyPalette = [background.colors[0], background.colors[1], background.colors[2]];
    const step = 4;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const noise = pseudoNoise2D(x, y, 97);
        const index = noise < 0.34 ? 0 : noise < 0.72 ? 1 : 2;
        ctx.fillStyle = greyPalette[index];
        ctx.fillRect(left + x, top + y, step, step);
      }
    }

    const cell = 34;
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        this.drawRedMechanicalCell(ctx, left + x, top + y, cell, background);
      }
    }
  }

  drawRedMechanicalCell(ctx, x, y, size, background) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#260808";
    this.strokeOrthogonalPath(ctx, x + 17, y + 3, [[x + 17, y + 31]]);
    this.strokeOrthogonalPath(ctx, x + 3, y + 17, [[x + 31, y + 17]]);

    ctx.lineWidth = 2;
    ctx.strokeStyle = background.accent;
    this.strokeOrthogonalPath(ctx, x + 16, y + 3, [[x + 16, y + 31]]);
    this.strokeOrthogonalPath(ctx, x + 3, y + 16, [[x + 31, y + 16]]);
    ctx.strokeRect(x + 10, y + 10, 12, 12);

    ctx.fillStyle = background.secondaryAccent;
    ctx.fillRect(x + 6, y + 14, 5, 5);
    ctx.fillRect(x + 23, y + 14, 5, 5);
    ctx.fillRect(x + 14, y + 6, 5, 5);
    ctx.fillRect(x + 14, y + 23, 5, 5);
  }


  strokeOrthogonalPath(ctx, startX, startY, points) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    for (const [x, y] of points) {
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  renderPaddle() {
    const { sprite, elapsed, loop, bounds } = this.getPaddleSpriteState();

    drawSprite(this.ctx, sprite, bounds, () => {
      this.ctx.fillStyle = "#f7d35b";
      this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    }, elapsed, loop);
  }

  renderBalls() {
    for (const ball of this.balls) {
      drawSprite(this.ctx, this.sprites.ball, {
        x: ball.x - ball.radius,
        y: ball.y - ball.radius,
        width: ball.radius * 2,
        height: ball.radius * 2
      }, () => {
        this.ctx.fillStyle = "#ffffff";
        this.ctx.beginPath();
        this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }
  }

  renderBricks() {
    for (const brick of this.bricks) {
      if (brick.destroyed) {
        continue;
      }

      const sprite = brick.hitAnimationActive
        ? this.sprites.brickSilverHit
        : this.sprites[getBrickSpriteKey(brick)];

      drawSprite(this.ctx, sprite, brick, () => {
        this.ctx.fillStyle = brick.indestructible ? "#e0b84a" : brick.type === "hard" ? "#c8d1de" : "#9cf27a";
        this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      }, brick.hitAnimationElapsed, false);
    }
  }

  renderEnemies() {
    for (const enemy of this.enemies) {
      drawSprite(this.ctx, this.sprites[enemy.spriteKey], enemy, () => {
        this.ctx.fillStyle = "#ff6b6b";
        this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
      }, enemy.elapsed, true);
    }
  }

  renderEnemyExplosions() {
    for (const explosion of this.enemyExplosions) {
      drawSprite(this.ctx, this.sprites.enemyExplosion, explosion, undefined, explosion.elapsed, false);
    }
  }

  renderPowerUps() {
    for (const powerUp of this.powerUps) {
      drawSprite(this.ctx, this.sprites[powerUp.spriteKey], powerUp, () => {
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
      }, powerUp.elapsed, true);
    }
  }

  renderLasers() {
    for (const laser of this.lasers) {
      drawSprite(this.ctx, this.sprites.laserBullet, laser, () => {
        this.ctx.fillStyle = "#ffd84d";
        this.ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
      });
    }
  }

  renderLives() {
    if (!this.sprites?.paddleLife) {
      return;
    }

    for (let index = 0; index < this.lives; index += 1) {
      drawSprite(this.ctx, this.sprites.paddleLife, {
        x: GAME_CONFIG.playfield.left + 10 + (index * 24),
        y: this.canvas.height - 24,
        width: 20,
        height: 8
      });
    }
  }

  getPaddleSpriteState() {
    if (this.paddleDestruction) {
      const explodeImage = getSpriteImage(
        this.sprites?.paddleExplode,
        this.paddleDestruction.elapsed,
        false
      );
      const explodeWidth = explodeImage?.width ?? this.sprites?.paddleExplode?.width ?? GAME_CONFIG.paddle.baseWidth;
      const explodeHeight = explodeImage?.height ?? this.sprites?.paddleExplode?.height ?? GAME_CONFIG.paddle.height;
      return {
        sprite: this.sprites.paddleExplode,
        elapsed: this.paddleDestruction.elapsed,
        loop: false,
        bounds: {
          x: this.paddle.centerX - (explodeWidth / 2),
          y: this.paddle.y + this.paddle.height - explodeHeight,
          width: explodeWidth,
          height: explodeHeight
        }
      };
    }

    if (this.paddleRespawnElapsed < GAME_CONFIG.paddle.materializeDuration) {
      return {
        sprite: this.sprites.paddleMaterialize,
        elapsed: this.paddleRespawnElapsed,
        loop: false,
        bounds: {
          x: this.paddle.x,
          y: this.paddle.y,
          width: this.paddle.width,
          height: this.paddle.height
        }
      };
    }

    if (this.paddleWidthTransition) {
      return {
        sprite: this.paddleWidthTransition.mode === "expand"
          ? this.sprites.paddleWideTransition
          : this.sprites.paddleShrinkTransition,
        elapsed: this.paddleWidthTransition.elapsed,
        loop: false,
        bounds: {
          x: this.paddle.x,
          y: this.paddle.y,
          width: this.paddle.width,
          height: this.paddle.height
        }
      };
    }

    if (this.activeEffects.laser > 0) {
      const laserTransitionDuration = getAnimationDuration(this.sprites.paddleLaser);
      return {
        sprite: this.sprites.paddleLaser,
        elapsed: Math.min(this.paddleLaserTransitionElapsed, laserTransitionDuration),
        loop: false,
        bounds: {
          x: this.paddle.x,
          y: this.paddle.y,
          width: this.paddle.width,
          height: this.paddle.height
        }
      };
    }

    if (this.activeEffects.expand > 0) {
      return {
        sprite: this.hasStuckBalls() ? this.sprites.paddleWidePulsate : this.sprites.paddleWide,
        elapsed: this.elapsed,
        loop: this.hasStuckBalls(),
        bounds: {
          x: this.paddle.x,
          y: this.paddle.y,
          width: this.paddle.width,
          height: this.paddle.height
        }
      };
    }

    if (this.hasStuckBalls()) {
      return {
        sprite: this.sprites.paddlePulsate,
        elapsed: this.elapsed,
        loop: true,
        bounds: {
          x: this.paddle.x,
          y: this.paddle.y,
          width: this.paddle.width,
          height: this.paddle.height
        }
      };
    }

    return {
      sprite: this.sprites.paddle,
      elapsed: 0,
      loop: false,
      bounds: {
        x: this.paddle.x,
        y: this.paddle.y,
        width: this.paddle.width,
        height: this.paddle.height
      }
    };
  }
}

function buildBricks(layout) {
  return buildBrickPlacements(layout).map((placement) => new Brick(placement));
}

function formatHudScore(score) {
  return String(Math.max(0, Math.trunc(score))).padStart(6, "0");
}

function loadHighScore() {
  try {
    if (!globalThis.localStorage) {
      return 0;
    }

    const value = Number.parseInt(globalThis.localStorage.getItem(HIGH_SCORE_STORAGE_KEY), 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (error) {
    console.warn("Meilleur score local indisponible", error);
    return 0;
  }
}

function saveHighScore(score) {
  try {
    if (!globalThis.localStorage) {
      return;
    }

    globalThis.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(Math.max(0, Math.trunc(score))));
  } catch (error) {
    console.warn("Sauvegarde du meilleur score indisponible", error);
  }
}

function getBrickSpriteKey(brick) {
  if (brick.indestructible) {
    return "brickGold";
  }

  if (brick.type === "hard") {
    return brick.hitsRemaining > 1 ? "brickSilverBase" : "brickSilver1";
  }

  return brick.spriteKey;
}

function pickWeightedDefinition(library) {
  const entries = Object.values(library);
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);

  if (totalWeight <= 0) {
    return null;
  }

  let cursor = Math.random() * totalWeight;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry;
    }
  }

  return entries[entries.length - 1] ?? null;
}

function getRandomEnemySpawnDelay() {
  return randomRange(GAME_CONFIG.enemies.spawnDelayMin, GAME_CONFIG.enemies.spawnDelayMax);
}

function getEnemyBrickCollisionCircle(enemyRect) {
  return {
    x: enemyRect.x + (enemyRect.width / 2),
    y: enemyRect.y + (enemyRect.height / 2),
    radius: Math.max(
      4,
      Math.min(enemyRect.width, enemyRect.height) * GAME_CONFIG.enemies.brickCollisionRadiusScale
    )
  };
}

function randomRange(min, max) {
  return min + (Math.random() * (max - min));
}

function rotateVector(x, y, angle) {
  return {
    x: (x * Math.cos(angle)) - (y * Math.sin(angle)),
    y: (x * Math.sin(angle)) + (y * Math.cos(angle))
  };
}

function isRectColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function resolveBallRectResponse(ball, rect) {
  const wasAbove = ball.previousY + ball.radius <= rect.y;
  const wasBelow = ball.previousY - ball.radius >= rect.y + rect.height;
  const wasLeft = ball.previousX + ball.radius <= rect.x;
  const wasRight = ball.previousX - ball.radius >= rect.x + rect.width;

  if (wasAbove) {
    ball.y = rect.y - ball.radius - 1;
    ball.dy = -Math.abs(ball.dy);
    return;
  }

  if (wasBelow) {
    ball.y = rect.y + rect.height + ball.radius + 1;
    ball.dy = Math.abs(ball.dy);
    return;
  }

  if (wasLeft) {
    ball.x = rect.x - ball.radius - 1;
    ball.dx = -Math.abs(ball.dx);
    return;
  }

  if (wasRight) {
    ball.x = rect.x + rect.width + ball.radius + 1;
    ball.dx = Math.abs(ball.dx);
    return;
  }

  const overlapX = Math.min(
    Math.abs((ball.x + ball.radius) - rect.x),
    Math.abs((rect.x + rect.width) - (ball.x - ball.radius))
  );
  const overlapY = Math.min(
    Math.abs((ball.y + ball.radius) - rect.y),
    Math.abs((rect.y + rect.height) - (ball.y - ball.radius))
  );

  if (overlapX < overlapY) {
    ball.dx *= -1;
  } else {
    ball.dy *= -1;
  }
}

function getSpriteImage(sprite, elapsed = 0, loop = true) {
  if (!sprite) {
    return null;
  }

  if (sprite.image && (!sprite.frameImages || sprite.frameImages.length === 0)) {
    return sprite.image;
  }

  if (!sprite.frameImages || sprite.frameImages.length === 0) {
    return sprite.image ?? null;
  }

  const rawIndex = Math.max(0, Math.floor(elapsed * (sprite.fps ?? 8)));
  const index = loop
    ? rawIndex % sprite.frameImages.length
    : Math.min(rawIndex, sprite.frameImages.length - 1);

  return sprite.frameImages[index] ?? sprite.image ?? null;
}

function getAnimationDuration(sprite) {
  if (!sprite?.frameImages?.length) {
    return 0;
  }

  return sprite.frameImages.length / (sprite.fps ?? 8);
}

function pseudoRandom(index, salt) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function pseudoNoise2D(x, y, salt) {
  const value = Math.sin((x + 1) * 127.1 + (y + 1) * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function bottomEdge(top, height) {
  return top + height;
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawSprite(ctx, sprite, bounds, fallback = () => {}, elapsed = 0, loop = true) {
  const image = getSpriteImage(sprite, elapsed, loop);

  if (image) {
    ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height);
    return;
  }

  fallback();
}
