import type Phaser from "phaser";

export const CANDLE_WIDTH = 12;
export const CANDLE_MIN_HEIGHT = 24;
export const CANDLE_MAX_HEIGHT = 90;
export const CANDLE_SPEED = 120;
const OUT_OF_BOUNDS_MARGIN = 2;

export class Candle {
  private readonly sprite: Phaser.GameObjects.Rectangle;
  private readonly body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number, height: number) {
    this.sprite = scene.add.rectangle(x, y, CANDLE_WIDTH, height, 0xf0b35d);
    scene.physics.add.existing(this.sprite, false);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setVelocity(0, CANDLE_SPEED);
  }

  destroy() {
    this.body.enable = false;
    this.sprite.destroy();
  }

  destroyIfOutOfBounds(screenHeight: number): boolean {
    const halfHeight = this.sprite.displayHeight / 2;
    const isOut = this.sprite.y - halfHeight > screenHeight + OUT_OF_BOUNDS_MARGIN;

    if (isOut) {
      this.destroy();
    }

    return isOut;
  }

  get gameObject() {
    return this.sprite;
  }
}
