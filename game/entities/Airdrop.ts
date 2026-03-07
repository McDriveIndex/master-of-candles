import type Phaser from "phaser";

export const AIRDROP_WIDTH = 14;
export const AIRDROP_HEIGHT = 14;
export const AIRDROP_VISUAL_WIDTH = 26;
export const AIRDROP_VISUAL_HEIGHT = 39;
export const AIRDROP_FALL_SPEED = 90;
export const AIRDROP_TTL_MS = 3000;
const AIRDROP_OUT_OF_BOUNDS_MARGIN = 4;
const AIRDROP_BODY_OFFSET_X = (AIRDROP_VISUAL_WIDTH - AIRDROP_WIDTH) / 2;
const AIRDROP_BODY_OFFSET_Y = AIRDROP_VISUAL_HEIGHT - AIRDROP_HEIGHT;

export class Airdrop {
  private readonly sprite: Phaser.Physics.Arcade.Image;
  private readonly body: Phaser.Physics.Arcade.Body;
  private readonly speedPxPerSec: number;
  private blinkTween?: Phaser.Tweens.Tween;
  private expiryEvent?: Phaser.Time.TimerEvent;
  private expired = false;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    speed: number = AIRDROP_FALL_SPEED,
    ttlMs: number = AIRDROP_TTL_MS,
  ) {
    this.sprite = scene.physics.add.image(x, y, "airdrop");
    this.sprite.setDisplaySize(AIRDROP_VISUAL_WIDTH, AIRDROP_VISUAL_HEIGHT);
    this.sprite.setAlpha(1);
    this.speedPxPerSec = speed;

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.moves = true;
    this.body.enable = true;
    this.body.setAllowGravity(false);
    this.body.setSize(AIRDROP_WIDTH, AIRDROP_HEIGHT);
    this.body.setOffset(AIRDROP_BODY_OFFSET_X, AIRDROP_BODY_OFFSET_Y);
    this.blinkTween = scene.tweens.add({
      targets: this.sprite,
      alpha: 0.25,
      duration: 260,
      yoyo: true,
      repeat: -1,
    });

    this.expiryEvent = scene.time.delayedCall(ttlMs, () => {
      this.expired = true;
    });
  }

  update(deltaMs: number) {
    if (this.destroyed) {
      return;
    }
    const dy = (this.speedPxPerSec * deltaMs) / 1000;
    this.sprite.y += dy;
    this.body.updateFromGameObject();
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.expiryEvent?.remove();
    this.expiryEvent = undefined;
    this.blinkTween?.stop();
    this.blinkTween?.remove();
    this.blinkTween = undefined;
    this.body.enable = false;
    this.sprite.destroy();
  }

  destroyIfOutOfBounds(screenHeight: number): boolean {
    if (this.destroyed) {
      return false;
    }
    const halfHeight = this.sprite.displayHeight / 2;
    const isOut = this.sprite.y - halfHeight > screenHeight + AIRDROP_OUT_OF_BOUNDS_MARGIN;
    if (isOut) {
      this.expired = true;
      this.destroy();
    }
    return isOut;
  }

  get isExpired() {
    return this.expired;
  }

  get gameObject() {
    return this.sprite;
  }
}
