"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import ChessFloorLayer from "@/components/ChessFloorLayer/ChessFloorLayer";
import MatrixBackground from "@/components/MatrixBackground/MatrixBackground";
import PhaserGame from "@/components/PhaserGame/PhaserGame";
import MasterLayer from "@/components/MasterLayer/MasterLayer";
import MobileFallback from "@/components/MobileFallback/MobileFallback";
import NicknameOverlay from "@/components/NicknameOverlay/NicknameOverlay";

import styles from "./page.module.css";

const MOBILE_BREAKPOINT_PX = 768;
const MOBILE_POINTER_QUERY = "(pointer: coarse)";
const NICKNAME_REQUEST_EVENT_NAME = "moc:ask-nickname";
const NICKNAME_RESULT_EVENT_NAME = "moc:nickname-result";
const BASE_VIEWPORT_WIDTH = 1512;
const BASE_VIEWPORT_HEIGHT = 827;
const BASE_STAGE_WIDTH = 665.2734375;
const BASE_STAGE_HEIGHT = 753.65625;
const BASE_FLOOR_WIDTH = 1481.7578125;
const BASE_FLOOR_BOTTOM_OVERFLOW = 148.859375;
const BASE_FRAME_HEIGHT = 374.2109375;

type NicknameRequestDetail = {
  score: number;
  requestId: number;
  defaultNickname?: string;
};

type NicknameResultDetail = {
  requestId: number;
  nickname: string | null;
};

type NicknamePromptState = {
  score: number;
  requestId: number;
  initialNickname?: string;
};

export default function Home() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [desktopSceneScale, setDesktopSceneScale] = useState(1);
  const [nicknamePrompt, setNicknamePrompt] = useState<NicknamePromptState | null>(null);
  const showMobileFallback = isMobile === true;
  const showDesktopScene = isMobile === false;

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

  useEffect(() => {
    if (typeof window === "undefined" || !showDesktopScene) {
      return;
    }

    const updateDesktopSceneScale = () => {
      const scale = Math.max(
        1,
        Math.min(window.innerWidth / BASE_VIEWPORT_WIDTH, window.innerHeight / BASE_VIEWPORT_HEIGHT),
      );
      setDesktopSceneScale(scale);
    };

    updateDesktopSceneScale();
    window.addEventListener("resize", updateDesktopSceneScale);
    return () => {
      window.removeEventListener("resize", updateDesktopSceneScale);
    };
  }, [showDesktopScene]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onAskNickname = (event: Event) => {
      const { detail } = event as CustomEvent<NicknameRequestDetail>;
      if (typeof detail?.score !== "number" || typeof detail?.requestId !== "number") {
        return;
      }
      setNicknamePrompt({
        score: detail.score,
        requestId: detail.requestId,
        initialNickname: detail.defaultNickname,
      });
    };

    window.addEventListener(NICKNAME_REQUEST_EVENT_NAME, onAskNickname as EventListener);
    return () => {
      window.removeEventListener(NICKNAME_REQUEST_EVENT_NAME, onAskNickname as EventListener);
    };
  }, []);

  const footerCopy = showMobileFallback
    ? "© 2026 Master of Candles"
    : "© 2026 Master of Candles. All rights reserved.";
  const desktopSceneVars = {
    "--desktop-scene-scale": String(desktopSceneScale),
    "--desktop-stage-width": `${BASE_STAGE_WIDTH}px`,
    "--desktop-stage-height": `${BASE_STAGE_HEIGHT}px`,
    "--desktop-frame-height": `${BASE_FRAME_HEIGHT}px`,
    "--desktop-floor-width": `${BASE_FLOOR_WIDTH}px`,
    "--desktop-floor-bottom-overflow": `${BASE_FLOOR_BOTTOM_OVERFLOW}px`,
  } as CSSProperties;

  const emitNicknameResult = (detail: NicknameResultDetail) => {
    window.dispatchEvent(new CustomEvent<NicknameResultDetail>(NICKNAME_RESULT_EVENT_NAME, { detail }));
  };

  const handleNicknameConfirm = (nickname: string) => {
    if (!nicknamePrompt) {
      return;
    }
    emitNicknameResult({ requestId: nicknamePrompt.requestId, nickname });
    setNicknamePrompt(null);
  };

  const handleNicknameCancel = () => {
    if (!nicknamePrompt) {
      return;
    }
    emitNicknameResult({ requestId: nicknamePrompt.requestId, nickname: null });
    setNicknamePrompt(null);
  };

  return (
    <div className={styles.page}>
      <MatrixBackground />
      {showDesktopScene ? (
        <div className={styles.desktopSceneViewport} style={desktopSceneVars}>
          <ChessFloorLayer />
          <main className={`${styles.main} ${styles.contentLayer}`}>
            <div className={styles.desktopSceneRoot}>
              <div className={styles.stage}>
                <MasterLayer />
                <div className={styles.gameSlot}>
                  <PhaserGame />
                </div>
              </div>
            </div>
          </main>
        </div>
      ) : null}
      {showMobileFallback ? (
        <main className={`${styles.main} ${styles.contentLayer}`}>
          <div className={`${styles.stage} ${styles.mobileStage}`}>
            <div className={`${styles.gameSlot} ${styles.mobileGameSlot}`}>
              <MobileFallback />
            </div>
          </div>
        </main>
      ) : null}
      <NicknameOverlay
        key={nicknamePrompt?.requestId ?? -1}
        visible={nicknamePrompt !== null}
        score={nicknamePrompt?.score ?? 0}
        initialNickname={nicknamePrompt?.initialNickname}
        onConfirm={handleNicknameConfirm}
        onCancel={handleNicknameCancel}
      />
      <footer className={`${styles.footer} ${showMobileFallback ? styles.footerMobile : styles.footerDesktop}`}>
        {footerCopy}
      </footer>
    </div>
  );
}
