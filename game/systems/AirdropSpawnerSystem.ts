const MIN_SPAWN_INTERVAL_MS = 18_000;
const MAX_SPAWN_INTERVAL_MS = 30_000;
const MIN_PLAYER_SPAWN_DISTANCE = 70;
const POSITION_ATTEMPTS = 8;

const randomRange = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export class AirdropSpawnerSystem {
  private nextSpawnAtMs = 0;

  constructor(nowMs: number) {
    this.scheduleNext(nowMs);
  }

  shouldSpawn(nowMs: number, hasActiveAirdrop: boolean): boolean {
    if (hasActiveAirdrop || nowMs < this.nextSpawnAtMs) {
      return false;
    }

    return true;
  }

  notifyAirdropResolved(nowMs: number) {
    this.scheduleNext(nowMs);
  }

  getMsUntilNextSpawn(nowMs: number): number {
    return Math.max(0, this.nextSpawnAtMs - nowMs);
  }

  pickSpawnX(worldWidth: number, playerX: number, halfWidth: number): number {
    const minX = halfWidth;
    const maxX = worldWidth - halfWidth;

    for (let attempt = 0; attempt < POSITION_ATTEMPTS; attempt += 1) {
      const candidateX = Math.round(randomRange(minX, maxX));
      if (Math.abs(candidateX - playerX) >= MIN_PLAYER_SPAWN_DISTANCE) {
        return candidateX;
      }
    }

    const preferredSide = playerX <= worldWidth / 2 ? maxX : minX;
    let fallbackX = preferredSide;
    if (Math.abs(fallbackX - playerX) < MIN_PLAYER_SPAWN_DISTANCE) {
      const direction = playerX <= worldWidth / 2 ? 1 : -1;
      fallbackX = playerX + direction * MIN_PLAYER_SPAWN_DISTANCE;
    }

    return clamp(Math.round(fallbackX), minX, maxX);
  }

  private scheduleNext(fromMs: number) {
    this.nextSpawnAtMs = fromMs + randomRange(MIN_SPAWN_INTERVAL_MS, MAX_SPAWN_INTERVAL_MS);
  }
}
