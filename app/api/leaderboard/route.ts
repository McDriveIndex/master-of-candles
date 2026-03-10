import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

const NICKNAME_REGEX = /^[A-Za-z0-9_]{1,16}$/;
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_SCORE_MS = 3_600_000;

// Lightweight in-memory rate limit bucket: key = client IP, value = recent submission timestamps.
const submissionRateLimit = new Map<string, number[]>();

type LeaderboardRow = {
  nickname: string | null;
  score_ms: number;
  created_at: string;
};

type LeaderboardEntry = {
  rank: number;
  nickname: string;
  scoreMs: number;
};

type PostPayload = {
  scoreMs?: unknown;
  nickname?: unknown;
};

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function isRateLimited(ip: string, nowMs: number): boolean {
  const bucket = submissionRateLimit.get(ip) ?? [];
  const recentTimestamps = bucket.filter((timestamp) => nowMs - timestamp < RATE_LIMIT_WINDOW_MS);

  if (recentTimestamps.length >= MAX_SUBMISSIONS_PER_WINDOW) {
    submissionRateLimit.set(ip, recentTimestamps);
    return true;
  }

  recentTimestamps.push(nowMs);
  submissionRateLimit.set(ip, recentTimestamps);
  return false;
}

async function fetchTopRows(limit: number): Promise<LeaderboardRow[]> {
  const { data, error } = await supabaseServer
    .from("leaderboard_scores")
    .select("nickname, score_ms, created_at")
    .order("score_ms", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

function mapRowsWithRank(rows: LeaderboardRow[], startRank = 1): LeaderboardEntry[] {
  return rows.map((row, index) => ({
    rank: startRank + index,
    nickname: row.nickname ?? "ANON",
    scoreMs: row.score_ms,
  }));
}

export async function GET() {
  try {
    const rows = await fetchTopRows(10);
    const globalBestMs = rows.length > 0 ? rows[0].score_ms : null;
    const top10 = mapRowsWithRank(rows);

    return NextResponse.json({ globalBestMs, top10 });
  } catch {
    return NextResponse.json({ error: "Leaderboard fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp, Date.now())) {
      return NextResponse.json({ error: "Too many submissions. Please wait." }, { status: 429 });
    }

    let body: PostPayload;
    try {
      body = (await request.json()) as PostPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const scoreMs = body.scoreMs;
    const nickname =
      typeof body.nickname === "string" ? body.nickname : undefined;

    if (typeof scoreMs !== "number" || !Number.isFinite(scoreMs) || scoreMs < 0 || scoreMs > MAX_SCORE_MS) {
      return NextResponse.json({ error: "Invalid score value." }, { status: 400 });
    }
    const scoreMsInt = Math.floor(scoreMs);
    if (scoreMsInt < 0 || scoreMsInt > MAX_SCORE_MS) {
      return NextResponse.json({ error: "Invalid score value." }, { status: 400 });
    }

    const hasValidNickname = typeof nickname === "string" && NICKNAME_REGEX.test(nickname);
    const nowIso = new Date().toISOString();

    const [
      { count: higherCount, error: higherCountError },
      { count: equalEarlierCount, error: equalEarlierCountError },
    ] = await Promise.all([
      supabaseServer
        .from("leaderboard_scores")
        .select("id", { count: "exact", head: true })
        .gt("score_ms", scoreMsInt),
      supabaseServer
        .from("leaderboard_scores")
        .select("id", { count: "exact", head: true })
        .eq("score_ms", scoreMsInt)
        .lt("created_at", nowIso),
    ]);

    if (higherCountError) {
      throw higherCountError;
    }

    if (equalEarlierCountError) {
      throw equalEarlierCountError;
    }

    const yourRank = (higherCount ?? 0) + (equalEarlierCount ?? 0) + 1;

    let saved = false;
    let requireNickname = false;

    if (yourRank <= 100) {
      if (hasValidNickname && nickname) {
        const { error: insertError } = await supabaseServer.from("leaderboard_scores").insert({
          nickname,
          score_ms: scoreMsInt,
        });

        if (insertError) {
          throw insertError;
        }
        saved = true;
      } else {
        requireNickname = true;
      }
    }

    const topRows = await fetchTopRows(5);
    const globalBestMs = topRows.length > 0 ? topRows[0].score_ms : null;
    const top10 = mapRowsWithRank(topRows);

    let aroundYou: LeaderboardEntry[] = [];
    if (yourRank > 5) {
      const aroundStartRank = Math.max(1, yourRank - 1);
      const aroundEndRank = yourRank + 1;
      const { data: aroundRows, error: aroundError } = await supabaseServer
        .from("leaderboard_scores")
        .select("nickname, score_ms, created_at")
        .order("score_ms", { ascending: false })
        .order("created_at", { ascending: true })
        .range(aroundStartRank - 1, aroundEndRank - 1);

      if (aroundError) {
        throw aroundError;
      }

      aroundYou = mapRowsWithRank(aroundRows ?? [], aroundStartRank);
    }

    return NextResponse.json({
      globalBestMs,
      top10,
      yourRank,
      aroundYou,
      saved,
      requireNickname,
    });
  } catch (error) {
    const typedError = error as { message?: string; stack?: string };
    console.error("[leaderboard POST] failed", typedError);

    if (process.env.NODE_ENV === "development") {
      return NextResponse.json(
        {
          error: "Leaderboard submit failed",
          details: String(typedError?.message ?? error),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: "Leaderboard submit failed" }, { status: 500 });
  }
}
