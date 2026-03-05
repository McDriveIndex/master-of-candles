import type Phaser from "phaser";

export const CANDLE_WIDTH = 12;
export const CANDLE_MIN_HEIGHT = 24;
export const CANDLE_MAX_HEIGHT = 90;
export const CANDLE_SPEED = 120;
const CANDLE_GLOSS_WIDTH = 2;
const CANDLE_WICK_WIDTH = 2;
const CANDLE_MIN_BODY_HEIGHT = 12;
const CANDLE_WICK_RATIO = 0.18;
const CANDLE_MIN_WICK_HEIGHT = 4;
const CANDLE_MAX_WICK_HEIGHT = 14;
const OUT_OF_BOUNDS_MARGIN = 2;
const CANDLE_BODY_TEXTURE_KEY = "candle-body";
const CANDLE_WICK_TEXTURE_KEY = "candle-wick";
const CANDLE_GLOSS_TEXTURE_KEY = "candle-gloss";

type CandleOptions = {
  visualsEnabled?: boolean;
};

export class Candle {
  private readonly collider: Phaser.GameObjects.Rectangle;
  private readonly body: Phaser.Physics.Arcade.Body;
  private readonly bodyHeight: number;
  private readonly wickTopHeight: number;
  private readonly wickBottomHeight: number;
  private readonly visualsEnabled: boolean;
  private bodySprite?: Phaser.GameObjects.Image;
  private glossSprite?: Phaser.GameObjects.Image;
  private wickTopSprite?: Phaser.GameObjects.Image;
  private wickBottomSprite?: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    height: number,
    speed: number = CANDLE_SPEED,
    options?: CandleOptions,
  ) {
    this.bodyHeight = Math.max(CANDLE_MIN_BODY_HEIGHT, Math.round(height));
    this.wickTopHeight = Candle.getWickHeight(this.bodyHeight);
    this.wickBottomHeight = Candle.getWickHeight(this.bodyHeight);
    this.visualsEnabled = !!options?.visualsEnabled
      && scene.textures.exists(CANDLE_BODY_TEXTURE_KEY)
      && scene.textures.exists(CANDLE_WICK_TEXTURE_KEY)
      && scene.textures.exists(CANDLE_GLOSS_TEXTURE_KEY);

    this.collider = scene.add.rectangle(x, y, CANDLE_WIDTH, this.bodyHeight, 0xf0b35d);
    scene.physics.add.existing(this.collider, false);

    this.body = this.collider.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setVelocity(0, speed);

    if (this.visualsEnabled) {
      this.bodySprite = scene.add.image(x, y, CANDLE_BODY_TEXTURE_KEY);
      this.bodySprite.setDisplaySize(CANDLE_WIDTH, this.bodyHeight);

      this.glossSprite = scene.add.image(x, y, CANDLE_GLOSS_TEXTURE_KEY);
      this.glossSprite.setDisplaySize(CANDLE_GLOSS_WIDTH, this.bodyHeight);

      this.wickTopSprite = scene.add.image(x, y, CANDLE_WICK_TEXTURE_KEY);
      this.wickTopSprite.setDisplaySize(CANDLE_WICK_WIDTH, this.wickTopHeight);

      this.wickBottomSprite = scene.add.image(x, y, CANDLE_WICK_TEXTURE_KEY);
      this.wickBottomSprite.setDisplaySize(CANDLE_WICK_WIDTH, this.wickBottomHeight);

      this.collider.setAlpha(0);
      this.syncVisuals();
    }
  }

  destroy() {
    this.body.enable = false;
    this.collider.destroy();
    this.bodySprite?.destroy();
    this.glossSprite?.destroy();
    this.wickTopSprite?.destroy();
    this.wickBottomSprite?.destroy();
  }

  destroyIfOutOfBounds(screenHeight: number): boolean {
    this.syncVisuals();
    const halfHeight = this.visualsEnabled
      ? Candle.getTotalHalfHeight(this.bodyHeight)
      : this.collider.displayHeight / 2;
    const isOut = this.collider.y - halfHeight > screenHeight + OUT_OF_BOUNDS_MARGIN;

    if (isOut) {
      this.destroy();
    }

    return isOut;
  }

  setDepth(depth: number) {
    this.collider.setDepth(depth);
    this.bodySprite?.setDepth(depth);
    this.glossSprite?.setDepth(depth + 1);
    this.wickTopSprite?.setDepth(depth + 2);
    this.wickBottomSprite?.setDepth(depth + 2);
  }

  static getTotalHalfHeight(bodyHeight: number): number {
    const normalizedBodyHeight = Math.max(CANDLE_MIN_BODY_HEIGHT, Math.round(bodyHeight));
    const wickHeight = Candle.getWickHeight(normalizedBodyHeight);
    return normalizedBodyHeight / 2 + wickHeight + wickHeight;
  }

  private static getWickHeight(bodyHeight: number): number {
    return Math.max(
      CANDLE_MIN_WICK_HEIGHT,
      Math.min(CANDLE_MAX_WICK_HEIGHT, Math.round(bodyHeight * CANDLE_WICK_RATIO)),
    );
  }

  private syncVisuals() {
    if (!this.visualsEnabled || !this.bodySprite || !this.glossSprite || !this.wickTopSprite || !this.wickBottomSprite) {
      return;
    }

    const x = this.collider.x;
    const y = this.collider.y;
    const bodyTopY = y - this.bodyHeight / 2;
    const bodyBottomY = y + this.bodyHeight / 2;

    this.bodySprite.setPosition(x, y);
    this.glossSprite.setPosition(x - 3, y);
    this.wickTopSprite.setPosition(x, bodyTopY - this.wickTopHeight / 2);
    this.wickBottomSprite.setPosition(x, bodyBottomY + this.wickBottomHeight / 2);
  }

  get gameObject() {
    return this.collider;
  }
}
