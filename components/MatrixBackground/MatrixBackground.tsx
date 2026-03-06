"use client";

import { useEffect, useRef } from "react";

import styles from "./MatrixBackground.module.css";

const SPRITE_PATH = "/assets/matrix/ritual-glyphs.png";
const GLYPH_SIZE = 12;
const RENDER_GLYPH_SIZE = 18;
const GLYPH_COLUMNS = 16;
const GLYPH_ROWS = 6;
const GLYPH_COUNT = GLYPH_COLUMNS * GLYPH_ROWS;
const COLUMN_SPACING = 10;
const ACTIVE_COLUMN_DENSITY = 1;
const BODY_BASE_OPACITY = 0.13;
const HEAD_BASE_OPACITY = 0.32;
const HEAD_BRIGHT_OPACITY = 0.46;
const BRIGHT_CHANCE = 0.12;
const TRAIL_FADE_ALPHA = 0.32;
const TARGET_FPS = 30;
const FRAME_TIME_MS = 1000 / TARGET_FPS;
const MAX_FRAME_DELTA_MS = 120;
const MAX_ACCUMULATED_TIME_MS = FRAME_TIME_MS * 3;
const MIN_SPEED_PX_PER_SEC = 20;
const MAX_SPEED_PX_PER_SEC = 42;
const MIN_GLYPH_SWITCH_MS = 420;
const MAX_GLYPH_SWITCH_MS = 980;
const MIN_COLUMN_MUTATION_MS = 260;
const MAX_COLUMN_MUTATION_MS = 640;
const TRAIL_VERTICAL_STEP = 20;
const VERTICAL_OVERFLOW_ROWS = 6;
const MIN_COLUMN_DEPTH = 0.76;
const MAX_COLUMN_DEPTH = 1;
const HEAD_GLOW_ALPHA = 0.12;
const HEAD_GLOW_SCALE = 1.18;
const RED_TINT = "rgb(188, 20, 24)";

