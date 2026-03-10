import type Phaser from "phaser";

const PLAYER_WIDTH = 20;
const PLAYER_HEIGHT = 12;
const HITBOX_SCALE = 0.85;
const PLAYER_VISUAL_HEIGHT = 36;
const PLAYER_VISUAL_Y_OFFSET = 7;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export class Player {
  private readonly sprite: Phaser.GameObjects.Rectangle;
  private readonly body: Phaser.Physics.Arcade.Body;
  private visual?: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.rectangle(x, y, PLAYER_WIDTH, PLAYER_HEIGHT, 0xf7d463);
    // Keep the physics placeholder permanently hidden; visual rendering is handled by pawn sprites.
    this.sprite.setVisible(false);
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

  enableVisual(scene: Phaser.Scene, textureKey: string): void {
    if (!scene.textures.exists(textureKey)) {
      return;
    }
    if (this.visual) {
      return;
    }

    const y = this.sprite.y + PLAYER_HEIGHT / 2 + PLAYER_VISUAL_Y_OFFSET;
    this.visual = scene.add.sprite(this.sprite.x, y, textureKey);
    this.visual.setOrigin(0.5, 1);
    this.visual.displayHeight = PLAYER_VISUAL_HEIGHT;
    this.visual.scaleX = this.visual.scaleY;
    this.visual.setDepth(this.sprite.depth);
    this.sprite.setVisible(false);
  }

  updateVisual(): void {
    if (!this.visual) {
      return;
    }
    this.visual.x = this.sprite.x;
    this.visual.y = this.sprite.y + PLAYER_HEIGHT / 2 + PLAYER_VISUAL_Y_OFFSET;
    this.visual.setDepth(this.sprite.depth);
  }

  setVisualTexture(textureKey: string): void {
    if (!this.visual) {
      return;
    }
    if (!this.visual.scene.textures.exists(textureKey)) {
      return;
    }
    if (this.visual.texture.key === textureKey) {
      return;
    }
    this.visual.setTexture(textureKey);
  }

  destroy(): void {
    this.visual?.destroy();
    this.sprite.destroy();
  }

  get gameObject() {
    return this.sprite;
  }
}
