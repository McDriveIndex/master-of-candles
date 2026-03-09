import type Phaser from "phaser";
import { readMusicEnabledPreference, toggleMusicEnabledPreference, updateMusicToggleText } from "../systems/musicPreference";
import { PLAY_SCENE_KEY } from "./PlayScene";

export const MENU_SCENE_KEY = "MenuScene";
const MOC_LOGO_TEXTURE_KEY = "moc-logo";
const MOC_LOGO_TEXTURE_PATH = "/moc_logo.png";
const GAME_LOOP_MUSIC_KEY = "game-loop-music";
const GAME_LOOP_MUSIC_PATH = "/assets/audio/music/game_loop.ogg";
const MENU_LOOP_MUSIC_KEY = "menu-loop-music";
const MENU_LOOP_MUSIC_PATH = "/assets/audio/music/menu_loop.ogg";
const MENU_LOOP_MUSIC_VOLUME = 0.6;

export function createMenuScene(PhaserLib: typeof Phaser) {
  return class MenuScene extends PhaserLib.Scene {
    private musicToggleText?: Phaser.GameObjects.Text;
    private menuLoopMusic?: Phaser.Sound.BaseSound;

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
      const shouldLoadGameMusic = !this.cache.audio.exists(GAME_LOOP_MUSIC_KEY);
      const shouldLoadMenuMusic = !this.cache.audio.exists(MENU_LOOP_MUSIC_KEY);
      if (shouldLoadLogo) {
        this.load.image(MOC_LOGO_TEXTURE_KEY, MOC_LOGO_TEXTURE_PATH);
      } else {
        placeLogo();
      }
      if (shouldLoadGameMusic) {
        this.load.audio(GAME_LOOP_MUSIC_KEY, GAME_LOOP_MUSIC_PATH);
      }
      if (shouldLoadMenuMusic) {
        this.load.audio(MENU_LOOP_MUSIC_KEY, MENU_LOOP_MUSIC_PATH);
      }
      if (shouldLoadLogo || shouldLoadGameMusic || shouldLoadMenuMusic) {
        this.load.once(PhaserLib.Loader.Events.COMPLETE, () => {
          if (!this.scene.isActive()) {
            return;
          }
          if (shouldLoadLogo && this.textures.exists(MOC_LOGO_TEXTURE_KEY)) {
            placeLogo();
          }
          this.syncMenuLoopMusicWithPreference();
        }, this);
        this.load.start();
      } else {
        this.syncMenuLoopMusicWithPreference();
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
        this.syncMenuLoopMusicWithPreference();
      });
      updateMusicToggleText(musicToggleText);

      this.input.keyboard?.once("keydown-SPACE", () => {
        this.stopMenuLoopMusic();
        this.scene.start(PLAY_SCENE_KEY, { startMusic: true });
      });
      this.events.once(PhaserLib.Scenes.Events.SHUTDOWN, () => {
        this.musicToggleText?.removeAllListeners();
        this.musicToggleText = undefined;
        this.stopMenuLoopMusic();
      });
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
  };
}
