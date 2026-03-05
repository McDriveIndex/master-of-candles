import type Phaser from "phaser";

import { createGameConfig } from "./config";
import { createGameOverScene } from "./scenes/GameOverScene";
import { createMenuScene } from "./scenes/MenuScene";
import { createPlayScene } from "./scenes/PlayScene";

export async function createPhaserGame(
  parent: HTMLElement,
  onReady?: () => void,
): Promise<Phaser.Game> {
  const PhaserLib = await import("phaser");

  const MenuScene = createMenuScene(PhaserLib);
  const PlayScene = createPlayScene(PhaserLib);
  const GameOverScene = createGameOverScene(PhaserLib);

  const game = new PhaserLib.Game(
    createGameConfig(PhaserLib, parent, [MenuScene, PlayScene, GameOverScene]),
  );

  let readySignaled = false;
  game.events.once(PhaserLib.Core.Events.READY, () => {
    game.canvas.style.imageRendering = "pixelated";
    if (readySignaled) {
      return;
    }
    readySignaled = true;
    requestAnimationFrame(() => onReady?.());
  });

  return game;
}
