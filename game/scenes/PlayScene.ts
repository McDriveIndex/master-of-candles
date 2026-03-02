import type Phaser from "phaser";
import { GAME_OVER_SCENE_KEY } from "./GameOverScene";

export const PLAY_SCENE_KEY = "PlayScene";

export function createPlayScene(PhaserLib: typeof Phaser) {
  return class PlayScene extends PhaserLib.Scene {
    constructor() {
      super(PLAY_SCENE_KEY);
    }

    create() {
      const { width, height } = this.scale;

      this.cameras.main.setBackgroundColor("#141414");

      this.add
        .text(width / 2, height / 2 - 8, "PLAY SCENE", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#f5f5f5",
          align: "center",
        })
        .setOrigin(0.5);

      this.add
        .text(width / 2, height / 2 + 16, "PRESS ESC OR SPACE FOR GAME OVER", {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#d4d4d4",
          align: "center",
        })
        .setOrigin(0.5);

      const goGameOver = () => {
        this.scene.start(GAME_OVER_SCENE_KEY);
      };

      this.input.keyboard?.once("keydown-ESC", goGameOver);
      this.input.keyboard?.once("keydown-SPACE", goGameOver);
    }
  };
}
