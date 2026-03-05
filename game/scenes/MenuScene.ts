import type Phaser from "phaser";
import { PLAY_SCENE_KEY } from "./PlayScene";

export const MENU_SCENE_KEY = "MenuScene";

export function createMenuScene(PhaserLib: typeof Phaser) {
  return class MenuScene extends PhaserLib.Scene {
    constructor() {
      super(MENU_SCENE_KEY);
    }

    create() {
      const { width, height } = this.scale;

      this.cameras.main.setBackgroundColor("#000000");

      this.add
        .text(width / 2, height / 2 - 16, "MASTER OF CANDLES", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#f5f5f5",
          align: "center",
        })
        .setOrigin(0.5);

      this.add
        .text(width / 2, height / 2 + 14, "PRESS SPACE TO PLAY", {
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
