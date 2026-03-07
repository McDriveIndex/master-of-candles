import type Phaser from "phaser";

import { Airdrop, AIRDROP_VISUAL_HEIGHT, AIRDROP_VISUAL_WIDTH } from "../entities/Airdrop";
import {
  Candle,
  CANDLE_MAX_HEIGHT,
  CANDLE_MIN_HEIGHT,
  CANDLE_WIDTH,
} from "../entities/Candle";
import { Player } from "../entities/Player";
import { getLeaderboard } from "../services/leaderboard";
import { AirdropSpawnerSystem } from "../systems/AirdropSpawnerSystem";
import { DifficultyController, type DifficultyParams, type VolatilityState } from "../systems/DifficultyController";
import { GAME_OVER_SCENE_KEY } from "./GameOverScene";

export const PLAY_SCENE_KEY = "PlayScene";
const PERSONAL_BEST_STORAGE_KEY = "moc_personal_best_ms";

const PLAYER_SPEED = 120;
const MIN_SPAWN_DISTANCE = 28;
const MAX_SPAWN_DISTANCE = 110;
const MAX_SPAWN_ATTEMPTS = 8;
const MAX_HEIGHT_SCALE = 1.1;
const DEATH_FREEZE_MS = 250;
const DEATH_SHAKE_DURATION_MS = 120;
const DEATH_SHAKE_INTENSITY = 0.004;
const DEATH_FADE_DURATION_MS = 300;
const AIRDROP_SAVE_GRACE_MS = 120;
const AIRDROP_SAVE_SHAKE_DURATION_MS = 80;
const AIRDROP_SAVE_SHAKE_INTENSITY = 0.002;
const AIRDROP_SPAWN_CANDLE_Y_THRESHOLD = 80;
const AIRDROP_SPAWN_FOOTPRINT_PADDING_X = 2;
const AIRDROP_SPAWN_CANDLE_HEAD_ALLOWANCE_Y = 10;
const AIRDROP_SPAWN_ATTEMPTS = 8;
const PRESSURE_OFFSET_RANGE = 50;
const PRESSURE_MIN_PLAYER_OFFSET = 14;
const AIRDROP_AUTO_SPAWN_DELAY_MS = 60_000;
const AIRDROP_TEXTURE_KEY = "airdrop";
const CANDLE_BODY_TEXTURE_KEY = "candle-body";
const CANDLE_WICK_TEXTURE_KEY = "candle-wick";
const CANDLE_GLOSS_TEXTURE_KEY = "candle-gloss";
const PLAYER_PAWN_TEXTURE_KEY = "player_pawn";
const PLAYER_PAWN_AIRDROP_TEXTURE_KEY = "player_pawn_airdrop";
const HUD_MARGIN_X = 10;
const HUD_TOP_Y = 8;
const HUD_SECONDARY_Y = 20;
const HUD_FADE_IN_DURATION_MS = 240;
const VOLATILITY_EVENT_NAME = "moc:volatility-change";
const VOLATILITY_EVENT_INTENSITY_STEP = 0.05;

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
    private spawnTimer?: Phaser.Time.TimerEvent;
    private deathDelayEvent?: Phaser.Time.TimerEvent;
    private isDying = false;
    private runStartMs = 0;
    private runTimeMs = 0;
    private bestMs = 0;
    private runFinalized = false;
    private timerText?: Phaser.GameObjects.Text;
    private bestText?: Phaser.GameObjects.Text;
    private globalBestText?: Phaser.GameObjects.Text;
    private hudFadeTween?: Phaser.Tweens.Tween;
    private timerUpdateEvent?: Phaser.Time.TimerEvent;
    private difficultyController?: DifficultyController;
    private hasAirdrop = false;
    private airdropShieldUntilMs = 0;
    private airdropSpawner?: AirdropSpawnerSystem;
    private activeAirdrop?: Airdrop;
    private airdropGroup?: Phaser.Physics.Arcade.Group;
    private candleAssetsReady = false;
    private playerAssetReady = false;
    private playerAirdropAssetReady = false;
    private readonly rectA: Phaser.Geom.Rectangle;
    private readonly rectB: Phaser.Geom.Rectangle;
    private lastDispatchedVolatilityActive = false;
    private lastDispatchedVolatilityIntensity = 0;

    constructor() {
      super(PLAY_SCENE_KEY);
      this.rectA = new PhaserLib.Geom.Rectangle();
      this.rectB = new PhaserLib.Geom.Rectangle();
    }

    create() {
      const { width, height } = this.scale;

      this.cameras.main.setBackgroundColor("#000000");
      this.dispatchVolatilityChange({ isVolatilityActive: false, volatilityIntensity: 0 }, true);

      this.physics.world.setBounds(0, 0, width, height);
      this.physics.world.setBoundsCollision(true, true, true, true);
      this.candleAssetsReady = this.textures.exists(CANDLE_BODY_TEXTURE_KEY)
        && this.textures.exists(CANDLE_WICK_TEXTURE_KEY)
        && this.textures.exists(CANDLE_GLOSS_TEXTURE_KEY);
      this.playerAssetReady = this.textures.exists(PLAYER_PAWN_TEXTURE_KEY);
      this.playerAirdropAssetReady = this.textures.exists(PLAYER_PAWN_AIRDROP_TEXTURE_KEY);
      let queuedAssetLoad = false;
      if (!this.textures.exists(AIRDROP_TEXTURE_KEY)) {
        this.load.image(AIRDROP_TEXTURE_KEY, "/assets/game/airdrop/airdrop.png");
        queuedAssetLoad = true;
      }
      if (!this.textures.exists(CANDLE_BODY_TEXTURE_KEY)) {
        this.load.image(CANDLE_BODY_TEXTURE_KEY, "/assets/game/candles/candlestick_body.png");
        queuedAssetLoad = true;
      }
      if (!this.textures.exists(CANDLE_WICK_TEXTURE_KEY)) {
        this.load.image(CANDLE_WICK_TEXTURE_KEY, "/assets/game/candles/candlestick_wick.png");
        queuedAssetLoad = true;
      }
      if (!this.textures.exists(CANDLE_GLOSS_TEXTURE_KEY)) {
        this.load.image(CANDLE_GLOSS_TEXTURE_KEY, "/assets/game/candles/candlestick_gloss.png");
        queuedAssetLoad = true;
      }
      if (!this.playerAssetReady) {
        this.load.image(PLAYER_PAWN_TEXTURE_KEY, "/assets/game/player/pawn.png");
        queuedAssetLoad = true;
      }
      if (!this.playerAirdropAssetReady) {
        this.load.image(PLAYER_PAWN_AIRDROP_TEXTURE_KEY, "/assets/game/player/pawn_airdrop.png");
        queuedAssetLoad = true;
      }
      if (queuedAssetLoad) {
        this.load.once(PhaserLib.Loader.Events.COMPLETE, () => {
          this.candleAssetsReady = this.textures.exists(CANDLE_BODY_TEXTURE_KEY)
            && this.textures.exists(CANDLE_WICK_TEXTURE_KEY)
            && this.textures.exists(CANDLE_GLOSS_TEXTURE_KEY);
          this.playerAssetReady = this.textures.exists(PLAYER_PAWN_TEXTURE_KEY);
          this.playerAirdropAssetReady = this.textures.exists(PLAYER_PAWN_AIRDROP_TEXTURE_KEY);
          if (this.scene.isActive() && this.player) {
            this.syncPlayerVisualWithAirdropState();
          }
        }, this);
        this.load.start();
      }

      this.player = new Player(this, width / 2, height - 16);
      this.fixedPlayerY = height - 16;
      this.isDying = false;
      this.runFinalized = false;
      this.runTimeMs = 0;
      this.hasAirdrop = false;
      this.airdropShieldUntilMs = 0;
      this.bestMs = this.loadBestMs();
      this.runStartMs = this.nowMs();
      this.player.gameObject.setDepth(20);
      this.syncPlayerVisualWithAirdropState();
      this.candlesGroup = this.add.group();
      this.difficultyController = new DifficultyController();
      this.airdropSpawner = new AirdropSpawnerSystem(this.nowMs());
      this.airdropGroup = this.physics.add.group();

      const timerText = this.add
        .text(HUD_MARGIN_X, HUD_TOP_Y, `RUN: ${this.formatMs(0)}`, {
          fontFamily: "monospace",
          fontSize: "11px",
          fontStyle: "bold",
          color: "#f5f5f5",
        })
        .setOrigin(0, 0);
      timerText.setShadow(0, 1, "#000000", 0.85, false, true);
      timerText.setDepth(120);
      this.timerText = timerText;

      const bestText = this.add
        .text(width - HUD_MARGIN_X, HUD_TOP_Y, `PB: ${this.formatMs(this.bestMs)}`, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#cfcfcf",
        })
        .setOrigin(1, 0);
      bestText.setShadow(0, 1, "#000000", 0.85, false, true);
      bestText.setDepth(120);
      this.bestText = bestText;

      const globalBestText = this.add
        .text(width - HUD_MARGIN_X, HUD_SECONDARY_Y, "WORLD: —", {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#b4b4b4",
        })
        .setOrigin(1, 0);
      globalBestText.setShadow(0, 1, "#000000", 0.85, false, true);
      globalBestText.setDepth(120);
      this.globalBestText = globalBestText;
      const hudElements = [timerText, bestText, globalBestText];
      for (const hudElement of hudElements) {
        hudElement.setAlpha(0);
      }
      this.hudFadeTween = this.tweens.add({
        targets: hudElements,
        alpha: 1,
        duration: HUD_FADE_IN_DURATION_MS,
        ease: "Sine.easeOut",
        stagger: 40,
      });
      void this.loadGlobalBest();

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
        this.spawnTimer?.remove();
        this.spawnTimer = undefined;
        this.finalizeRun();
        this.isDying = false;
        this.physics?.world?.resume();
        this.scene.start(GAME_OVER_SCENE_KEY, { runTimeMs: this.runTimeMs, bestMs: this.bestMs });
      };

      this.input.keyboard?.once("keydown-ESC", goGameOver);
      this.input.keyboard?.once("keydown-SPACE", goGameOver);
      // Temporary debug shortcut for M17 testing: force an immediate airdrop spawn via normal flow.
      const debugSpawnAirdrop = () => {
        if (this.isDying) {
          return;
        }
        this.spawnAirdrop();
      };
      this.input.keyboard?.on("keydown-P", debugSpawnAirdrop);

      this.scheduleNextSpawn();

      this.events.once(PhaserLib.Scenes.Events.SHUTDOWN, () => {
        this.spawnTimer?.remove();
        this.spawnTimer = undefined;
        this.timerUpdateEvent?.remove();
        this.timerUpdateEvent = undefined;
        this.hudFadeTween?.remove();
        this.hudFadeTween = undefined;
        this.deathDelayEvent?.remove();
        this.deathDelayEvent = undefined;
        this.lastSpawnX = null;
        this.isDying = false;
        this.cameras?.main?.off(
          PhaserLib.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
          this.onDeathFadeOutComplete,
          this,
        );
        this.input.keyboard?.off("keydown-P", debugSpawnAirdrop);

        for (const candle of this.candles) {
          candle.destroy();
        }
        this.candles = [];
        this.candlesGroup?.destroy(true);
        this.candlesGroup = undefined;
        this.clearActiveAirdrop(false);
        this.airdropGroup?.destroy(true);
        this.airdropGroup = undefined;
        this.airdropSpawner = undefined;
        this.timerText = undefined;
        this.bestText = undefined;
        this.globalBestText = undefined;
        this.difficultyController = undefined;
        this.player?.destroy();
        this.player = undefined;
        this.dispatchVolatilityChange({ isVolatilityActive: false, volatilityIntensity: 0 }, true);

        this.physics?.world?.resume();
      });
    }

    update(_time: number, delta: number) {
      const now = this.nowMs();
      const elapsedMs = now - this.runStartMs;
      this.syncVolatilityBridge(elapsedMs);

      if (!this.player || !this.movementKeys) {
        return;
      }
      const autoEnabled = (now - this.runStartMs) >= AIRDROP_AUTO_SPAWN_DELAY_MS;

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
      this.player?.updateVisual();

      this.candles = this.candles.filter(
        (candle) => {
          const destroyed = candle.destroyIfOutOfBounds(this.scale.height);
          if (destroyed) {
            this.candlesGroup?.remove(candle.gameObject);
          }
          return !destroyed;
        },
      );

      if (this.activeAirdrop) {
        this.activeAirdrop.update(delta);
        const removed = this.activeAirdrop.isExpired || this.activeAirdrop.destroyIfOutOfBounds(this.scale.height);
        if (removed) {
          this.clearActiveAirdrop(true);
        }
      }

      if (!this.isDying && this.player) {
        if (
          this.activeAirdrop
          && this.overlaps(this.player.gameObject, this.activeAirdrop.gameObject)
        ) {
          this.onPlayerPickedAirdrop();
        }

        for (const candle of this.candles) {
          if (!this.overlaps(this.player.gameObject, candle.gameObject)) {
            continue;
          }
          this.onPlayerHitByCandle(candle.gameObject);
          break;
        }
      }

      if (
        autoEnabled
        && !this.isDying
        && this.player
        && this.airdropSpawner
        && !this.activeAirdrop
        && this.airdropSpawner.shouldSpawn(now, false)
      ) {
        this.spawnAirdrop();
      }
    }

    private spawnCandle(params: DifficultyParams) {
      const { width } = this.scale;
      const halfW = CANDLE_WIDTH / 2;
      const minX = halfW;
      const maxX = width - halfW;
      const usePressureBias = !!this.player && Math.random() < params.pressureBias;
      const playerX = this.player?.gameObject.x ?? width / 2;
      const pickBiasedX = () => {
        let candidateX = playerX + PhaserLib.Math.FloatBetween(-PRESSURE_OFFSET_RANGE, PRESSURE_OFFSET_RANGE);
        if (Math.abs(candidateX - playerX) < PRESSURE_MIN_PLAYER_OFFSET) {
          const direction = Math.random() < 0.5 ? -1 : 1;
          candidateX = playerX + direction * PRESSURE_MIN_PLAYER_OFFSET;
        }
        candidateX = Math.round(candidateX);
        return PhaserLib.Math.Clamp(candidateX, minX, maxX);
      };
      const pickRandomX = () => PhaserLib.Math.Between(minX, maxX);

      let x = usePressureBias ? pickBiasedX() : pickRandomX();
      let foundValidX = this.isSpawnDistanceValid(x) && this.isCandleSpawnXSafeFromAirdropLane(x);
      for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS && !foundValidX; attempt += 1) {
        x = usePressureBias ? pickBiasedX() : pickRandomX();
        foundValidX = this.isSpawnDistanceValid(x) && this.isCandleSpawnXSafeFromAirdropLane(x);
      }

      if (!foundValidX && this.lastSpawnX !== null) {
        const direction = playerX >= this.lastSpawnX ? 1 : -1;
        const fallbackDistance = PhaserLib.Math.Between(MIN_SPAWN_DISTANCE, MAX_SPAWN_DISTANCE);
        x = this.lastSpawnX + direction * fallbackDistance;
        x = PhaserLib.Math.Clamp(x, minX, maxX);

        if (!this.isSpawnDistanceValid(x) || !this.isCandleSpawnXSafeFromAirdropLane(x)) {
          x = this.lastSpawnX - direction * fallbackDistance;
          x = PhaserLib.Math.Clamp(x, minX, maxX);
        }
      }

      x = PhaserLib.Math.Clamp(x, minX, maxX);
      if (!this.isCandleSpawnXSafeFromAirdropLane(x)) {
        return;
      }
      let candleHeight = PhaserLib.Math.Between(CANDLE_MIN_HEIGHT, CANDLE_MAX_HEIGHT);
      candleHeight = Math.round(candleHeight * params.heightScale);
      candleHeight = PhaserLib.Math.Clamp(
        candleHeight,
        CANDLE_MIN_HEIGHT,
        Math.round(CANDLE_MAX_HEIGHT * MAX_HEIGHT_SCALE),
      );
      if (!Number.isFinite(x)) {
        x = width / 2;
      }
      if (!Number.isFinite(candleHeight)) {
        candleHeight = 60;
      }
      const spawnY = this.candleAssetsReady
        ? -Candle.getTotalHalfHeight(candleHeight) - 2
        : -candleHeight / 2 - 2;
      const candle = new Candle(this, x, spawnY, candleHeight, params.candleSpeed, {
        visualsEnabled: this.candleAssetsReady,
      });
      candle.setDepth(10);

      this.candles.push(candle);
      this.candlesGroup?.add(candle.gameObject);
      this.lastSpawnX = x;
    }

    private isSpawnDistanceValid(x: number): boolean {
      if (this.lastSpawnX === null) {
        return true;
      }
      const delta = Math.abs(x - this.lastSpawnX);
      return delta >= MIN_SPAWN_DISTANCE && delta <= MAX_SPAWN_DISTANCE;
    }

    private scheduleNextSpawn() {
      if (this.isDying || !this.difficultyController) {
        return;
      }

      const elapsedMs = this.nowMs() - this.runStartMs;
      const scheduleParams = this.difficultyController.getParams(elapsedMs);

      this.spawnTimer = this.time.delayedCall(scheduleParams.spawnIntervalMs, () => {
        if (this.isDying || !this.scene.isActive()) {
          return;
        }
        const currentElapsedMs = this.nowMs() - this.runStartMs;
        const params = this.difficultyController?.getParams(currentElapsedMs);
        if (!params) {
          return;
        }
        this.spawnCandle(params);
        this.scheduleNextSpawn();
      });
    }

    private onPlayerHitByCandle(candleObject?: Phaser.GameObjects.GameObject) {
      if (this.isDying || !this.player) {
        return;
      }
      if (this.time.now < this.airdropShieldUntilMs) {
        return;
      }

      if (this.hasAirdrop) {
        this.hasAirdrop = false;
        this.airdropShieldUntilMs = this.time.now + AIRDROP_SAVE_GRACE_MS;
        this.syncPlayerVisualWithAirdropState();
        this.destroyCandleByGameObject(candleObject);
        this.cameras?.main?.shake(AIRDROP_SAVE_SHAKE_DURATION_MS, AIRDROP_SAVE_SHAKE_INTENSITY);
        return;
      }

      this.isDying = true;
      this.clearActiveAirdrop(false);
      this.finalizeRun();
      this.player.stopX();
      this.spawnTimer?.remove();
      this.spawnTimer = undefined;
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

    private spawnAirdrop(spawnYOverride?: number) {
      if (!this.player || !this.airdropSpawner || this.activeAirdrop || !this.textures.exists(AIRDROP_TEXTURE_KEY)) {
        return;
      }

      let spawnX: number | null = null;
      for (let attempt = 0; attempt < AIRDROP_SPAWN_ATTEMPTS; attempt += 1) {
        const candidateX = this.airdropSpawner.pickSpawnX(
          this.scale.width,
          this.player.gameObject.x,
          AIRDROP_VISUAL_WIDTH / 2,
        );
        if (this.isAirdropSpawnXSafe(candidateX)) {
          spawnX = candidateX;
          break;
        }
      }

      if (spawnX === null) {
        // Spawn failed => treat as resolved to schedule the next attempt.
        this.airdropSpawner.notifyAirdropResolved(this.nowMs());
        return;
      }
      const spawnY = spawnYOverride ?? (-AIRDROP_VISUAL_HEIGHT / 2 - 2);
      this.activeAirdrop = new Airdrop(this, spawnX, spawnY);
      this.activeAirdrop.gameObject.setDepth(60);
      this.airdropGroup?.add(this.activeAirdrop.gameObject);
    }

    private onPlayerPickedAirdrop() {
      if (!this.activeAirdrop || this.isDying) {
        return;
      }

      if (!this.hasAirdrop) {
        this.hasAirdrop = true;
        this.airdropShieldUntilMs = this.time.now + AIRDROP_SAVE_GRACE_MS;
        this.syncPlayerVisualWithAirdropState();
        this.showAirdropPickupFeedback();
      }

      this.clearActiveAirdrop(true);
    }

    private clearActiveAirdrop(scheduleNext: boolean) {
      const airdrop = this.activeAirdrop;
      if (!airdrop) {
        return;
      }

      this.activeAirdrop = undefined;
      const group = this.airdropGroup;
      if (group && (group as { children?: unknown }).children && typeof group.remove === "function") {
        group.remove(airdrop.gameObject);
      }

      airdrop.destroy();
      if (scheduleNext) {
        this.airdropSpawner?.notifyAirdropResolved(this.nowMs());
      }
    }

    private destroyCandleByGameObject(candleObject?: Phaser.GameObjects.GameObject) {
      if (!candleObject) {
        return;
      }

      const candleIndex = this.candles.findIndex((candle) => candle.gameObject === candleObject);
      if (candleIndex < 0) {
        return;
      }

      const [candle] = this.candles.splice(candleIndex, 1);
      candle.destroy();
      this.candlesGroup?.remove(candleObject);
    }

    private syncPlayerVisualWithAirdropState() {
      if (!this.player || !this.playerAssetReady) {
        return;
      }

      this.player.enableVisual(this, PLAYER_PAWN_TEXTURE_KEY);
      const targetTextureKey = this.hasAirdrop && this.playerAirdropAssetReady
        ? PLAYER_PAWN_AIRDROP_TEXTURE_KEY
        : PLAYER_PAWN_TEXTURE_KEY;
      this.player.setVisualTexture(targetTextureKey);
    }

    private syncVolatilityBridge(elapsedMs: number) {
      if (!this.difficultyController) {
        return;
      }

      const volatilityState = this.difficultyController.getVolatilityState(elapsedMs);
      this.dispatchVolatilityChange(volatilityState);
    }

    private dispatchVolatilityChange(volatilityState: VolatilityState, force = false) {
      if (typeof window === "undefined") {
        return;
      }

      const quantizedIntensity = Math.round(volatilityState.volatilityIntensity / VOLATILITY_EVENT_INTENSITY_STEP)
        * VOLATILITY_EVENT_INTENSITY_STEP;
      const activeChanged = this.lastDispatchedVolatilityActive !== volatilityState.isVolatilityActive;
      const intensityChanged = Math.abs(this.lastDispatchedVolatilityIntensity - quantizedIntensity)
        >= VOLATILITY_EVENT_INTENSITY_STEP;
      if (!force && !activeChanged && !intensityChanged) {
        return;
      }

      this.lastDispatchedVolatilityActive = volatilityState.isVolatilityActive;
      this.lastDispatchedVolatilityIntensity = quantizedIntensity;
      window.dispatchEvent(new CustomEvent(VOLATILITY_EVENT_NAME, {
        detail: {
          active: volatilityState.isVolatilityActive,
          intensity: quantizedIntensity,
        },
      }));
    }

    private isAirdropSpawnXSafe(spawnX: number): boolean {
      const spawnBandTop = -AIRDROP_VISUAL_HEIGHT - 2;
      const spawnBandHeight = AIRDROP_SPAWN_CANDLE_Y_THRESHOLD - spawnBandTop;
      const airdropSpawnBandBounds = this.rectA.setTo(
        spawnX - AIRDROP_VISUAL_WIDTH / 2 - AIRDROP_SPAWN_FOOTPRINT_PADDING_X,
        spawnBandTop,
        AIRDROP_VISUAL_WIDTH + AIRDROP_SPAWN_FOOTPRINT_PADDING_X * 2,
        spawnBandHeight,
      );
      for (const candle of this.candles) {
        const candleObject = candle.gameObject as Phaser.GameObjects.GameObject & {
          body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
          getBounds?: (output?: Phaser.Geom.Rectangle) => Phaser.Geom.Rectangle;
        };
        const candleBody = candleObject.body;
        let candleBounds: Phaser.Geom.Rectangle | null = null;
        if (candleBody && ((candleBody as { enable?: boolean }).enable ?? true)) {
          candleBounds = this.rectB.setTo(candleBody.x, candleBody.y, candleBody.width, candleBody.height);
        } else if (typeof candleObject.getBounds === "function") {
          candleBounds = candleObject.getBounds(this.rectB);
        }
        if (candleBounds) {
          candleBounds = this.rectB.setTo(
            candleBounds.x,
            candleBounds.y - AIRDROP_SPAWN_CANDLE_HEAD_ALLOWANCE_Y,
            candleBounds.width,
            candleBounds.height + AIRDROP_SPAWN_CANDLE_HEAD_ALLOWANCE_Y,
          );
        }
        if (!candleBounds || candleBounds.top >= AIRDROP_SPAWN_CANDLE_Y_THRESHOLD) {
          continue;
        }
        if (PhaserLib.Geom.Intersects.RectangleToRectangle(airdropSpawnBandBounds, candleBounds)) {
          return false;
        }
      }
      return true;
    }

    private isCandleSpawnXSafeFromAirdropLane(candleSpawnX: number): boolean {
      if (!this.activeAirdrop) {
        return true;
      }
      const airdropObject = this.activeAirdrop.gameObject;
      const airdropTopY = airdropObject.y - airdropObject.displayHeight / 2;
      if (airdropTopY >= AIRDROP_SPAWN_CANDLE_Y_THRESHOLD) {
        return true;
      }
      const minSafeDistanceX = AIRDROP_VISUAL_WIDTH / 2 + CANDLE_WIDTH / 2 + AIRDROP_SPAWN_FOOTPRINT_PADDING_X;
      return Math.abs(candleSpawnX - airdropObject.x) > minSafeDistanceX;
    }

    private overlaps(
      a: Phaser.GameObjects.GameObject,
      b: Phaser.GameObjects.GameObject,
    ): boolean {
      type BoundsCapableGameObject = Phaser.GameObjects.GameObject & {
        getBounds: (output?: Phaser.Geom.Rectangle) => Phaser.Geom.Rectangle;
      };
      const bodyA = (a as Phaser.GameObjects.GameObject & {
        body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
      }).body;
      const bodyB = (b as Phaser.GameObjects.GameObject & {
        body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
      }).body;
      const hasGetBounds = (obj: unknown): obj is BoundsCapableGameObject => {
        if (!obj || typeof obj !== "object") {
          return false;
        }
        const maybeGetBounds = (obj as { getBounds?: unknown }).getBounds;
        return typeof maybeGetBounds === "function";
      };
      const isBodyEnabled = (body: unknown) => {
        if (!body || typeof body !== "object") {
          return false;
        }
        const maybeEnable = (body as { enable?: boolean }).enable;
        return maybeEnable === undefined ? true : !!maybeEnable;
      };

      const hasArcadeBodies = !!bodyA && !!bodyB && isBodyEnabled(bodyA) && isBodyEnabled(bodyB);
      const boundsA = hasArcadeBodies
        ? this.rectA.setTo(bodyA.x, bodyA.y, bodyA.width, bodyA.height)
        : (hasGetBounds(a) ? a.getBounds(this.rectA) : this.rectA.setTo(-999999, -999999, 0, 0));
      const boundsB = hasArcadeBodies
        ? this.rectB.setTo(bodyB.x, bodyB.y, bodyB.width, bodyB.height)
        : (hasGetBounds(b) ? b.getBounds(this.rectB) : this.rectB.setTo(-999999, -999999, 0, 0));
      return PhaserLib.Geom.Intersects.RectangleToRectangle(boundsA, boundsB);
    }

    private showAirdropPickupFeedback() {
      const feedbackText = this.add
        .text(this.scale.width / 2, 54, "AIRDROP ON", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(130)
        .setAlpha(1)
        .setScale(1);

      this.tweens.add({
        targets: feedbackText,
        alpha: 0,
        y: 46,
        duration: 620,
        ease: "Sine.easeOut",
        onComplete: () => feedbackText.destroy(),
      });
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

    private async loadGlobalBest(): Promise<void> {
      const leaderboard = await getLeaderboard();
      if (!this.scene.isActive() || !this.globalBestText) {
        return;
      }

      if (leaderboard?.globalBestMs !== null && leaderboard?.globalBestMs !== undefined) {
        this.globalBestText.setText(`WORLD: ${this.formatMsPrecise(leaderboard.globalBestMs)}`);
        return;
      }

      this.globalBestText.setText("WORLD: —");
    }

    private formatMsPrecise(ms: number): string {
      return `${(ms / 1000).toFixed(2)}s`;
    }
  };
}
