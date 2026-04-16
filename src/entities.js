import { GAME_CONFIG } from "./config.js";
import { clamp } from "./utils.js";

export class Paddle {
  constructor() {
    this.width = GAME_CONFIG.paddle.width;
    this.height = GAME_CONFIG.paddle.height;
    this.x = GAME_CONFIG.playfield.left + ((GAME_CONFIG.playfield.width - this.width) / 2);
    this.y = GAME_CONFIG.canvasHeight - GAME_CONFIG.paddle.bottomOffset - this.height;
  }

  update(dt, input) {
    if (input.pointerX !== null) {
      this.x = clamp(
        input.pointerX - (this.width / 2),
        GAME_CONFIG.playfield.left,
        GAME_CONFIG.playfield.right - this.width
      );
      return;
    }

    if (input.axis !== 0) {
      this.x = clamp(
        this.x + (input.axis * GAME_CONFIG.paddle.keyboardSpeed * dt),
        GAME_CONFIG.playfield.left,
        GAME_CONFIG.playfield.right - this.width
      );
    }
  }

  get centerX() {
    return this.x + (this.width / 2);
  }

  setWidth(width) {
    const centerX = this.centerX;
    this.width = width;
    this.x = clamp(
      centerX - (this.width / 2),
      GAME_CONFIG.playfield.left,
      GAME_CONFIG.playfield.right - this.width
    );
  }
}

export class Ball {
  constructor() {
    this.radius = GAME_CONFIG.ball.radius;
    this.stuckOffsetX = 0;
    this.resetPosition(0, 0);
    this.stuckToPaddle = true;
  }

  resetPosition(x, y) {
    this.x = x;
    this.y = y;
    this.previousX = x;
    this.previousY = y;
    this.dx = 0;
    this.dy = 0;
  }

  attachToPaddle(paddle, offsetX = 0) {
    this.stuckToPaddle = true;
    this.stuckOffsetX = clamp(
      offsetX,
      -(paddle.width / 2) + this.radius,
      (paddle.width / 2) - this.radius
    );
    this.resetPosition(paddle.centerX + this.stuckOffsetX, paddle.y - this.radius - 1);
  }

  syncWithPaddle(paddle) {
    if (!this.stuckToPaddle) {
      return;
    }

    this.resetPosition(paddle.centerX + this.stuckOffsetX, paddle.y - this.radius - 1);
  }

  launch() {
    if (!this.stuckToPaddle) {
      return;
    }

    this.stuckToPaddle = false;
    const launchRatio = clamp(this.stuckOffsetX / Math.max(1, GAME_CONFIG.paddle.expandedWidth / 2), -0.7, 0.7);
    this.dx = GAME_CONFIG.ball.launchSpeed * (0.15 + launchRatio);
    this.dy = -GAME_CONFIG.ball.launchSpeed;
    this.normalizeVelocity();
  }

  move(dt) {
    this.previousX = this.x;
    this.previousY = this.y;
    this.x += this.dx * dt;
    this.y += this.dy * dt;
  }

  normalizeVelocity() {
    const speed = Math.hypot(this.dx, this.dy) || GAME_CONFIG.ball.launchSpeed;
    const scale = GAME_CONFIG.ball.launchSpeed / speed;
    this.dx *= scale;
    this.dy *= scale;
  }

  setSpeed(speed) {
    const currentSpeed = Math.hypot(this.dx, this.dy);
    if (currentSpeed === 0) {
      return;
    }

    const scale = speed / currentSpeed;
    this.dx *= scale;
    this.dy *= scale;
  }

  clone() {
    const ball = new Ball();
    ball.radius = this.radius;
    ball.x = this.x;
    ball.y = this.y;
    ball.previousX = this.previousX;
    ball.previousY = this.previousY;
    ball.dx = this.dx;
    ball.dy = this.dy;
    ball.stuckToPaddle = this.stuckToPaddle;
    ball.stuckOffsetX = this.stuckOffsetX;
    return ball;
  }
}

export class Brick {
  constructor({ x, y, width, height, definition }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = definition.type;
    this.maxHits = definition.hits;
    this.hitsRemaining = definition.hits;
    this.points = definition.points;
    this.spriteKey = definition.spriteKey;
    this.indestructible = Boolean(definition.indestructible);
    this.destroyed = false;
    this.hitAnimationElapsed = 0;
    this.hitAnimationActive = false;
  }

  hit() {
    if (this.indestructible) {
      return 0;
    }

    this.hitsRemaining -= 1;

    if (this.hitsRemaining <= 0) {
      this.destroyed = true;
      this.hitAnimationActive = false;
      return this.points;
    }

    if (this.type === "hard") {
      this.hitAnimationElapsed = 0;
      this.hitAnimationActive = true;
    }

    return 0;
  }

  update(dt) {
    if (!this.hitAnimationActive) {
      return;
    }

    this.hitAnimationElapsed += dt;

    if (this.hitAnimationElapsed >= 10 / GAME_CONFIG.bricks.hardHitAnimationFps) {
      this.hitAnimationActive = false;
    }
  }
}

export class PowerUp {
  constructor({ x, y, definition }) {
    this.x = x;
    this.y = y;
    this.width = GAME_CONFIG.powerUps.width;
    this.height = GAME_CONFIG.powerUps.height;
    this.type = definition.type;
    this.label = definition.label;
    this.spriteKey = definition.spriteKey;
    this.collected = false;
    this.expired = false;
    this.elapsed = 0;
  }

  update(dt) {
    this.elapsed += dt;
    this.y += GAME_CONFIG.powerUps.fallSpeed * dt;

    if (this.y > GAME_CONFIG.canvasHeight) {
      this.expired = true;
    }
  }
}

export class LaserShot {
  constructor({ x, y }) {
    this.x = x;
    this.y = y;
    this.width = GAME_CONFIG.laser.width;
    this.height = GAME_CONFIG.laser.height;
    this.expired = false;
  }

  update(dt) {
    this.y -= GAME_CONFIG.laser.speed * dt;

    if (this.y + this.height < GAME_CONFIG.playfield.top) {
      this.expired = true;
    }
  }
}

export class Enemy {
  constructor({ x, y, definition, speed }) {
    this.x = x;
    this.y = y;
    this.width = definition.width;
    this.height = definition.height;
    this.type = definition.type;
    this.spriteKey = definition.spriteKey;
    this.speed = speed;
    this.dx = 0;
    this.dy = speed;
    this.elapsed = 0;
    this.decisionRemaining = 0;
    this.destroyed = false;
  }

  update(dt) {
    this.elapsed += dt;
    this.decisionRemaining = Math.max(0, this.decisionRemaining - dt);
  }

  setVelocity(dx, dy) {
    const magnitude = Math.hypot(dx, dy) || 1;
    this.dx = (dx / magnitude) * this.speed;
    this.dy = (dy / magnitude) * this.speed;
  }
}

export class EnemyExplosion {
  constructor({ x, y }) {
    this.width = 48;
    this.height = 50;
    this.x = x - (this.width / 2);
    this.y = y - (this.height / 2);
    this.elapsed = 0;
    this.expired = false;
  }

  update(dt) {
    this.elapsed += dt;

    if (this.elapsed >= 10 / GAME_CONFIG.enemies.explosionFps) {
      this.expired = true;
    }
  }
}
