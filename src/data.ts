import { Stock, NewsItem, AIAnalysisResult } from "./types";

export const mockWatchlist: Stock[] = [
  { symbol: "AAPL", name: "Apple Inc.", price: 182.52, change: 1.25, changePercent: 0.69 },
  { symbol: "MSFT", name: "Microsoft Corp.", price: 410.34, change: -2.10, changePercent: -0.51 },
  { symbol: "NVDA", name: "NVIDIA Corp.", price: 788.17, change: 2.79, changePercent: 0.36 },
  { symbol: "TSLA", name: "Tesla Inc.", price: 191.97, change: -5.44, changePercent: -2.76 },
  { symbol: "AMZN", name: "Amazon.com Inc.", price: 174.99, change: 0.41, changePercent: 0.23 },
];

export const mockNews: NewsItem[] = [
  {
    id: "1",
    title: "Fed Signals Potential Rate Cuts Later This Year",
    summary: "Federal Reserve officials indicated that they might begin cutting interest rates later this year if inflation continues to cool down, boosting market sentiment.",
    impact: "High",
    sentiment: "Positive",
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    url: "https://example.com/fed-rate-cuts",
    symbols: ["SPY", "QQQ"],
    source: "Financial Times",
    language: "en"
  },
  {
    id: "2",
    title: "Tech Giants Face New Regulatory Scrutiny in EU",
    summary: "The European Union is preparing a new wave of antitrust investigations targeting major US technology companies over data privacy and market dominance.",
    impact: "Medium",
    sentiment: "Negative",
    publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    url: "https://example.com/tech-regulatory-scrutiny",
    symbols: ["AAPL", "MSFT"],
    source: "Reuters",
    language: "en"
  },
  {
    id: "3",
    title: "Oil Prices Surge Amid Middle East Tensions",
    summary: "Crude oil prices jumped 3% today as geopolitical tensions in the Middle East escalated, raising concerns about supply disruptions.",
    impact: "High",
    sentiment: "Negative",
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    url: "https://example.com/oil-prices-surge",
    symbols: ["XOM", "CVX"],
    source: "Bloomberg",
    language: "en"
  }
];

export const mockAIAnalysis: Record<string, AIAnalysisResult> = {
  "AAPL": {
    symbol: "AAPL",
    signal: "Hold",
    confidence: 65,
    supportLevels: [178.50, 175.00],
    resistanceLevels: [185.00, 189.50],
    summary: "AAPL is currently trading in a tight range. AI models suggest consolidation before the next major move. Watch for a breakout above $185 or a breakdown below $178.",
    keyFactors: [
      "Mixed sentiment from recent product launches.",
      "Strong support at the 200-day moving average.",
      "Macroeconomic headwinds affecting consumer spending."
    ]
  },
  "NVDA": {
    symbol: "NVDA",
    signal: "Strong Buy",
    confidence: 88,
    supportLevels: [750.00, 720.00],
    resistanceLevels: [800.00, 825.00],
    summary: "NVDA shows massive bullish momentum driven by AI chip demand. The trend remains strongly upward with high volume supporting recent breakouts.",
    keyFactors: [
      "Unprecedented demand for H100 chips.",
      "Earnings beat expectations by a wide margin.",
      "Technical breakout above previous all-time highs."
    ]
  },
  "TSLA": {
    symbol: "TSLA",
    signal: "Sell",
    confidence: 72,
    supportLevels: [180.00, 165.00],
    resistanceLevels: [205.00, 215.00],
    summary: "TSLA is facing downward pressure due to increased competition and margin compression. AI detects a bearish trend with lower highs and lower lows.",
    keyFactors: [
      "Price cuts impacting profit margins.",
      "Slowing EV demand globally.",
      "Technical breakdown below key support at $200."
    ]
  }
};

// Generate some fake OHLC data for the chart
export function generateChartData(days: number = 100, startPrice: number = 150) {
  const data = [];
  let currentPrice = startPrice;
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    const volatility = currentPrice * 0.02;
    const open = currentPrice + (Math.random() - 0.5) * volatility;
    const close = open + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    
    data.push({
      time: date.toISOString().split('T')[0],
      open,
      high,
      low,
      close,
    });
    
    currentPrice = close;
  }
  
  return data;
}
