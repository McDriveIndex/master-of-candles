"use client";

import { useEffect, useRef } from "react";
import type Phaser from "phaser";

import styles from "./PhaserGame.module.css";

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    let cancelled = false;
    const containerElement = containerRef.current;

    const mountGame = async () => {
      if (!containerElement || gameRef.current) {
        return;
      }

      const { createPhaserGame } = await import("@/game");
      const game = await createPhaserGame(containerElement);

      if (cancelled) {
        game.destroy(true);
        return;
      }

      gameRef.current = game;
    };

    void mountGame();

    return () => {
      cancelled = true;

      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }

      if (containerElement) {
        containerElement.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.container} aria-label="Phaser game" />
    </div>
  );
}
