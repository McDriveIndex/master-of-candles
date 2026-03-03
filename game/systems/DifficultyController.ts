export type DifficultyParams = {
  spawnIntervalMs: number;
  candleSpeed: number;
  heightScale: number;
};

type DifficultyConfig = {
  plateauTimeMs: number;
  spawnIntervalStartMs: number;
  spawnIntervalMinMs: number;
  candleSpeedStart: number;
  candleSpeedMax: number;
  maxHeightScale: number;
  microAmplitudeMin: number;
  microAmplitudeMax: number;
  microDurationMinMs: number;
  microDurationMaxMs: number;
  microCooldownMinMs: number;
  microCooldownMaxMs: number;
};

const DEFAULT_CONFIG: DifficultyConfig = {
  plateauTimeMs: 120_000,
  spawnIntervalStartMs: 720,
  spawnIntervalMinMs: 300,
  candleSpeedStart: 120,
  candleSpeedMax: 205,
  maxHeightScale: 1.1,
  microAmplitudeMin: 0.12,
  microAmplitudeMax: 0.15,
  microDurationMinMs: 800,
  microDurationMaxMs: 1800,
  microCooldownMinMs: 4000,
  microCooldownMaxMs: 6000,
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

export class DifficultyController {
  private readonly config: DifficultyConfig;
  private microUntilMs = 0;
  private nextMicroEligibleMs = 6000;
  private microMultiplier = 1;

  constructor(config?: Partial<DifficultyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getParams(elapsedMs: number): DifficultyParams {
    this.updateMicroVariation(elapsedMs);

    const t = clamp(elapsedMs / this.config.plateauTimeMs, 0, 1);
    const progress = 1 - (1 - t) * (1 - t);

    const baseSpawnInterval = lerp(
      this.config.spawnIntervalStartMs,
      this.config.spawnIntervalMinMs,
      progress,
    );
    const baseCandleSpeed = lerp(this.config.candleSpeedStart, this.config.candleSpeedMax, progress);
    const baseHeightScale = lerp(1, this.config.maxHeightScale, progress);

    const spawnIntervalMs = clamp(
      Math.round(baseSpawnInterval / this.microMultiplier),
      this.config.spawnIntervalMinMs,
      this.config.spawnIntervalStartMs,
    );
    const candleSpeed = clamp(
      Math.round(baseCandleSpeed * this.microMultiplier),
      this.config.candleSpeedStart,
      this.config.candleSpeedMax,
    );
    const heightScale = clamp(
      baseHeightScale * (1 + (this.microMultiplier - 1) * 0.5),
      1,
      this.config.maxHeightScale,
    );

    return { spawnIntervalMs, candleSpeed, heightScale };
  }

  private updateMicroVariation(elapsedMs: number) {
    if (elapsedMs < this.microUntilMs) {
      return;
    }

    if (this.microUntilMs > 0) {
      this.microUntilMs = 0;
      this.microMultiplier = 1;
      this.nextMicroEligibleMs = elapsedMs + randomRange(
        this.config.microCooldownMinMs,
        this.config.microCooldownMaxMs,
      );
      return;
    }

    if (elapsedMs < this.nextMicroEligibleMs) {
      return;
    }

    const amplitude = randomRange(this.config.microAmplitudeMin, this.config.microAmplitudeMax);
    const direction = Math.random() < 0.65 ? 1 : -1;
    this.microMultiplier = 1 + amplitude * direction;
    this.microUntilMs = elapsedMs + randomRange(
      this.config.microDurationMinMs,
      this.config.microDurationMaxMs,
    );
  }
}
