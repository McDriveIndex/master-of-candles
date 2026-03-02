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

const PLAYER_SPEED = 120;
const SPAWN_INTERVAL_MS = 650;
const MIN_SPAWN_DISTANCE = 28;
const MAX_SPAWN_ATTEMPTS = 8;

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
    private lastSpawnX: number | null = null;
    private candleSpawnEvent?: Phaser.Time.TimerEvent;

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

      this.add
        .text(width / 2, 16, "PLAY SCENE", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#f5f5f5",
          align: "center",
        })
        .setOrigin(0.5);

      this.add
        .text(width / 2, 34, "ARROWS / A-D MOVE | ESC OR SPACE FOR GAME OVER", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#d4d4d4",
          align: "center",
        })
        .setOrigin(0.5);

      this.movementKeys = this.input.keyboard?.addKeys({
        left: PhaserLib.Input.Keyboard.KeyCodes.LEFT,
        right: PhaserLib.Input.Keyboard.KeyCodes.RIGHT,
        a: PhaserLib.Input.Keyboard.KeyCodes.A,
        d: PhaserLib.Input.Keyboard.KeyCodes.D,
      }) as MovementKeys | undefined;

      const goGameOver = () => {
        this.scene.start(GAME_OVER_SCENE_KEY);
      };

      this.input.keyboard?.once("keydown-ESC", goGameOver);
      this.input.keyboard?.once("keydown-SPACE", goGameOver);

      this.candleSpawnEvent = this.time.addEvent({
        delay: SPAWN_INTERVAL_MS,
        loop: true,
        callback: () => this.spawnCandle(),
      });

      this.events.once(PhaserLib.Scenes.Events.SHUTDOWN, () => {
        this.candleSpawnEvent?.remove();
        this.candleSpawnEvent = undefined;
        this.lastSpawnX = null;

        for (const candle of this.candles) {
          candle.destroy();
        }
        this.candles = [];
      });
    }

    update() {
      if (!this.player || !this.movementKeys) {
        return;
      }

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

      this.candles = this.candles.filter(
        (candle) => !candle.destroyIfOutOfBounds(this.scale.height),
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

      const candleHeight = PhaserLib.Math.Between(CANDLE_MIN_HEIGHT, CANDLE_MAX_HEIGHT);
      const spawnY = -candleHeight / 2 - 2;
      const candle = new Candle(this, x, spawnY, candleHeight);

      this.candles.push(candle);
      this.lastSpawnX = x;
    }
  };
}