type ColumnState = {
  active: boolean;
  depth: number;
  speedPxPerSec: number;
  x: number;
  scrollOffsetPx: number;
  glyphSwitchIntervalMs: number;
  glyphSwitchTimerMs: number;
  mutationIntervalMs: number;
  mutationTimerMs: number;
  accentRow: number;
  accentBright: boolean;
  glyphs: number[];
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const randomGlyphIndex = () => Math.floor(Math.random() * GLYPH_COUNT);
const wrapIndex = (index: number, length: number) => ((index % length) + length) % length;
const alphaClamp = (value: number) => Math.min(1, Math.max(0.03, value));

export default function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      return;
    }

    context.imageSmoothingEnabled = false;

    let viewportWidth = 0;
    let viewportHeight = 0;
    let dpr = 1;
    let isPageVisible = !document.hidden;
    let rafId: number | null = null;
    let isAnimating = false;
    let lastFrameTime = 0;
    let frameAccumulator = 0;
    let columns: ColumnState[] = [];
    let rowsPerColumn = 0;
    let spriteLoaded = false;

    const spriteImage = new Image();
    const tintedSprite = document.createElement("canvas");
    const tintedContext = tintedSprite.getContext("2d");

    const resetColumn = (column: ColumnState, keepX: boolean = true) => {
      column.active = Math.random() < ACTIVE_COLUMN_DENSITY;
      column.depth = randomBetween(MIN_COLUMN_DEPTH, MAX_COLUMN_DEPTH);
      column.speedPxPerSec = randomBetween(MIN_SPEED_PX_PER_SEC, MAX_SPEED_PX_PER_SEC);
      column.scrollOffsetPx = randomBetween(0, TRAIL_VERTICAL_STEP);
      column.glyphSwitchIntervalMs = randomBetween(MIN_GLYPH_SWITCH_MS, MAX_GLYPH_SWITCH_MS);
      column.glyphSwitchTimerMs = 0;
      column.mutationIntervalMs = randomBetween(MIN_COLUMN_MUTATION_MS, MAX_COLUMN_MUTATION_MS);
      column.mutationTimerMs = 0;
      column.accentRow = Math.floor(randomBetween(0, rowsPerColumn));
      column.accentBright = Math.random() < BRIGHT_CHANCE;
      if (column.glyphs.length !== rowsPerColumn) {
        column.glyphs = new Array<number>(rowsPerColumn);
      }
      for (let i = 0; i < rowsPerColumn; i += 1) {
        column.glyphs[i] = randomGlyphIndex();
      }
      if (!keepX) {
        column.x = randomBetween(0, viewportWidth);
      }
    };

    const rebuildColumns = () => {
      const count = Math.max(1, Math.ceil(viewportWidth / COLUMN_SPACING));
      rowsPerColumn = Math.max(
        1,
        Math.ceil((viewportHeight + 2 * VERTICAL_OVERFLOW_ROWS * TRAIL_VERTICAL_STEP) / TRAIL_VERTICAL_STEP) + 1,
      );
      columns = new Array<ColumnState>(count);
      for (let i = 0; i < count; i += 1) {
        const x = i * COLUMN_SPACING + COLUMN_SPACING * 0.5;
        const column: ColumnState = {
          active: false,
          depth: 1,
          speedPxPerSec: 0,
          x,
          scrollOffsetPx: 0,
          glyphSwitchIntervalMs: 0,
          glyphSwitchTimerMs: 0,
          mutationIntervalMs: 0,
          mutationTimerMs: 0,
          accentRow: 0,
          accentBright: false,
          glyphs: new Array<number>(rowsPerColumn),
        };
        resetColumn(column, true);
        column.x = x;
        columns[i] = column;
      }
    };

    const resizeCanvas = () => {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      dpr = Math.max(1, window.devicePixelRatio || 1);

      canvas.width = Math.floor(viewportWidth * dpr);
      canvas.height = Math.floor(viewportHeight * dpr);
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = false;
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.fillStyle = "#000";
      context.fillRect(0, 0, viewportWidth, viewportHeight);

      rebuildColumns();
    };

    const updateColumns = (deltaMs: number) => {
      for (let i = 0; i < columns.length; i += 1) {
        const column = columns[i];
        if (!column.active) {
          continue;
        }

        column.scrollOffsetPx += (column.speedPxPerSec * deltaMs) / 1000;
        column.glyphSwitchTimerMs += deltaMs;
        column.mutationTimerMs += deltaMs;

        if (column.glyphSwitchTimerMs >= column.glyphSwitchIntervalMs) {
          column.glyphSwitchTimerMs = 0;
          column.glyphSwitchIntervalMs = randomBetween(MIN_GLYPH_SWITCH_MS, MAX_GLYPH_SWITCH_MS);
          const mutateCount = Math.max(1, Math.floor(randomBetween(1, 3)));
          for (let j = 0; j < mutateCount; j += 1) {
            const randomRow = Math.floor(randomBetween(0, rowsPerColumn));
            column.glyphs[randomRow] = randomGlyphIndex();
          }
        }

        while (column.scrollOffsetPx >= TRAIL_VERTICAL_STEP) {
          column.scrollOffsetPx -= TRAIL_VERTICAL_STEP;
          for (let j = rowsPerColumn - 1; j > 0; j -= 1) {
            column.glyphs[j] = column.glyphs[j - 1];
          }
          column.glyphs[0] = randomGlyphIndex();
          column.accentRow = wrapIndex(column.accentRow + 1, rowsPerColumn);
        }

        if (column.mutationTimerMs >= column.mutationIntervalMs) {
          column.mutationTimerMs = 0;
          column.mutationIntervalMs = randomBetween(MIN_COLUMN_MUTATION_MS, MAX_COLUMN_MUTATION_MS);
          const mutateCount = Math.max(1, Math.floor(rowsPerColumn * 0.05));
          for (let j = 0; j < mutateCount; j += 1) {
            const randomRow = Math.floor(randomBetween(0, rowsPerColumn));
            column.glyphs[randomRow] = randomGlyphIndex();
          }
          if (Math.random() < 0.3) {
            column.accentRow = Math.floor(randomBetween(0, rowsPerColumn));
            column.accentBright = Math.random() < BRIGHT_CHANCE;
          }
        }
      }
    };

    const renderColumns = () => {
      if (!spriteLoaded || !tintedContext) {
        return;
      }

      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.fillStyle = `rgba(0, 0, 0, ${TRAIL_FADE_ALPHA})`;
      context.fillRect(0, 0, viewportWidth, viewportHeight);

      for (let i = 0; i < columns.length; i += 1) {
        const column = columns[i];
        if (!column.active) {
          continue;
        }

        const baseY = -(VERTICAL_OVERFLOW_ROWS * TRAIL_VERTICAL_STEP) + column.scrollOffsetPx;
        for (let row = 0; row < rowsPerColumn; row += 1) {
          const drawY = baseY + row * TRAIL_VERTICAL_STEP;
          if (drawY < -RENDER_GLYPH_SIZE || drawY > viewportHeight + RENDER_GLYPH_SIZE) {
            continue;
          }

          const glyphIndex = column.glyphs[row];
          const sx = (glyphIndex % GLYPH_COLUMNS) * GLYPH_SIZE;
          const sy = Math.floor(glyphIndex / GLYPH_COLUMNS) * GLYPH_SIZE;
          const normalizedRow = row / rowsPerColumn;
          let alpha = BODY_BASE_OPACITY * (0.86 + (1 - normalizedRow) * 0.24);
          const distanceFromAccent = wrapIndex(row - column.accentRow, rowsPerColumn);
          const isHead = distanceFromAccent === 0;
          if (distanceFromAccent === 0) {
            alpha = column.accentBright ? HEAD_BRIGHT_OPACITY : HEAD_BASE_OPACITY;
          } else if (distanceFromAccent === 1) {
            alpha = Math.max(alpha, HEAD_BASE_OPACITY * 0.72);
          } else if (distanceFromAccent === 2) {
            alpha = Math.max(alpha, HEAD_BASE_OPACITY * 0.52);
          }

          alpha *= column.depth;
          const clampedAlpha = alphaClamp(alpha);

          if (isHead && column.accentBright) {
            const glowSize = RENDER_GLYPH_SIZE * HEAD_GLOW_SCALE;
            const glowYOffset = (glowSize - RENDER_GLYPH_SIZE) * 0.5;
            context.globalCompositeOperation = "lighter";
            context.globalAlpha = alphaClamp(HEAD_GLOW_ALPHA * column.depth);
            context.drawImage(
              tintedSprite,
              sx,
              sy,
              GLYPH_SIZE,
              GLYPH_SIZE,
              column.x - glowSize / 2,
              drawY - glowYOffset,
              glowSize,
              glowSize,
            );
            context.globalCompositeOperation = "source-over";
          }

          context.globalAlpha = clampedAlpha;
          context.drawImage(
            tintedSprite,
            sx,
            sy,
            GLYPH_SIZE,
            GLYPH_SIZE,
            column.x - RENDER_GLYPH_SIZE / 2,
            drawY,
            RENDER_GLYPH_SIZE,
            RENDER_GLYPH_SIZE,
          );
        }
      }

      context.globalAlpha = 1;
    };

    const stopAnimation = () => {
      isAnimating = false;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const startAnimation = () => {
      if (isAnimating || !isPageVisible) {
        return;
      }
      isAnimating = true;
      lastFrameTime = 0;
      frameAccumulator = 0;
      rafId = window.requestAnimationFrame(frame);
    };

    const frame = (time: number) => {
      if (!isAnimating || !isPageVisible) {
        stopAnimation();
        return;
      }

      if (lastFrameTime === 0) {
        lastFrameTime = time;
      }

      const delta = Math.min(time - lastFrameTime, MAX_FRAME_DELTA_MS);
      lastFrameTime = time;
      frameAccumulator = Math.min(frameAccumulator + delta, MAX_ACCUMULATED_TIME_MS);

      while (frameAccumulator >= FRAME_TIME_MS) {
        updateColumns(FRAME_TIME_MS);
        renderColumns();
        frameAccumulator -= FRAME_TIME_MS;
      }

      rafId = window.requestAnimationFrame(frame);
    };

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      if (!isPageVisible) {
        stopAnimation();
        lastFrameTime = 0;
        frameAccumulator = 0;
        return;
      }
      startAnimation();
    };

    const handleResize = () => {
      resizeCanvas();
    };

    spriteImage.onload = () => {
      if (!tintedContext) {
        return;
      }
      tintedSprite.width = spriteImage.width;
      tintedSprite.height = spriteImage.height;
      tintedContext.clearRect(0, 0, tintedSprite.width, tintedSprite.height);
      tintedContext.drawImage(spriteImage, 0, 0);
      tintedContext.globalCompositeOperation = "source-atop";
      tintedContext.fillStyle = RED_TINT;
      tintedContext.fillRect(0, 0, tintedSprite.width, tintedSprite.height);
      tintedContext.globalCompositeOperation = "source-over";
      spriteLoaded = true;
    };

    spriteImage.src = SPRITE_PATH;

    resizeCanvas();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", handleResize);
    startAnimation();

    return () => {
      stopAnimation();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
