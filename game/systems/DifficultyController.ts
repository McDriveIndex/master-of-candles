export type DifficultyParams = {
  spawnIntervalMs: number;
  candleSpeed: number;
  heightScale: number;
  pressureBias: number;
};

export type VolatilityState = {
  isVolatilityActive: boolean;
  volatilityIntensity: number;
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
  basePressureMaxProbability: number;
  macroCycleMinMs: number;
  macroCycleMaxMs: number;
  macroPeakDurationMinMs: number;
  macroPeakDurationMaxMs: number;
  macroRampMs: number;
  macroSpawnMultiplierAtPeak: number;
  macroSpeedMultiplierAtPeak: number;
  macroPressureAddAtPeak: number;
  minAbsoluteSpawnIntervalMs: number;
  maxAbsoluteCandleSpeed: number;
};

const DEFAULT_CONFIG: DifficultyConfig = {
  plateauTimeMs: 112_000,
  spawnIntervalStartMs: 710,
  spawnIntervalMinMs: 292,
  candleSpeedStart: 122,
  candleSpeedMax: 212,
  maxHeightScale: 1.1,
  microAmplitudeMin: 0.12,
  microAmplitudeMax: 0.155,
  microDurationMinMs: 900,
  microDurationMaxMs: 2_000,
  microCooldownMinMs: 3_800,
  microCooldownMaxMs: 5_600,
  basePressureMaxProbability: 0.58,
  macroCycleMinMs: 40_000,
  macroCycleMaxMs: 55_000,
  macroPeakDurationMinMs: 9_000,
  macroPeakDurationMaxMs: 13_000,
  macroRampMs: 1_250,
  macroSpawnMultiplierAtPeak: 0.71,
  macroSpeedMultiplierAtPeak: 1.25,
  macroPressureAddAtPeak: 0.16,
  minAbsoluteSpawnIntervalMs: 260,
  maxAbsoluteCandleSpeed: 240,
};

const DEBUG_VOLATILITY = false;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

export class DifficultyController {
  private readonly config: DifficultyConfig;
  private microUntilMs = 0;
  private nextMicroEligibleMs = 6000;
  private microMultiplier = 1;
  private macroStartMs = 0;
  private macroEndMs = 0;
  private macroDurationMs = 0;
  private wasMacroActive = false;

  constructor(config?: Partial<DifficultyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scheduleNextMacroWindow(0);
  }

  getParams(elapsedMs: number): DifficultyParams {
    this.updateMicroVariation(elapsedMs);
    const { volatilityIntensity: macroFactor, isVolatilityActive: isMacroActive } = this.getVolatilityState(elapsedMs);

    if (DEBUG_VOLATILITY) {
      if (isMacroActive && !this.wasMacroActive) {
        console.log("[VOL] start", {
          elapsedMs,
          durationMs: this.macroDurationMs,
          rampMs: Math.min(this.config.macroRampMs, this.macroDurationMs / 2),
        });
      } else if (!isMacroActive && this.wasMacroActive) {
        console.log("[VOL] end", { elapsedMs });
      }
    }
    this.wasMacroActive = isMacroActive;

    const t = clamp(elapsedMs / this.config.plateauTimeMs, 0, 1);
    const progress = 1 - (1 - t) * (1 - t);

    const baseSpawnInterval = lerp(
      this.config.spawnIntervalStartMs,
      this.config.spawnIntervalMinMs,
      progress,
    );
    const baseCandleSpeed = lerp(this.config.candleSpeedStart, this.config.candleSpeedMax, progress);
    const baseHeightScale = lerp(1, this.config.maxHeightScale, progress);
    const basePressureBias = progress * this.config.basePressureMaxProbability;

    const minSpawn = Math.max(this.config.spawnIntervalMinMs, this.config.minAbsoluteSpawnIntervalMs);
    const maxSpeed = Math.min(this.config.candleSpeedMax, this.config.maxAbsoluteCandleSpeed);

    const spawnIntervalMs = clamp(
      Math.round(
        (baseSpawnInterval / this.microMultiplier) *
          lerp(1, this.config.macroSpawnMultiplierAtPeak, macroFactor),
      ),
      minSpawn,
      this.config.spawnIntervalStartMs,
    );
    const candleSpeed = clamp(
      Math.round(
        baseCandleSpeed * this.microMultiplier * lerp(1, this.config.macroSpeedMultiplierAtPeak, macroFactor),
      ),
      this.config.candleSpeedStart,
      maxSpeed,
    );
    const heightScale = clamp(
      baseHeightScale * (1 + (this.microMultiplier - 1) * 0.5),
      1,
      this.config.maxHeightScale,
    );
    const pressureBias = clamp(basePressureBias + this.config.macroPressureAddAtPeak * macroFactor, 0, 1);

    return { spawnIntervalMs, candleSpeed, heightScale, pressureBias };
  }

  getVolatilityState(elapsedMs: number): VolatilityState {
    const volatilityIntensity = this.getMacroFactor(elapsedMs);
    return {
      isVolatilityActive: volatilityIntensity > 0,
      volatilityIntensity,
    };
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
    const direction = Math.random() < 0.69 ? 1 : -1;
    this.microMultiplier = 1 + amplitude * direction;
    this.microUntilMs = elapsedMs + randomRange(
      this.config.microDurationMinMs,
      this.config.microDurationMaxMs,
    );
  }

  private getMacroFactor(elapsedMs: number): number {
    while (elapsedMs >= this.macroEndMs) {
      this.scheduleNextMacroWindow(this.macroEndMs);
    }

    if (elapsedMs < this.macroStartMs) {
      return 0;
    }

    const localMs = elapsedMs - this.macroStartMs;
    const rampMs = Math.min(this.config.macroRampMs, this.macroDurationMs / 2);
    if (rampMs <= 0) {
      return 1;
    }

    if (localMs < rampMs) {
      return this.smoothstep(localMs / rampMs);
    }

    if (localMs > this.macroDurationMs - rampMs) {
      return this.smoothstep((this.macroDurationMs - localMs) / rampMs);
    }

    return 1;
  }

  private scheduleNextMacroWindow(fromMs: number) {
    const cycleGap = randomRange(this.config.macroCycleMinMs, this.config.macroCycleMaxMs);
    this.macroDurationMs = randomRange(
      this.config.macroPeakDurationMinMs,
      this.config.macroPeakDurationMaxMs,
    );
    this.macroStartMs = fromMs + cycleGap;
    this.macroEndMs = this.macroStartMs + this.macroDurationMs;
  }

  private smoothstep(x: number): number {
    const t = clamp(x, 0, 1);
    return t * t * (3 - 2 * t);
  }
}
