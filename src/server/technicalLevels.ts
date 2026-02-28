export interface OhlcCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ComputeLevelsOptions {
  swingLookback?: number;
  proximityPercent?: number;
  maxLevelsPerSide?: number;
  useVolumeConfirmation?: boolean;
}

interface PivotPoint {
  price: number;
  time: number;
  volume?: number;
  kind: "support" | "resistance";
}

interface LevelCluster {
  kind: "support" | "resistance";
  avgPrice: number;
  totalWeight: number;
  touches: number;
  pivotCount: number;
  volumeScore: number;
}

export interface TechnicalLevelInfo {
  price: number;
  confidence: number;
  touches: number;
}

export interface TechnicalLevelsResult {
  supportLevels: number[];
  resistanceLevels: number[];
  metadata: {
    method: string;
    confidence: number;
    touchCounts: Record<string, number>;
    detailedLevels: {
      support: TechnicalLevelInfo[];
      resistance: TechnicalLevelInfo[];
    };
    lastUpdated: string;
    settings: Required<ComputeLevelsOptions>;
  };
}

function averageVolume(candles: OhlcCandle[]): number {
  const withVolume = candles.filter((candle) => Number.isFinite(candle.volume));
  if (withVolume.length === 0) return 0;
  const total = withVolume.reduce((sum, candle) => sum + (candle.volume ?? 0), 0);
  return total / withVolume.length;
}

function isPivotHigh(candles: OhlcCandle[], index: number, lookback: number): boolean {
  const current = candles[index];
  for (let i = index - lookback; i <= index + lookback; i++) {
    if (i === index || i < 0 || i >= candles.length) continue;
    if (candles[i].high >= current.high) return false;
  }
  return true;
}

function isPivotLow(candles: OhlcCandle[], index: number, lookback: number): boolean {
  const current = candles[index];
  for (let i = index - lookback; i <= index + lookback; i++) {
    if (i === index || i < 0 || i >= candles.length) continue;
    if (candles[i].low <= current.low) return false;
  }
  return true;
}

function clusterPivots(pivots: PivotPoint[], proximityPercent: number, useVolumeConfirmation: boolean): LevelCluster[] {
  const clusters: LevelCluster[] = [];

  for (const pivot of pivots) {
    const threshold = pivot.price * proximityPercent;
    const volumeMultiplier = useVolumeConfirmation
      ? Math.max(0.5, Math.min((pivot.volume ?? 0) || 1, 3))
      : 1;
    let merged = false;

    for (const cluster of clusters) {
      if (cluster.kind !== pivot.kind) continue;
      if (Math.abs(cluster.avgPrice - pivot.price) <= threshold) {
        const weight = 1 * volumeMultiplier;
        cluster.avgPrice = (cluster.avgPrice * cluster.totalWeight + pivot.price * weight) / (cluster.totalWeight + weight);
        cluster.totalWeight += weight;
        cluster.touches += 1;
        cluster.pivotCount += 1;
        cluster.volumeScore += volumeMultiplier;
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({
        kind: pivot.kind,
        avgPrice: pivot.price,
        totalWeight: volumeMultiplier,
        touches: 1,
        pivotCount: 1,
        volumeScore: volumeMultiplier,
      });
    }
  }

  return clusters;
}

function countTouches(candles: OhlcCandle[], levelPrice: number, tolerancePercent: number): number {
  const tolerance = levelPrice * tolerancePercent;
  let touches = 0;

  for (const candle of candles) {
    const touched = candle.low <= levelPrice + tolerance && candle.high >= levelPrice - tolerance;
    if (touched) touches += 1;
  }

  return touches;
}

export function computeTechnicalLevels(candles: OhlcCandle[], options: ComputeLevelsOptions = {}): TechnicalLevelsResult {
  const settings: Required<ComputeLevelsOptions> = {
    swingLookback: options.swingLookback ?? 3,
    proximityPercent: options.proximityPercent ?? 0.006,
    maxLevelsPerSide: options.maxLevelsPerSide ?? 4,
    useVolumeConfirmation: options.useVolumeConfirmation ?? true,
  };

  if (candles.length < settings.swingLookback * 2 + 1) {
    return {
      supportLevels: [],
      resistanceLevels: [],
      metadata: {
        method: "deterministic:pivot-cluster-touch-score",
        confidence: 0,
        touchCounts: {},
        detailedLevels: { support: [], resistance: [] },
        lastUpdated: new Date().toISOString(),
        settings,
      },
    };
  }

  const avgVol = averageVolume(candles);
  const pivots: PivotPoint[] = [];

  for (let i = settings.swingLookback; i < candles.length - settings.swingLookback; i++) {
    const candle = candles[i];
    const normalizedVolume = avgVol > 0 && candle.volume ? candle.volume / avgVol : 1;
    if (isPivotHigh(candles, i, settings.swingLookback)) {
      pivots.push({ price: candle.high, time: candle.time, volume: normalizedVolume, kind: "resistance" });
    }
    if (isPivotLow(candles, i, settings.swingLookback)) {
      pivots.push({ price: candle.low, time: candle.time, volume: normalizedVolume, kind: "support" });
    }
  }

  const clusters = clusterPivots(pivots, settings.proximityPercent, settings.useVolumeConfirmation);
  const toLevelInfo = (kind: "support" | "resistance"): TechnicalLevelInfo[] => {
    return clusters
      .filter((cluster) => cluster.kind === kind)
      .map((cluster) => {
        const touches = countTouches(candles, cluster.avgPrice, settings.proximityPercent);
        const confidence = Math.min(
          100,
          Math.round((cluster.pivotCount * 20 + touches * 8 + cluster.volumeScore * 6) / 2)
        );
        return {
          price: Number(cluster.avgPrice.toFixed(2)),
          confidence,
          touches,
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, settings.maxLevelsPerSide)
      .sort((a, b) => a.price - b.price);
  };

  const support = toLevelInfo("support");
  const resistance = toLevelInfo("resistance");
  const confidenceInputs = [...support, ...resistance];
  const aggregateConfidence = confidenceInputs.length
    ? Math.round(confidenceInputs.reduce((sum, level) => sum + level.confidence, 0) / confidenceInputs.length)
    : 0;

  const touchCounts = Object.fromEntries(
    [...support, ...resistance].map((level) => [level.price.toFixed(2), level.touches])
  );

  return {
    supportLevels: support.map((level) => level.price),
    resistanceLevels: resistance.map((level) => level.price),
    metadata: {
      method: "deterministic:pivot-cluster-touch-score",
      confidence: aggregateConfidence,
      touchCounts,
      detailedLevels: {
        support,
        resistance,
      },
      lastUpdated: new Date().toISOString(),
      settings,
    },
  };
}
