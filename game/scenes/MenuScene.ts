import type Phaser from "phaser";
import { toggleMusicEnabledPreference, updateMusicToggleText } from "../systems/musicPreference";
import { PLAY_SCENE_KEY } from "./PlayScene";

export const MENU_SCENE_KEY = "MenuScene";
const MOC_LOGO_TEXTURE_KEY = "moc-logo";
const MOC_LOGO_TEXTURE_PATH = "/moc_logo.png";
const GAME_LOOP_MUSIC_KEY = "game-loop-music";
const GAME_LOOP_MUSIC_PATH = "/assets/audio/music/game_loop.ogg";

export function createMenuScene(PhaserLib: typeof Phaser) {
  return class MenuScene extends PhaserLib.Scene {
    private musicToggleText?: Phaser.GameObjects.Text;

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
        const eyeGlow = this.add
          .ellipse(
            logo.x,
            logo.y - logo.displayHeight * 0.195 + 0.5,
            logo.displayWidth * 0.088,
            logo.displayHeight * 0.032,
            0xff2a2a,
            0.28,
          )
          .setDepth(22)
          .setBlendMode(PhaserLib.BlendModes.ADD);
        const eyeAura = this.add
          .ellipse(
            logo.x,
            logo.y - logo.displayHeight * 0.195 + 0.5,
            logo.displayWidth * 0.14,
            logo.displayHeight * 0.055,
            0xff2a2a,
            0.12,
          )
          .setDepth(21)
          .setBlendMode(PhaserLib.BlendModes.ADD);
        this.tweens.add({
          targets: eyeGlow,
          alpha: 0.48,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        this.tweens.add({
          targets: eyeGlow,
          scaleX: 1.04,
          scaleY: 1.08,
          duration: 1280,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        this.tweens.add({
          targets: eyeAura,
          alpha: 0.2,
          duration: 1040,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        this.tweens.add({
          targets: eyeAura,
          scaleX: 1.05,
          scaleY: 1.09,
          duration: 1520,
          delay: 90,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      };
      const shouldLoadLogo = !this.textures.exists(MOC_LOGO_TEXTURE_KEY);
      const shouldLoadMusic = !this.cache.audio.exists(GAME_LOOP_MUSIC_KEY);
      if (shouldLoadLogo) {
        this.load.image(MOC_LOGO_TEXTURE_KEY, MOC_LOGO_TEXTURE_PATH);
      } else {
        placeLogo();
      }
      if (shouldLoadMusic) {
        this.load.audio(GAME_LOOP_MUSIC_KEY, GAME_LOOP_MUSIC_PATH);
      }
      if (shouldLoadLogo || shouldLoadMusic) {
        this.load.once(PhaserLib.Loader.Events.COMPLETE, () => {
          if (!this.scene.isActive()) {
            return;
          }
          if (shouldLoadLogo && this.textures.exists(MOC_LOGO_TEXTURE_KEY)) {
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
      });
      updateMusicToggleText(musicToggleText);

      this.input.keyboard?.once("keydown-SPACE", () => {
        this.scene.start(PLAY_SCENE_KEY, { startMusic: true });
      });
      this.events.once(PhaserLib.Scenes.Events.SHUTDOWN, () => {
        this.musicToggleText?.removeAllListeners();
        this.musicToggleText = undefined;
      });
    }
  };
}
