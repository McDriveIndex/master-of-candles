import type Phaser from "phaser";

import { Player } from "../entities/Player";
import { GAME_OVER_SCENE_KEY } from "./GameOverScene";

export const PLAY_SCENE_KEY = "PlayScene";

const PLAYER_SPEED = 120;

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
    }
  };
}
