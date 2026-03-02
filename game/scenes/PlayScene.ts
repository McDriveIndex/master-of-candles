import type Phaser from "phaser";

import {
  Candle,
  CANDLE_MAX_HEIGHT,
  CANDLE_MIN_HEIGHT,
  CANDLE_WIDTH,
} from "../entities/Candle";
import { Player } from "../entities/Player";
import { GAME_OVER_SCENE_KEY } from "./GameOverScene";

export const PLAY_SCENE_KEY = "PlayScene";
const PERSONAL_BEST_STORAGE_KEY = "moc_personal_best_ms";

const PLAYER_SPEED = 120;
const SPAWN_INTERVAL_MS = 650;
const MIN_SPAWN_DISTANCE = 28;
const MAX_SPAWN_ATTEMPTS = 8;
const DEATH_FREEZE_MS = 250;
const DEATH_SHAKE_DURATION_MS = 120;
const DEATH_SHAKE_INTENSITY = 0.004;
const DEATH_FADE_DURATION_MS = 300;

type MovementKeys = {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
};

export function createPlayScene(PhaserLib: typeof Phaser) {
  return class PlayScene extends PhaserLib.Scene {
    private player?: Player;
    private movementKeys?: MovementKeys;
    private fixedPlayerY = 0;
    private candles: Candle[] = [];
    private candlesGroup?: Phaser.GameObjects.Group;
    private lastSpawnX: number | null = null;
    private candleSpawnEvent?: Phaser.Time.TimerEvent;
    private playerCandleOverlap?: Phaser.Physics.Arcade.Collider;
    private deathDelayEvent?: Phaser.Time.TimerEvent;
    private isDying = false;
    private runStartMs = 0;
    private runTimeMs = 0;
    private bestMs = 0;
    private runFinalized = false;
    private timerText?: Phaser.GameObjects.Text;
    private bestText?: Phaser.GameObjects.Text;
    private timerUpdateEvent?: Phaser.Time.TimerEvent;

    constructor() {
      super(PLAY_SCENE_KEY);
    }

    create() {
      const { width, height } = this.scale;

      this.cameras.main.setBackgroundColor("#141414");

      this.physics.world.setBounds(0, 0, width, height);
      this.physics.world.setBoundsCollision(true, true, true, true);

      this.player = new Player(this, width / 2, height - 16);
      this.fixedPlayerY = height - 16;
      this.isDying = false;
      this.runFinalized = false;
      this.runTimeMs = 0;
      this.bestMs = this.loadBestMs();
      this.runStartMs = this.nowMs();
      this.player.gameObject.setDepth(20);
      this.candlesGroup = this.add.group();

      const titleText = this.add
        .text(width / 2, 16, "PLAY SCENE", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#f5f5f5",
          align: "center",
        })
        .setOrigin(0.5);
      titleText.setDepth(100);

      const instructionsText = this.add
        .text(width / 2, 34, "ARROWS / A-D MOVE | ESC OR SPACE FOR GAME OVER", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#d4d4d4",
          align: "center",
        })
        .setOrigin(0.5);
      instructionsText.setDepth(100);

      this.timerText = this.add
        .text(8, 8, `RUN: ${this.formatMs(0)}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#f5f5f5",
        })
        .setOrigin(0, 0);
      this.timerText.setDepth(120);

      this.bestText = this.add
        .text(8, 20, `PB: ${this.formatMs(this.bestMs)}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#d4d4d4",
        })
        .setOrigin(0, 0);
      this.bestText.setDepth(120);

      this.timerUpdateEvent = this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          const elapsedMs = this.nowMs() - this.runStartMs;
          this.timerText?.setText(`RUN: ${this.formatMs(elapsedMs)}`);
        },
      });

      this.movementKeys = this.input.keyboard?.addKeys({
        left: PhaserLib.Input.Keyboard.KeyCodes.LEFT,
        right: PhaserLib.Input.Keyboard.KeyCodes.RIGHT,
        a: PhaserLib.Input.Keyboard.KeyCodes.A,
        d: PhaserLib.Input.Keyboard.KeyCodes.D,
      }) as MovementKeys | undefined;

      const goGameOver = () => {
        this.deathDelayEvent?.remove();
        this.deathDelayEvent = undefined;
        this.candleSpawnEvent?.remove();
        this.candleSpawnEvent = undefined;
        this.finalizeRun();
        this.isDying = false;
        this.physics?.world?.resume();
        this.scene.start(GAME_OVER_SCENE_KEY, { runTimeMs: this.runTimeMs, bestMs: this.bestMs });
      };

      this.input.keyboard?.once("keydown-ESC", goGameOver);
      this.input.keyboard?.once("keydown-SPACE", goGameOver);

      this.playerCandleOverlap = this.physics.add.overlap(
        this.player.gameObject,
        this.candlesGroup,
        () => this.onPlayerHitByCandle(),
      );

      this.candleSpawnEvent = this.time.addEvent({
        delay: SPAWN_INTERVAL_MS,
        loop: true,
        callback: () => this.spawnCandle(),
      });

      this.events.once(PhaserLib.Scenes.Events.SHUTDOWN, () => {
        this.candleSpawnEvent?.remove();
        this.candleSpawnEvent = undefined;
        this.timerUpdateEvent?.remove();
        this.timerUpdateEvent = undefined;
        this.deathDelayEvent?.remove();
        this.deathDelayEvent = undefined;
        this.lastSpawnX = null;
        this.isDying = false;
        this.cameras?.main?.off(
          PhaserLib.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
          this.onDeathFadeOutComplete,
          this,
        );

        this.playerCandleOverlap?.destroy();
        this.playerCandleOverlap = undefined;

        for (const candle of this.candles) {
          candle.destroy();
        }
        this.candles = [];
        this.candlesGroup?.destroy(true);
        this.candlesGroup = undefined;
        this.timerText = undefined;
        this.bestText = undefined;

        this.physics?.world?.resume();
      });
    }

    update() {
      if (!this.player || !this.movementKeys) {
        return;
      }

      if (!this.isDying) {
        const moveLeft = this.movementKeys.left.isDown || this.movementKeys.a.isDown;
        const moveRight = this.movementKeys.right.isDown || this.movementKeys.d.isDown;

        // If both directions are pressed together, stop to avoid conflicting input.
        if (moveLeft === moveRight) {
          this.player.stopX();
        } else if (moveLeft) {
          this.player.setVelocityX(-PLAYER_SPEED);
        } else {
          this.player.setVelocityX(PLAYER_SPEED);
        }

        this.player.setY(this.fixedPlayerY);
        this.player.clampToWorld(this.scale.width);
      }

      this.candles = this.candles.filter(
        (candle) => {
          const destroyed = candle.destroyIfOutOfBounds(this.scale.height);
          if (destroyed) {
            this.candlesGroup?.remove(candle.gameObject);
          }
          return !destroyed;
        },
      );
    }

    private spawnCandle() {
      const { width } = this.scale;
      const halfW = CANDLE_WIDTH / 2;
      const minX = halfW;
      const maxX = width - halfW;

      let x = PhaserLib.Math.Between(minX, maxX);
      for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt += 1) {
        if (this.lastSpawnX === null || Math.abs(x - this.lastSpawnX) >= MIN_SPAWN_DISTANCE) {
          break;
        }

        x = PhaserLib.Math.Between(minX, maxX);
      }

      x = PhaserLib.Math.Clamp(x, minX, maxX);
      let candleHeight = PhaserLib.Math.Between(CANDLE_MIN_HEIGHT, CANDLE_MAX_HEIGHT);
      if (!Number.isFinite(x)) {
        x = width / 2;
      }
      if (!Number.isFinite(candleHeight)) {
        candleHeight = 60;
      }
      const spawnY = -candleHeight / 2 - 2;
      const candle = new Candle(this, x, spawnY, candleHeight);
      candle.gameObject.setDepth(10);

      this.candles.push(candle);
      this.candlesGroup?.add(candle.gameObject);
      this.lastSpawnX = x;
    }

    private onPlayerHitByCandle() {
      if (this.isDying || !this.player) {
        return;
      }

      this.isDying = true;
      this.finalizeRun();
      this.player.stopX();
      this.candleSpawnEvent?.remove();
      this.candleSpawnEvent = undefined;
      this.physics?.world?.pause();

      this.deathDelayEvent = this.time.delayedCall(DEATH_FREEZE_MS, () => {
        if (!this.scene.isActive()) {
          return;
        }

        const cam = this.cameras?.main;
        if (!cam) {
          this.physics?.world?.resume();
          return;
        }

        cam.shake(DEATH_SHAKE_DURATION_MS, DEATH_SHAKE_INTENSITY);
        cam.once(
          PhaserLib.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
          this.onDeathFadeOutComplete,
          this,
        );
        cam.fadeOut(DEATH_FADE_DURATION_MS, 0, 0, 0);
      });
    }

    private onDeathFadeOutComplete() {
      this.physics?.world?.resume();
      this.scene.start(GAME_OVER_SCENE_KEY, { runTimeMs: this.runTimeMs, bestMs: this.bestMs });
    }

    private formatMs(ms: number): string {
      return `${(ms / 1000).toFixed(1)}s`;
    }

    private loadBestMs(): number {
      try {
        if (typeof window === "undefined") {
          return 0;
        }
        const rawValue = window.localStorage.getItem(PERSONAL_BEST_STORAGE_KEY);
        if (!rawValue) {
          return 0;
        }
        const parsed = Number(rawValue);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      } catch {
        return 0;
      }
    }

    private saveBestMs(ms: number): void {
      try {
        if (typeof window === "undefined") {
          return;
        }
        window.localStorage.setItem(PERSONAL_BEST_STORAGE_KEY, String(ms));
      } catch {
        // Ignore storage errors to keep gameplay stable.
      }
    }

    private finalizeRun(): void {
      if (this.runFinalized) {
        return;
      }

      this.runFinalized = true;
      this.timerUpdateEvent?.remove();
      this.timerUpdateEvent = undefined;

      this.runTimeMs = Math.max(0, this.nowMs() - this.runStartMs);
      this.timerText?.setText(`RUN: ${this.formatMs(this.runTimeMs)}`);

      if (this.runTimeMs > this.bestMs) {
        this.bestMs = this.runTimeMs;
        this.saveBestMs(this.bestMs);
      }

      this.bestText?.setText(`PB: ${this.formatMs(this.bestMs)}`);
    }

    private nowMs(): number {
      return typeof performance !== "undefined" ? performance.now() : Date.now();
    }
  };
}
