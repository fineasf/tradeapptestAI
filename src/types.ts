export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  impact: "High" | "Medium" | "Low";
  sentiment: "Positive" | "Negative" | "Neutral";
  publishedAt: string;
  url: string;
  symbols: string[];
  topicType: "Ticker-specific" | "Macro";
  source: string;
  language: string;
}

export interface AIAnalysisResult {
  symbol: string;
  signal: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  confidence: number;
  supportLevels: number[];
  resistanceLevels: number[];
  summary: string;
  keyFactors: string[];
}

export interface AICommentaryResult {
  symbol: string;
  signal: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  confidence: number;
  summary: string;
  keyFactors: string[];
}

export interface TechnicalLevelInfo {
  price: number;
  confidence: number;
  touches: number;
}

export interface TechnicalLevelsResponse {
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
    settings: {
      swingLookback: number;
      proximityPercent: number;
      maxLevelsPerSide: number;
      useVolumeConfirmation: boolean;
    };
  };
}
