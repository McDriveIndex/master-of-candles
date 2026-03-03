export type LeaderboardEntry = {
  rank: number;
  nickname: string;
  scoreMs: number;
};

export type GetLeaderboardResponse = {
  globalBestMs: number | null;
  top10: LeaderboardEntry[];
};

export type SubmitResponse = {
  globalBestMs: number | null;
  top10: LeaderboardEntry[];
  yourRank: number;
  aroundYou: LeaderboardEntry[];
  saved: boolean;
  requireNickname: boolean;
};

const isLeaderboardEntry = (value: unknown): value is LeaderboardEntry => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.rank === "number" &&
    Number.isFinite(candidate.rank) &&
    typeof candidate.nickname === "string" &&
    typeof candidate.scoreMs === "number" &&
    Number.isFinite(candidate.scoreMs)
  );
};

const parseGetResponse = (value: unknown): GetLeaderboardResponse | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const { globalBestMs, top10 } = candidate;

  const hasValidGlobalBest = globalBestMs === null || (typeof globalBestMs === "number" && Number.isFinite(globalBestMs));
  if (!hasValidGlobalBest || !Array.isArray(top10) || !top10.every(isLeaderboardEntry)) {
    return null;
  }

  return {
    globalBestMs,
    top10,
  };
};

const parseSubmitResponse = (value: unknown): SubmitResponse | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const { globalBestMs, top10, yourRank, aroundYou, saved, requireNickname } = candidate;
  const hasValidGlobalBest = globalBestMs === null || (typeof globalBestMs === "number" && Number.isFinite(globalBestMs));

  if (
    !hasValidGlobalBest ||
    !Array.isArray(top10) ||
    !top10.every(isLeaderboardEntry) ||
    typeof yourRank !== "number" ||
    !Number.isFinite(yourRank) ||
    !Array.isArray(aroundYou) ||
    !aroundYou.every(isLeaderboardEntry) ||
    typeof saved !== "boolean" ||
    typeof requireNickname !== "boolean"
  ) {
    return null;
  }

  return {
    globalBestMs,
    top10,
    yourRank,
    aroundYou,
    saved,
    requireNickname,
  };
};

export async function getLeaderboard(): Promise<GetLeaderboardResponse | null> {
  try {
    const response = await fetch("/api/leaderboard");
    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return parseGetResponse(json);
  } catch {
    return null;
  }
}

export async function submitScore(scoreMs: number, nickname?: string): Promise<SubmitResponse | null> {
  try {
    const response = await fetch("/api/leaderboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        nickname ? { scoreMs, nickname } : { scoreMs },
      ),
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return parseSubmitResponse(json);
  } catch {
    return null;
  }
}
