import type Phaser from "phaser";
import { submitScore, type LeaderboardEntry, type SubmitResponse } from "../services/leaderboard";
import { PLAY_SCENE_KEY } from "./PlayScene";

export const GAME_OVER_SCENE_KEY = "GameOverScene";
const NICKNAME_STORAGE_KEY = "moc_nickname";
const NICKNAME_REGEX = /^[A-Za-z0-9_]{1,16}$/;

type GameOverData = {
  runTimeMs?: number;
  bestMs?: number;
};

export function createGameOverScene(PhaserLib: typeof Phaser) {
  return class GameOverScene extends PhaserLib.Scene {
    private top10Text?: Phaser.GameObjects.Text;
    private rankText?: Phaser.GameObjects.Text;
    private aroundHeaderText?: Phaser.GameObjects.Text;
    private statusText?: Phaser.GameObjects.Text;
    private aroundRowTexts: Phaser.GameObjects.Text[] = [];

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

      this.top10Text = this.add
        .text(10, 8, "TOP 10:\n—", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#f5f5f5",
          align: "left",
        })
        .setOrigin(0, 0);

      this.rankText = this.add
        .text(10, 88, "YOUR RANK: —", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#f5f5f5",
          align: "left",
        })
        .setOrigin(0, 0);

      this.aroundHeaderText = this.add
        .text(10, 100, "AROUND YOU:", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#d4d4d4",
          align: "left",
        })
        .setOrigin(0, 0);

      this.statusText = this.add
        .text(width / 2, height - 10, "", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#f5f5f5",
          align: "center",
        })
        .setOrigin(0.5, 1);

      void this.loadLeaderboard(runTimeMs);

      this.input.keyboard?.once("keydown-SPACE", () => {
        this.scene.start(PLAY_SCENE_KEY);
      });
    }

    private formatMs(ms: number): string {
      return `${(ms / 1000).toFixed(2)}s`;
    }

    private async loadLeaderboard(scoreMs: number): Promise<void> {
      if (!Number.isFinite(scoreMs)) {
        this.renderFallback();
        this.statusText?.setText("Leaderboard unavailable.");
        return;
      }
      const scoreMsInt = Math.floor(scoreMs);
      if (scoreMsInt <= 0) {
        this.renderFallback();
        this.statusText?.setText("Leaderboard unavailable.");
        return;
      }

      const storedNickname = this.getStoredNickname();
      let response = await submitScore(scoreMsInt, storedNickname);
      let statusMessage = "";

      if (response?.requireNickname) {
        const promptedNickname = this.promptForNickname(storedNickname);
        if (promptedNickname && this.isValidNickname(promptedNickname)) {
          this.saveNickname(promptedNickname);
          response = await submitScore(scoreMsInt, promptedNickname);
        } else {
          statusMessage = "Nickname required to enter Top 100. Score not saved.";
        }
      }

      if (!this.scene.isActive()) {
        return;
      }

      if (!response) {
        this.renderFallback();
        this.statusText?.setText("Leaderboard unavailable.");
        return;
      }

      if (response.requireNickname) {
        statusMessage = "Nickname required to enter Top 100. Score not saved.";
      } else if (response.saved) {
        statusMessage = "Score saved.";
      }

      this.statusText?.setText(statusMessage);
      this.renderLeaderboard(response);
    }

    private renderLeaderboard(response: SubmitResponse): void {
      const top10Lines = response.top10.map(
        (entry) => `${entry.rank}. ${entry.nickname}  ${this.formatMs(entry.scoreMs)}`,
      );
      this.top10Text?.setText(`TOP 10:\n${top10Lines.join("\n") || "—"}`);
      this.rankText?.setText(`YOUR RANK: ${response.yourRank}`);
      this.renderAroundYou(response.aroundYou, response.yourRank);
    }

    private renderFallback(): void {
      this.top10Text?.setText("TOP 10:\n—");
      this.rankText?.setText("YOUR RANK: —");
      this.renderAroundYou([], -1);
      this.statusText?.setText("");
    }

    private renderAroundYou(entries: LeaderboardEntry[], yourRank: number): void {
      for (const rowText of this.aroundRowTexts) {
        rowText.destroy();
      }
      this.aroundRowTexts = [];

      if (!entries.length) {
        const fallback = this.add
          .text(10, 112, "—", {
            fontFamily: "monospace",
            fontSize: "8px",
            color: "#d4d4d4",
            align: "left",
          })
          .setOrigin(0, 0);
        this.aroundRowTexts.push(fallback);
        return;
      }

      entries.forEach((entry, index) => {
        const isPlayerRow = entry.rank === yourRank;
        const line = this.add
          .text(10, 112 + index * 10, `${entry.rank}. ${entry.nickname}  ${this.formatMs(entry.scoreMs)}`, {
            fontFamily: "monospace",
            fontSize: "8px",
            color: isPlayerRow ? "#fff2b3" : "#d4d4d4",
            align: "left",
          })
          .setOrigin(0, 0);

        if (isPlayerRow) {
          line.setStroke("#fff2b3", 1);
          line.setShadow(0, 0, "#fff2b3", 3, true, true);
        }

        this.aroundRowTexts.push(line);
      });
    }

    private getStoredNickname(): string | undefined {
      try {
        if (typeof window === "undefined") {
          return undefined;
        }
        const raw = window.localStorage.getItem(NICKNAME_STORAGE_KEY);
        if (!raw) {
          return undefined;
        }
        const nickname = raw.trim();
        return this.isValidNickname(nickname) ? nickname : undefined;
      } catch {
        return undefined;
      }
    }

    private saveNickname(nickname: string): void {
      try {
        if (typeof window === "undefined") {
          return;
        }
        window.localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
      } catch {
        // Ignore storage failures to keep scene stable.
      }
    }

    private promptForNickname(defaultValue?: string): string | null {
      if (typeof window === "undefined") {
        return null;
      }
      const value = window.prompt("Enter nickname (A-Z, 0-9, _ max 16 chars)", defaultValue ?? "");
      if (value === null) {
        return null;
      }
      return value.trim();
    }

    private isValidNickname(value: string): boolean {
      return NICKNAME_REGEX.test(value);
    }
  };
}
