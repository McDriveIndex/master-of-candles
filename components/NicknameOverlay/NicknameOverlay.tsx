"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useState } from "react";

import styles from "./NicknameOverlay.module.css";

const NICKNAME_REGEX = /^[A-Z0-9_]{1,16}$/;

type NicknameOverlayProps = {
  visible: boolean;
  score: number;
  initialNickname?: string;
  onConfirm: (nickname: string) => void;
  onCancel: () => void;
};

const formatMs = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;
const stopKeyboardPropagation = (
  event: ReactKeyboardEvent<HTMLInputElement>,
): void => {
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation?.();
};

const sanitizeNickname = (value: string): string =>
  value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 16);

export default function NicknameOverlay({
  visible,
  score,
  initialNickname,
  onConfirm,
  onCancel,
}: NicknameOverlayProps) {
  const [nickname, setNickname] = useState(() => sanitizeNickname(initialNickname ?? ""));

  useEffect(() => {
    if (!visible) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCancel();
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [visible, onCancel]);

  const normalizedNickname = useMemo(() => sanitizeNickname(nickname), [nickname]);
  const isValidNickname = NICKNAME_REGEX.test(normalizedNickname);
  const isConfirmDisabled = normalizedNickname.length === 0 || !isValidNickname;

  if (!visible) {
    return null;
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onCancel}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Enter nickname"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className={styles.title}>ENTER NICKNAME</h2>
        <p className={styles.score}>RUN: {formatMs(score)}</p>
        <input
          autoFocus
          maxLength={16}
          value={nickname}
          onChange={(event) => setNickname(sanitizeNickname(event.target.value))}
          className={styles.input}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          placeholder="TRADER_01"
          aria-label="Nickname"
          onKeyDown={(event) => {
            stopKeyboardPropagation(event);
            if (event.key === "Enter" && !isConfirmDisabled) {
              event.preventDefault();
              onConfirm(normalizedNickname);
            }
          }}
          onKeyUp={stopKeyboardPropagation}
        />
        <p className={styles.hint}>A-Z, 0-9, _</p>
        <button
          type="button"
          className={styles.button}
          disabled={isConfirmDisabled}
          onClick={() => onConfirm(normalizedNickname)}
        >
          CONFIRM
        </button>
      </section>
    </div>
  );
}
