import type Phaser from "phaser";
import { submitScore, type LeaderboardEntry, type SubmitResponse } from "../services/leaderboard";
import { readMusicEnabledPreference, toggleMusicEnabledPreference, updateMusicToggleText } from "../systems/musicPreference";
import { PLAY_SCENE_KEY } from "./PlayScene";

export const GAME_OVER_SCENE_KEY = "GameOverScene";
const NICKNAME_STORAGE_KEY = "moc_nickname";
const NICKNAME_REGEX = /^[A-Za-z0-9_]{1,16}$/;
const NICKNAME_REQUEST_EVENT_NAME = "moc:ask-nickname";
const NICKNAME_RESULT_EVENT_NAME = "moc:nickname-result";
const TITLE_Y = 34;
const RUN_Y = 55;
const RESTART_Y = 74;
const TOP5_HEADER_Y = 88;
const TOP5_START_Y = 100;
const CONTEXT_HEADER_Y = 154;
const CONTEXT_START_Y = 166;
const TOP_PLACEMENT_FEEDBACK_Y = 160;
const LEADERBOARD_ROW_SPACING = 10;
const LEADERBOARD_NICKNAME_WIDTH = 16;
const LEADERBOARD_TIME_WIDTH = 7;
const LEADERBOARD_ROW_TOTAL_CHARS = 2 + 1 + LEADERBOARD_NICKNAME_WIDTH + 1 + LEADERBOARD_TIME_WIDTH;
const LEADERBOARD_BLOCK_WIDTH = 152;
const MENU_LOOP_MUSIC_KEY = "menu-loop-music";
const MENU_LOOP_MUSIC_VOLUME = 0.6;
const SFX_UI_CONFIRM_KEY = "sfx-ui-confirm";
const SFX_UI_CONFIRM_VOLUME = 0.65;

type GameOverData = {
  runTimeMs?: number;
  bestMs?: number;
};

type NicknameRequestDetail = {
  score: number;
  requestId: number;
  defaultNickname?: string;
};

type NicknameResultDetail = {
  requestId: number;
  nickname: string | null;
};

