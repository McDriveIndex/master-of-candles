"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import type Phaser from "phaser";

import styles from "./PhaserGame.module.css";

const VOLATILITY_EVENT_NAME = "moc:volatility-change";

type VolatilityEventDetail = {
  active?: boolean;
  intensity?: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [volatilityIntensity, setVolatilityIntensity] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const containerElement = containerRef.current;
    setIsReady(false);

    const mountGame = async () => {
      if (!containerElement || gameRef.current) {
        return;
      }

      const { createPhaserGame } = await import("@/game");
      const game = await createPhaserGame(containerElement, () => {
        if (!cancelled) {
          setIsReady(true);
        }
      });

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

  useEffect(() => {
    const onVolatilityChange = (event: Event) => {
      const { detail } = event as CustomEvent<VolatilityEventDetail>;
      if (!detail?.active) {
        setVolatilityIntensity(0);
        return;
      }
      const rawIntensity = typeof detail.intensity === "number" ? detail.intensity : 0;
      setVolatilityIntensity(clamp01(rawIntensity));
    };

    window.addEventListener(VOLATILITY_EVENT_NAME, onVolatilityChange as EventListener);
    return () => {
      window.removeEventListener(VOLATILITY_EVENT_NAME, onVolatilityChange as EventListener);
      setVolatilityIntensity(0);
    };
  }, []);

  const isVolatilityActive = volatilityIntensity > 0;
  const volatilityStyle = { "--volatility-intensity": String(volatilityIntensity) } as CSSProperties;

  return (
    <div
      className={`${styles.wrapper} ${isReady ? styles.ready : styles.loading} ${
        isVolatilityActive ? styles.volatilityActive : ""
      }`}
      style={volatilityStyle}
    >
      <div className={styles.placeholder} aria-hidden="true" />
      <div className={styles.container} aria-label="Phaser game">
        <div ref={containerRef} className={styles.canvasHost} />
        <div className={styles.volatilityVignette} aria-hidden="true" />
      </div>
    </div>
  );
}
