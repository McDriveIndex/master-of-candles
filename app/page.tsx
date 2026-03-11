"use client";

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
  const [nicknamePrompt, setNicknamePrompt] = useState<NicknamePromptState | null>(null);

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

  const showMobileFallback = isMobile === true;
  const showDesktopScene = isMobile === false;
  const footerCopy = showMobileFallback
    ? "© 2026 Master of Candles"
    : "© 2026 Master of Candles. All rights reserved.";

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
      {showDesktopScene ? <ChessFloorLayer /> : null}
      <main className={`${styles.main} ${styles.contentLayer}`}>
        <div className={`${styles.stage} ${showMobileFallback ? styles.mobileStage : ""}`}>
          {showDesktopScene ? (
            <div className={styles.desktopSceneScale}>
              <MasterLayer />
              <div className={styles.gameSlot}>
                <PhaserGame />
              </div>
            </div>
          ) : null}
          {showMobileFallback ? (
            <div className={`${styles.gameSlot} ${styles.mobileGameSlot}`}>
              <MobileFallback />
            </div>
          ) : null}
        </div>
      </main>
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
