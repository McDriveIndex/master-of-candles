import type Phaser from "phaser";

export const GAME_WIDTH = 384;
export const GAME_HEIGHT = 216;

export function createGameConfig(
  PhaserLib: typeof Phaser,
  parent: HTMLElement,
  scenes: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: PhaserLib.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    backgroundColor: "#000000",
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
      },
    },
    scale: {
      mode: PhaserLib.Scale.FIT,
      autoCenter: PhaserLib.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    scene: scenes,
  };
}
