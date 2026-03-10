"use client";

import { useEffect, useState } from "react";

import ChessFloorLayer from "@/components/ChessFloorLayer/ChessFloorLayer";
import MatrixBackground from "@/components/MatrixBackground/MatrixBackground";
import PhaserGame from "@/components/PhaserGame/PhaserGame";
import MasterLayer from "@/components/MasterLayer/MasterLayer";
import MobileFallback from "@/components/MobileFallback/MobileFallback";

import styles from "./page.module.css";

const MOBILE_BREAKPOINT_PX = 768;
const MOBILE_POINTER_QUERY = "(pointer: coarse)";

export default function Home() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const pointerMedia = window.matchMedia(MOBILE_POINTER_QUERY);
    const updateViewportMode = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX || pointerMedia.matches);
    };

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    if (typeof pointerMedia.addEventListener === "function") {
      pointerMedia.addEventListener("change", updateViewportMode);
    } else {
      pointerMedia.addListener(updateViewportMode);
    }

    return () => {
      window.removeEventListener("resize", updateViewportMode);
      if (typeof pointerMedia.removeEventListener === "function") {
        pointerMedia.removeEventListener("change", updateViewportMode);
      } else {
        pointerMedia.removeListener(updateViewportMode);
      }
    };
  }, []);

  const showMobileFallback = isMobile === true;
  const showDesktopScene = isMobile === false;
  const footerCopy = showMobileFallback
    ? "© 2026 Master of Candles"
    : "© 2026 Master of Candles. All rights reserved.";

  return (
    <div className={styles.page}>
      <MatrixBackground />
      {showDesktopScene ? <ChessFloorLayer /> : null}
      <main className={`${styles.main} ${styles.contentLayer}`}>
        <div className={`${styles.stage} ${showMobileFallback ? styles.mobileStage : ""}`}>
          {showDesktopScene ? <MasterLayer /> : null}
          <div className={`${styles.gameSlot} ${showMobileFallback ? styles.mobileGameSlot : ""}`}>
            {showMobileFallback ? <MobileFallback /> : null}
            {showDesktopScene ? <PhaserGame /> : null}
          </div>
        </div>
      </main>
      <footer className={`${styles.footer} ${showMobileFallback ? styles.footerMobile : styles.footerDesktop}`}>
        {footerCopy}
      </footer>
    </div>
  );
}
