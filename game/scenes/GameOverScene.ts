import type Phaser from "phaser";
import { PLAY_SCENE_KEY } from "./PlayScene";

export const GAME_OVER_SCENE_KEY = "GameOverScene";

export function createGameOverScene(PhaserLib: typeof Phaser) {
  return class GameOverScene extends PhaserLib.Scene {
    constructor() {
      super(GAME_OVER_SCENE_KEY);
    }

    create() {
      const { width, height } = this.scale;

      this.cameras.main.setBackgroundColor("#1f0f0f");

      this.add
        .text(width / 2, height / 2 - 8, "GAME OVER", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#f5f5f5",
          align: "center",
        })
        .setOrigin(0.5);

      this.add
        .text(width / 2, height / 2 + 16, "PRESS SPACE TO RESTART", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#d4d4d4",
          align: "center",
        })
        .setOrigin(0.5);

      this.input.keyboard?.once("keydown-SPACE", () => {
        this.scene.start(PLAY_SCENE_KEY);
      });
    }
  };
}
