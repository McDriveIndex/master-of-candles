"use client";

import { type CSSProperties, useEffect, useState } from "react";

import styles from "./MasterLayer.module.css";

const VOLATILITY_EVENT_NAME = "moc:volatility-change";

type VolatilityEventDetail = {
  active?: boolean;
  intensity?: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export default function MasterLayer() {
  const [isVolatilityActive, setIsVolatilityActive] = useState(false);
  const [volatilityIntensity, setVolatilityIntensity] = useState(0);

  useEffect(() => {
    const onVolatilityChange = (event: Event) => {
      const { detail } = event as CustomEvent<VolatilityEventDetail>;
      const isActive = !!detail?.active;
      setIsVolatilityActive(isActive);
      if (!isActive) {
        setVolatilityIntensity(0);
        return;
      }
      const rawIntensity = typeof detail.intensity === "number" ? detail.intensity : 0;
      setVolatilityIntensity(clamp01(rawIntensity));
    };

    window.addEventListener(VOLATILITY_EVENT_NAME, onVolatilityChange as EventListener);
    return () => {
      window.removeEventListener(VOLATILITY_EVENT_NAME, onVolatilityChange as EventListener);
    };
  }, []);

  const layerStyle = { "--volatility-intensity": String(volatilityIntensity) } as CSSProperties;

  return (
    <div
      className={`${styles.layer} ${isVolatilityActive ? styles.volatilityActive : ""}`}
      style={layerStyle}
      aria-hidden="true"
    >
      <div className={`${styles.volatilityBias} ${isVolatilityActive ? styles.volatilityBiasActive : ""}`}>
        <div className={styles.masterBreath}>
          <div className={styles.hoodWrap}>
            <img
              src="/master_hood_backing.png"
              alt="Master hood backing"
              draggable={false}
              className={styles.hoodBacking}
            />
            <img
              src="/master_hood.png"
              alt="Master hood"
              draggable={false}
              className={styles.hood}
            />
            <img
              src="/eyes_glow.png"
              alt="Master glowing eyes"
              draggable={false}
              className={`${styles.eyesGlow} ${styles.eyesPulse}`}
            />
          </div>
          <div className={styles.upperOcclusionPatches}>
            <div className={styles.patchUpperLeft} />
            <div className={styles.patchUpperRight} />
          </div>
          <img
            src="/hand_left_backing.png"
            alt="Master left hand backing"
            draggable={false}
            className={styles.handLeftBacking}
          />
          <img
            src="/hand_left.png"
            alt="Master left hand"
            draggable={false}
            className={styles.handLeft}
          />
          <img
            src="/hand_right_backing.png"
            alt="Master right hand backing"
            draggable={false}
            className={styles.handRightBacking}
          />
          <img
            src="/hand_right.png"
            alt="Master right hand"
            draggable={false}
            className={styles.handRight}
          />
        </div>
      </div>
    </div>
  );
}
