import type Phaser from "phaser";
import { submitScore, type LeaderboardEntry, type SubmitResponse } from "../services/leaderboard";
import { PLAY_SCENE_KEY } from "./PlayScene";

export const GAME_OVER_SCENE_KEY = "GameOverScene";
const NICKNAME_STORAGE_KEY = "moc_nickname";
const NICKNAME_REGEX = /^[A-Za-z0-9_]{1,16}$/;
const TITLE_Y = 34;
const RUN_Y = 55;
const RESTART_Y = 74;
const TOP5_HEADER_Y = 88;
const TOP5_START_Y = 100;
const CONTEXT_HEADER_Y = 154;
const CONTEXT_START_Y = 166;
const LEADERBOARD_ROW_SPACING = 10;
const LEADERBOARD_NICKNAME_WIDTH = 16;
const LEADERBOARD_TIME_WIDTH = 7;
const LEADERBOARD_ROW_TOTAL_CHARS = 2 + 1 + LEADERBOARD_NICKNAME_WIDTH + 1 + LEADERBOARD_TIME_WIDTH;
const LEADERBOARD_BLOCK_WIDTH = 152;

type GameOverData = {
  runTimeMs?: number;
  bestMs?: number;
};

export function createGameOverScene(PhaserLib: typeof Phaser) {
  return class GameOverScene extends PhaserLib.Scene {
    private contextHeaderText?: Phaser.GameObjects.Text;
    private statusText?: Phaser.GameObjects.Text;
    private top5RowTexts: Phaser.GameObjects.Text[] = [];
    private contextRowTexts: Phaser.GameObjects.Text[] = [];
    private titleGlowTween?: Phaser.Tweens.Tween;
    private restartPromptTween?: Phaser.Tweens.Tween;
    private playerHighlightTween?: Phaser.Tweens.Tween;

    constructor() {
      super(GAME_OVER_SCENE_KEY);
    }

    create(data?: GameOverData) {
      const { width, height } = this.scale;
      const rawRun = data?.runTimeMs;
      const runTimeMs = typeof rawRun === "number" && Number.isFinite(rawRun) && rawRun >= 0 ? rawRun : 0;

      this.cameras.main.setBackgroundColor("#000000");

      const titleText = this.add
        .text(width / 2, TITLE_Y, "GAME OVER", {
          fontFamily: "monospace",
          fontSize: "24px",
          color: "#af1a26",
          align: "center",
        })
        .setShadow(0, 0, "#4d0000", 4, true, true)
        .setOrigin(0.5);
      this.titleGlowTween = this.tweens.add({
        targets: titleText,
        alpha: 0.9,
        duration: 760,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      this.add
        .text(width / 2, RUN_Y, `RUN: ${this.formatMs(runTimeMs)}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#f5f5f5",
          align: "center",
        })
        .setOrigin(0.5);

      const restartText = this.add
        .text(width / 2, RESTART_Y, "PRESS SPACE TO RESTART", {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#d4d4d4",
          align: "center",
        })
        .setOrigin(0.5);
      this.restartPromptTween = this.tweens.add({
        targets: restartText,
        alpha: 0.62,
        duration: 920,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      this.add
        .text(width / 2, TOP5_HEADER_Y, "TOP 5", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#f5f5f5",
          align: "center",
        })
        .setOrigin(0.5, 0);

      this.contextHeaderText = this.add
        .text(width / 2, CONTEXT_HEADER_Y, "YOUR RANK", {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#d4d4d4",
          align: "center",
        })
        .setOrigin(0.5, 0)
        .setVisible(false);

      this.statusText = this.add
        .text(width / 2, height - 6, "", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#f5f5f5",
          align: "center",
        })
        .setOrigin(0.5, 1);

      void this.loadLeaderboard(runTimeMs);

      this.input.keyboard?.once("keydown-SPACE", () => {
        this.scene.start(PLAY_SCENE_KEY, { startMusic: true });
      });
      this.events.once(PhaserLib.Scenes.Events.SHUTDOWN, () => {
        this.titleGlowTween?.remove();
        this.titleGlowTween = undefined;
        this.restartPromptTween?.remove();
        this.restartPromptTween = undefined;
        this.playerHighlightTween?.remove();
        this.playerHighlightTween = undefined;
        for (const rowText of this.top5RowTexts) {
          rowText.destroy();
        }
        this.top5RowTexts = [];
        for (const rowText of this.contextRowTexts) {
          rowText.destroy();
        }
        this.contextRowTexts = [];
        this.contextHeaderText = undefined;
        this.statusText = undefined;
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
      this.playerHighlightTween?.remove();
      this.playerHighlightTween = undefined;
      const top5Entries = response.top10.slice(0, 5);
      this.renderTop5(top5Entries, response.yourRank);
      const shouldShowContext = response.yourRank > 5;
      this.renderRankContext(response.aroundYou, response.yourRank, shouldShowContext);
    }

    private renderFallback(): void {
      this.playerHighlightTween?.remove();
      this.playerHighlightTween = undefined;
      this.renderTop5([], -1);
      this.renderRankContext([], -1, false);
      this.statusText?.setText("");
    }

    private renderTop5(entries: LeaderboardEntry[], yourRank: number): void {
      for (const rowText of this.top5RowTexts) {
        rowText.destroy();
      }
      this.top5RowTexts = [];

      if (!entries.length) {
        const fallback = this.add
          .text(this.scale.width / 2, TOP5_START_Y, "—", {
            fontFamily: "monospace",
            fontSize: "8px",
            color: "#d4d4d4",
            align: "left",
          })
          .setOrigin(0.5, 0)
          .setFixedSize(LEADERBOARD_BLOCK_WIDTH, 0);
        this.top5RowTexts.push(fallback);
        return;
      }

      entries.forEach((entry, index) => {
        const isPlayerRow = entry.rank === yourRank;
        const line = this.add
          .text(
            this.scale.width / 2,
            TOP5_START_Y + index * LEADERBOARD_ROW_SPACING,
            this.formatLeaderboardLine(entry),
            {
              fontFamily: "monospace",
              fontSize: "9px",
              color: isPlayerRow ? "#fff0b0" : "#d4d4d4",
              align: "left",
            },
          )
          .setOrigin(0.5, 0)
          .setFixedSize(LEADERBOARD_BLOCK_WIDTH, 0);

        if (isPlayerRow) {
          this.applyPlayerHighlight(line);
        }

        this.top5RowTexts.push(line);
      });
    }

    private renderRankContext(entries: LeaderboardEntry[], yourRank: number, visible: boolean): void {
      for (const rowText of this.contextRowTexts) {
        rowText.destroy();
      }
      this.contextRowTexts = [];
      this.contextHeaderText?.setVisible(visible);

      if (!visible) {
        return;
      }

      if (!entries.length) {
        const fallback = this.add
          .text(this.scale.width / 2, CONTEXT_START_Y, `RANK ${yourRank > 0 ? yourRank : "—"}`, {
            fontFamily: "monospace",
            fontSize: "8px",
            color: "#d4d4d4",
            align: "left",
          })
          .setOrigin(0.5, 0)
          .setFixedSize(LEADERBOARD_BLOCK_WIDTH, 0);
        this.contextRowTexts.push(fallback);
        return;
      }

      const playerIndex = entries.findIndex((entry) => entry.rank === yourRank);
      const rows =
        playerIndex >= 0
          ? entries.slice(Math.max(0, playerIndex - 1), playerIndex + 2)
          : entries.slice(0, 3);

      rows.forEach((entry, index) => {
        const isPlayerRow = entry.rank === yourRank;
        const line = this.add
          .text(
            this.scale.width / 2,
            CONTEXT_START_Y + index * LEADERBOARD_ROW_SPACING,
            this.formatLeaderboardLine(entry),
            {
              fontFamily: "monospace",
              fontSize: "9px",
              color: isPlayerRow ? "#fff0b0" : "#c2c2c2",
              align: "left",
            },
          )
          .setOrigin(0.5, 0)
          .setFixedSize(LEADERBOARD_BLOCK_WIDTH, 0);

        if (isPlayerRow) {
          this.applyPlayerHighlight(line);
        }

        this.contextRowTexts.push(line);
      });
    }

    private formatLeaderboardLine(entry: LeaderboardEntry): string {
      const rank = String(entry.rank).padStart(2, " ");
      const nickname = entry.nickname.slice(0, LEADERBOARD_NICKNAME_WIDTH);
      const time = this.formatMs(entry.scoreMs);
      const prefix = `${rank} ${nickname}`;
      const suffix = ` ${time}`;
      const fillerLength = Math.max(2, LEADERBOARD_ROW_TOTAL_CHARS - prefix.length - suffix.length);
      return `${prefix}${".".repeat(fillerLength)}${suffix}`;
    }

    private applyPlayerHighlight(line: Phaser.GameObjects.Text): void {
      line.setStroke("#ffe9b8", 1);
      line.setShadow(0, 0, "#ffe9b8", 1, true, true);
      this.playerHighlightTween = this.tweens.add({
        targets: line,
        alpha: 0.86,
        duration: 760,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
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