export function createGameOverScene(PhaserLib: typeof Phaser) {
  return class GameOverScene extends PhaserLib.Scene {
    private contextHeaderText?: Phaser.GameObjects.Text;
    private topPlacementFeedbackText?: Phaser.GameObjects.Text;
    private statusText?: Phaser.GameObjects.Text;
    private top5RowTexts: Phaser.GameObjects.Text[] = [];
    private contextRowTexts: Phaser.GameObjects.Text[] = [];
    private musicToggleText?: Phaser.GameObjects.Text;
    private menuLoopMusic?: Phaser.Sound.BaseSound;
    private titleGlowTween?: Phaser.Tweens.Tween;
    private restartPromptTween?: Phaser.Tweens.Tween;
    private playerHighlightTween?: Phaser.Tweens.Tween;
    private nicknameRequestSeq = 0;
    private pendingNicknameResultHandler?: (event: Event) => void;
    private pendingNicknameResolve?: (nickname: string | null) => void;

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
      this.topPlacementFeedbackText = this.add
        .text(width / 2, TOP_PLACEMENT_FEEDBACK_Y, "", {
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
      const musicToggleText = this.add
        .text(width - 8, 8, "", {
          fontFamily: "monospace",
          fontSize: "8px",
        })
        .setOrigin(1, 0)
        .setDepth(40)
        .setInteractive({ useHandCursor: true });
      this.musicToggleText = musicToggleText;
      musicToggleText.on("pointerdown", () => {
        toggleMusicEnabledPreference();
        updateMusicToggleText(musicToggleText);
        this.syncMenuLoopMusicWithPreference();
      });
      updateMusicToggleText(musicToggleText);
      this.syncMenuLoopMusicWithPreference();

      void this.loadLeaderboard(runTimeMs);

      this.input.keyboard?.once("keydown-SPACE", () => {
        this.playUiConfirmSfx();
        this.stopMenuLoopMusic();
        this.scene.start(PLAY_SCENE_KEY, { startMusic: true });
      });
      this.events.once(PhaserLib.Scenes.Events.SHUTDOWN, () => {
        this.titleGlowTween?.remove();
        this.titleGlowTween = undefined;
        this.restartPromptTween?.remove();
        this.restartPromptTween = undefined;
        this.playerHighlightTween?.remove();
        this.playerHighlightTween = undefined;
        this.musicToggleText?.removeAllListeners();
        this.musicToggleText = undefined;
        this.stopMenuLoopMusic();
        this.resolvePendingNicknameRequest(null);
        for (const rowText of this.top5RowTexts) {
          rowText.destroy();
        }
        this.top5RowTexts = [];
        for (const rowText of this.contextRowTexts) {
          rowText.destroy();
        }
        this.contextRowTexts = [];
        this.contextHeaderText = undefined;
        this.topPlacementFeedbackText = undefined;
        this.statusText = undefined;
      });
    }

    private formatMs(ms: number): string {
      return `${(ms / 1000).toFixed(2)}s`;
    }

    private syncMenuLoopMusicWithPreference() {
      if (!readMusicEnabledPreference()) {
        this.stopMenuLoopMusic();
        return;
      }
      if (!this.cache.audio.exists(MENU_LOOP_MUSIC_KEY)) {
        return;
      }

      if (!this.menuLoopMusic) {
        const existingMusic = this.sound.get(MENU_LOOP_MUSIC_KEY);
        this.menuLoopMusic = existingMusic ?? this.sound.add(MENU_LOOP_MUSIC_KEY, {
          loop: true,
          volume: MENU_LOOP_MUSIC_VOLUME,
        });
      }
      if (!this.menuLoopMusic.isPlaying) {
        this.menuLoopMusic.play();
      }
    }

    private stopMenuLoopMusic() {
      const existingMusic = this.sound.get(MENU_LOOP_MUSIC_KEY);
      if (existingMusic && existingMusic !== this.menuLoopMusic) {
        if (existingMusic.isPlaying) {
          existingMusic.stop();
        }
        existingMusic.destroy();
      }
      if (!this.menuLoopMusic) {
        return;
      }
      if (this.menuLoopMusic.isPlaying) {
        this.menuLoopMusic.stop();
      }
      this.menuLoopMusic.destroy();
      this.menuLoopMusic = undefined;
    }

    private playUiConfirmSfx() {
      if (!readMusicEnabledPreference() || !this.cache.audio.exists(SFX_UI_CONFIRM_KEY)) {
        return;
      }
      this.sound.play(SFX_UI_CONFIRM_KEY, { volume: SFX_UI_CONFIRM_VOLUME });
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
        const promptedNickname = await this.requestNickname(scoreMsInt, storedNickname);
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
      this.renderTopPlacementFeedback(response.yourRank);
    }

    private renderFallback(): void {
      this.playerHighlightTween?.remove();
      this.playerHighlightTween = undefined;
      this.renderTop5([], -1);
      this.renderRankContext([], -1, false);
      this.renderTopPlacementFeedback(-1);
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

    private renderTopPlacementFeedback(yourRank: number): void {
      const feedback = this.getTopPlacementFeedback(yourRank);
      if (!feedback) {
        this.topPlacementFeedbackText?.setText("").setVisible(false);
        return;
      }
      this.topPlacementFeedbackText?.setText(feedback).setVisible(true);
    }

    private getTopPlacementFeedback(yourRank: number): string | null {
      if (yourRank === 1) {
        return "You're the top trader";
      }
      if (yourRank >= 2 && yourRank <= 5) {
        return "Top 5% trader";
      }
      return null;
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

    private async requestNickname(score: number, defaultNickname?: string): Promise<string | null> {
      if (typeof window === "undefined") {
        return null;
      }

      this.resolvePendingNicknameRequest(null);

      this.nicknameRequestSeq += 1;
      const requestId = this.nicknameRequestSeq;

      return new Promise<string | null>((resolve) => {
        this.pendingNicknameResolve = resolve;
        const onResult = (event: Event) => {
          const { detail } = event as CustomEvent<NicknameResultDetail>;
          if (detail?.requestId !== requestId) {
            return;
          }
          const nickname =
            typeof detail.nickname === "string"
              ? detail.nickname.trim().toUpperCase()
              : null;
          this.resolvePendingNicknameRequest(nickname);
        };

        this.pendingNicknameResultHandler = onResult;
        window.addEventListener(NICKNAME_RESULT_EVENT_NAME, onResult as EventListener);
        window.dispatchEvent(
          new CustomEvent<NicknameRequestDetail>(NICKNAME_REQUEST_EVENT_NAME, {
            detail: { score, requestId, defaultNickname },
          }),
        );
      });
    }

    private resolvePendingNicknameRequest(nickname: string | null): void {
      if (typeof window !== "undefined" && this.pendingNicknameResultHandler) {
        window.removeEventListener(NICKNAME_RESULT_EVENT_NAME, this.pendingNicknameResultHandler as EventListener);
      }
      this.pendingNicknameResultHandler = undefined;
      const resolve = this.pendingNicknameResolve;
      this.pendingNicknameResolve = undefined;
      if (resolve) {
        resolve(nickname);
      }
    }

    private isValidNickname(value: string): boolean {
      return NICKNAME_REGEX.test(value);
    }
  };
}
