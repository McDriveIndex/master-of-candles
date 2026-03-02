import type Phaser from "phaser";

const PLAYER_WIDTH = 20;
const PLAYER_HEIGHT = 12;
const HITBOX_SCALE = 0.85;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export class Player {
  private readonly sprite: Phaser.GameObjects.Rectangle;
  private readonly body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.rectangle(x, y, PLAYER_WIDTH, PLAYER_HEIGHT, 0xf7d463);
    scene.physics.add.existing(this.sprite, false);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setImmovable(false);
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0, 0);

    const hitboxWidth = Math.floor(PLAYER_WIDTH * HITBOX_SCALE);
    const hitboxHeight = Math.floor(PLAYER_HEIGHT * HITBOX_SCALE);
    this.body.setSize(hitboxWidth, hitboxHeight, true);
  }

  setVelocityX(value: number) {
    this.body.setVelocityX(value);
  }

  stopX() {
    this.body.setVelocityX(0);
  }

  setY(value: number) {
    this.sprite.setY(value);
    this.body.setVelocityY(0);
  }

  clampToWorld(worldWidth: number) {
    const halfWidth = this.sprite.displayWidth / 2;
    const clampedX = clamp(this.sprite.x, halfWidth, worldWidth - halfWidth);
    this.sprite.setX(clampedX);
  }

  get gameObject() {
    return this.sprite;
  }
}
