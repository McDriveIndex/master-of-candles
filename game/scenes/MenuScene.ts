import type Phaser from "phaser";
import { PLAY_SCENE_KEY } from "./PlayScene";

export const MENU_SCENE_KEY = "MenuScene";
const MOC_LOGO_TEXTURE_KEY = "moc-logo";
const MOC_LOGO_TEXTURE_PATH = "/moc_logo.png";

export function createMenuScene(PhaserLib: typeof Phaser) {
  return class MenuScene extends PhaserLib.Scene {
    constructor() {
      super(MENU_SCENE_KEY);
    }

    create() {
      const { width, height } = this.scale;

      this.cameras.main.setBackgroundColor("#000000");

      const placeLogo = () => {
        const logo = this.add
          .image(width / 2, height * 0.51, MOC_LOGO_TEXTURE_KEY)
          .setOrigin(0.5)
          .setDepth(20);
        logo.displayWidth = width * 0.72;
        logo.scaleY = logo.scaleX;
      };
      if (this.textures.exists(MOC_LOGO_TEXTURE_KEY)) {
        placeLogo();
      } else {
        this.load.image(MOC_LOGO_TEXTURE_KEY, MOC_LOGO_TEXTURE_PATH);
        this.load.once(PhaserLib.Loader.Events.COMPLETE, () => {
          if (this.scene.isActive() && this.textures.exists(MOC_LOGO_TEXTURE_KEY)) {
            placeLogo();
          }
        }, this);
        this.load.start();
      }

      const promptText = this.add
        .text(width / 2, height * 0.88, "PRESS SPACE TO BEGIN", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#d4d4d4",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(30);
      this.tweens.add({
        targets: promptText,
        alpha: 0.55,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      this.input.keyboard?.once("keydown-SPACE", () => {
        this.scene.start(PLAY_SCENE_KEY);
      });
    }
  };
}
