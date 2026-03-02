import type Phaser from "phaser";
import { PLAY_SCENE_KEY } from "./PlayScene";

export const GAME_OVER_SCENE_KEY = "GameOverScene";

type GameOverData = {
  runTimeMs?: number;
  bestMs?: number;
};

export function createGameOverScene(PhaserLib: typeof Phaser) {
  return class GameOverScene extends PhaserLib.Scene {
    constructor() {
      super(GAME_OVER_SCENE_KEY);
    }

    create(data?: GameOverData) {
      const { width, height } = this.scale;
      const rawRun = data?.runTimeMs;
      const rawBest = data?.bestMs;
      const runTimeMs = typeof rawRun === "number" && Number.isFinite(rawRun) && rawRun >= 0 ? rawRun : 0;
      const bestMs = typeof rawBest === "number" && Number.isFinite(rawBest) && rawBest >= 0 ? rawBest : 0;

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
        .text(width / 2, height / 2 + 10, `RUN: ${this.formatMs(runTimeMs)}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#f5f5f5",
          align: "center",
        })
        .setOrigin(0.5);

      this.add
        .text(width / 2, height / 2 + 26, `PB: ${this.formatMs(bestMs)}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#d4d4d4",
          align: "center",
        })
        .setOrigin(0.5);

      this.add
        .text(width / 2, height / 2 + 48, "PRESS SPACE TO RESTART", {
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

    private formatMs(ms: number): string {
      return `${(ms / 1000).toFixed(1)}s`;
    }
  };
}
