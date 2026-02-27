import { createHash } from "node:crypto";
import type { NewsItem } from "../types";

interface GetNewsOptions {
  symbols?: string[];
  selectedSymbol?: string;
  includeMacro?: boolean;
  region?: string;
  limit?: number;
  lang?: string;
}

interface ScoredNewsItem extends NewsItem {
  relevanceScore: number;
  isTickerSpecific: boolean;
}

interface EntitySignals {
  symbols: string[];
  exactTickerMentions: number;
  companyNameMentions: number;
  sectorMacroProximity: number;
}

const COMPANY_ALIASES: Record<string, string[]> = {
  AAPL: ["apple", "iphone maker"],
  MSFT: ["microsoft"],
  NVDA: ["nvidia"],
  AMD: ["advanced micro devices", "amd"],
  TSLA: ["tesla"],
  AMZN: ["amazon"],
  META: ["meta", "facebook"],
  GOOGL: ["google", "alphabet"],
  JPM: ["jpmorgan", "jp morgan"],
  XOM: ["exxon", "exxonmobil"],
  CVX: ["chevron"],
  SPY: ["s&p 500", "sp500"],
  QQQ: ["nasdaq 100", "nasdaq-100"]
};

const SYMBOL_SECTORS: Record<string, string[]> = {
  AAPL: ["technology", "consumer electronics"],
  MSFT: ["technology", "software", "cloud"],
  NVDA: ["semiconductor", "ai", "technology"],
  AMD: ["semiconductor", "ai", "technology"],
  TSLA: ["automotive", "ev", "energy"],
  AMZN: ["ecommerce", "cloud", "consumer"],
  META: ["social media", "advertising", "technology"],
  GOOGL: ["search", "advertising", "cloud", "technology"],
  JPM: ["banking", "financials", "rates"],
  XOM: ["energy", "oil", "gas"],
  CVX: ["energy", "oil", "gas"],
  SPY: ["macro", "broad market"],
  QQQ: ["macro", "technology"]
};

const MACRO_CATEGORIES: Record<string, RegExp> = {
  rates: /(federal reserve|fed\b|interest rates?|bond yields?)/,
  inflation: /(inflation|cpi|ppi|price pressures?)/,
  growth: /(gdp|recession|economic growth|jobs report|unemployment)/,
  geopolitics: /(geopolitical|middle east|ukraine|china|tariff|trade war)/,
  energy: /(oil|crude|natural gas|opec)/,
  market: /(s&p\s?500|nasdaq|dow|futures|volatility|risk-on|risk-off)/
};

const FALLBACK_NEWS: Omit<NewsItem, "id">[] = [
  {
    title: "US futures edge higher ahead of inflation print",
    summary: "Markets are positioning cautiously before the latest inflation data and Federal Reserve commentary.",
    source: "TradeMind Wire",
    publishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    url: "https://example.com/news/us-futures-inflation",
    symbols: ["SPY", "QQQ"],
    topicType: "Macro",
    language: "en",
    sentiment: "Neutral",
    impact: "Medium"
  },
  {
    title: "Semiconductor stocks rally on AI demand optimism",
    summary: "Chipmakers gained after analysts reiterated strong AI infrastructure demand into next quarter.",
    source: "TradeMind Wire",
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    url: "https://example.com/news/semis-ai-demand",
    symbols: ["NVDA", "AMD"],
    topicType: "Ticker-specific",
    language: "en",
    sentiment: "Positive",
    impact: "High"
  }
];

const RSS_FEEDS: Record<string, string[]> = {
  us: [
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EDJI,%5EGSPC,%5EIXIC&region=US&lang=en-US",
    "https://www.investing.com/rss/news_301.rss"
  ],
  global: [
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EDJI,%5EGSPC,%5EIXIC&region=US&lang=en-US",
    "https://www.investing.com/rss/news_1.rss"
  ]
};

export async function getNews(options: GetNewsOptions): Promise<NewsItem[]> {
  const symbols = (options.symbols ?? []).map(normalizeSymbol).filter(Boolean);
  const selectedSymbol = normalizeSymbol(options.selectedSymbol ?? symbols[0] ?? "");
  const trackedSymbols = [...new Set([...symbols, selectedSymbol].filter(Boolean))];
  const includeMacro = options.includeMacro ?? true;
  const region = (options.region ?? "global").toLowerCase();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const language = options.lang?.toLowerCase() ?? "en";

  const feeds = RSS_FEEDS[region] ?? RSS_FEEDS.global;
  const allNews = (await Promise.all(feeds.map((feed) => fetchFeed(feed, trackedSymbols, selectedSymbol, language)))).flat();

  const deduped = dedupeNews(allNews);
  const candidates = deduped.length > 0 ? deduped : fallbackNews(trackedSymbols, selectedSymbol, language);

  const tickerSpecific = candidates
    .filter((item) => item.isTickerSpecific)
    .sort(sortByRelevanceAndDate);
  const macro = candidates
    .filter((item) => !item.isTickerSpecific)
    .sort(sortByRelevanceAndDate);

  const prioritized = includeMacro ? [...tickerSpecific, ...macro] : tickerSpecific;
  return prioritized.slice(0, limit).map(({ relevanceScore: _relevanceScore, isTickerSpecific: _isTickerSpecific, ...item }) => item);
}

function sortByRelevanceAndDate(a: ScoredNewsItem, b: ScoredNewsItem): number {
  if (b.relevanceScore !== a.relevanceScore) {
    return b.relevanceScore - a.relevanceScore;
  }

  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

async function fetchFeed(
  feedUrl: string,
  trackedSymbols: string[],
  selectedSymbol: string,
  language: string
): Promise<ScoredNewsItem[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "tradeapptestAI-news-bot/1.0"
      }
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const items = getItemBlocks(xml);

    return items
      .map((itemXml, index) => toNewsItem(itemXml, feedUrl, trackedSymbols, selectedSymbol, language, index))
      .filter((item): item is ScoredNewsItem => Boolean(item));
  } catch (error) {
    console.error(`Failed to fetch feed ${feedUrl}`, error);
    return [];
  }
}

function toNewsItem(
  itemXml: string,
  feedUrl: string,
  trackedSymbols: string[],
  selectedSymbol: string,
  language: string,
  index: number
): ScoredNewsItem | null {
  const title = decodeHtml(extractTag(itemXml, "title"));
  const summary = decodeHtml(stripHtml(extractTag(itemXml, "description"))).trim();
  const link = extractTag(itemXml, "link");
  const publishedAt = extractTag(itemXml, "pubDate");
  const source = decodeHtml(extractTag(itemXml, "source")) || new URL(feedUrl).hostname;
  const categoryTags = extractTags(itemXml, "category").map((tag) => decodeHtml(stripHtml(tag))).filter(Boolean);

  if (!title || !link || !publishedAt) {
    return null;
  }

  const normalizedUrl = normalizeUrl(link);
  const signals = extractEntitySignals({
    title,
    summary,
    source,
    categoryTags,
    trackedSymbols,
    selectedSymbol
  });
  const sentiment = inferSentiment(`${title} ${summary}`);
  const impact = inferImpact(`${title} ${summary}`, signals.symbols.length > 0);
  const isTickerSpecific = selectedSymbol ? signals.symbols.includes(selectedSymbol) : signals.symbols.length > 0;

  const item: ScoredNewsItem = {
    id: createHash("sha256").update(`${normalizedUrl}|${title}|${index}`).digest("hex"),
    title,
    summary: summary || "No summary available.",
    source,
    publishedAt: new Date(publishedAt).toISOString(),
    url: normalizedUrl,
    symbols: signals.symbols,
    topicType: isTickerSpecific ? "Ticker-specific" : "Macro",
    language,
    sentiment,
    impact,
    relevanceScore: scoreRelevance({
      title,
      summary,
      publishedAt,
      impact,
      sentiment,
      exactTickerMentions: signals.exactTickerMentions,
      companyNameMentions: signals.companyNameMentions,
      sectorMacroProximity: signals.sectorMacroProximity
    }),
    isTickerSpecific
  };

  return item;
}

function fallbackNews(trackedSymbols: string[], selectedSymbol: string, language: string): ScoredNewsItem[] {
  return FALLBACK_NEWS
    .filter((item) => item.language === language)
    .map((item, index) => {
      const title = item.title;
      const summary = item.summary;
      const publishedAt = item.publishedAt;
      const impact = item.impact;
      const sentiment = item.sentiment;
      const signals = extractEntitySignals({
        title,
        summary,
        source: item.source,
        categoryTags: [],
        trackedSymbols,
        selectedSymbol
      });
      const isTickerSpecific = selectedSymbol ? signals.symbols.includes(selectedSymbol) : item.topicType === "Ticker-specific";

      const fallbackItem: ScoredNewsItem = {
        ...item,
        id: createHash("sha256").update(`${item.url}|${item.title}|fallback|${index}`).digest("hex"),
        symbols: signals.symbols.length > 0 ? signals.symbols : item.symbols,
        topicType: isTickerSpecific ? "Ticker-specific" : "Macro",
        relevanceScore: scoreRelevance({
          title,
          summary,
          publishedAt,
          impact,
          sentiment,
          exactTickerMentions: signals.exactTickerMentions,
          companyNameMentions: signals.companyNameMentions,
          sectorMacroProximity: signals.sectorMacroProximity
        }),
        isTickerSpecific
      };

      return fallbackItem;
    })
    .filter((item) => !selectedSymbol || item.isTickerSpecific || item.topicType === "Macro");
}

function dedupeNews(items: ScoredNewsItem[]): ScoredNewsItem[] {
  const unique = new Map<string, ScoredNewsItem>();

  items.forEach((item) => {
    const titleHash = createHash("sha256").update(item.title.toLowerCase()).digest("hex");
    const dedupeKey = `${normalizeUrl(item.url)}|${titleHash}`;
    const existing = unique.get(dedupeKey);

    if (!existing || item.relevanceScore > existing.relevanceScore) {
      unique.set(dedupeKey, item);
    }
  });

  return [...unique.values()];
}

function scoreRelevance(input: {
  title: string;
  summary: string;
  publishedAt: string;
  impact: NewsItem["impact"];
  sentiment: NewsItem["sentiment"];
  exactTickerMentions: number;
  companyNameMentions: number;
  sectorMacroProximity: number;
}): number {
  const content = `${input.title} ${input.summary}`.toLowerCase();
  const ageHours = Math.max((Date.now() - new Date(input.publishedAt).getTime()) / (1000 * 60 * 60), 0);

  const recencyScore = Math.max(0, 100 - ageHours * 2);
  const exactTickerScore = input.exactTickerMentions * 40;
  const companyNameScore = input.companyNameMentions * 25;
  const proximityScore = input.sectorMacroProximity * 15;
  const impactScore = input.impact === "High" ? 20 : input.impact === "Medium" ? 10 : 5;
  const keywordScore = /(earnings|guidance|federal reserve|rates|merger|acquisition|outlook|forecast)/.test(content) ? 8 : 0;
  const sentimentScore = input.sentiment === "Neutral" ? 0 : 2;

  return recencyScore + exactTickerScore + companyNameScore + proximityScore + impactScore + keywordScore + sentimentScore;
}

function inferImpact(text: string, hasSymbolMatch: boolean): NewsItem["impact"] {
  const normalized = text.toLowerCase();
  const highImpact = /(federal reserve|interest rate|earnings|sec|lawsuit|merger|acquisition|inflation|guidance|bankruptcy)/;
  const mediumImpact = /(upgrade|downgrade|partnership|launch|forecast|analyst)/;

  if (highImpact.test(normalized) || hasSymbolMatch) {
    return "High";
  }

  if (mediumImpact.test(normalized)) {
    return "Medium";
  }

  return "Low";
}

function inferSentiment(text: string): NewsItem["sentiment"] {
  const normalized = text.toLowerCase();

  if (/(surge|beat|gain|rally|growth|bullish|record high|upgrades?)/.test(normalized)) {
    return "Positive";
  }

  if (/(drop|miss|fall|decline|bearish|cuts?|downgrade|lawsuit|pressure)/.test(normalized)) {
    return "Negative";
  }

  return "Neutral";
}

function extractEntitySignals(input: {
  title: string;
  summary: string;
  source: string;
  categoryTags: string[];
  trackedSymbols: string[];
  selectedSymbol: string;
}): EntitySignals {
  const content = `${input.title} ${input.summary}`;
  const sourceMetadata = `${input.source} ${input.categoryTags.join(" ")}`;
  const combined = `${content} ${sourceMetadata}`.toLowerCase();

  const trackedUniverse = [...new Set([...input.trackedSymbols, ...Object.keys(COMPANY_ALIASES)])];
  const symbols = new Set<string>();
  let exactTickerMentions = 0;
  let companyNameMentions = 0;

  trackedUniverse.forEach((symbol) => {
    const tickerPattern = new RegExp(`\\b${escapeRegExp(symbol)}\\b`, "i");
    if (tickerPattern.test(content) || tickerPattern.test(sourceMetadata)) {
      symbols.add(symbol);
      exactTickerMentions += 1;
    }

    const aliases = COMPANY_ALIASES[symbol] ?? [];
    const aliasHit = aliases.some((alias) => new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(combined));
    if (aliasHit) {
      symbols.add(symbol);
      companyNameMentions += 1;
    }
  });

  let sectorMacroProximity = 0;
  if (input.selectedSymbol) {
    const sectorTerms = SYMBOL_SECTORS[input.selectedSymbol] ?? [];
    sectorMacroProximity += sectorTerms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(combined)) ? 1 : 0;
  }

  sectorMacroProximity += Object.values(MACRO_CATEGORIES).some((pattern) => pattern.test(combined)) ? 1 : 0;

  return {
    symbols: [...symbols],
    exactTickerMentions,
    companyNameMentions,
    sectorMacroProximity
  };
}

function normalizeSymbol(symbol: string): string {
  return symbol.split(":").pop()?.trim().toUpperCase() ?? "";
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "guccounter"].forEach((key) => {
      parsed.searchParams.delete(key);
    });
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function getItemBlocks(xml: string): string[] {
  return xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
}

function extractTag(xml: string, tagName: string): string {
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, "i");
  const tagRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");

  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch?.[1]) {
    return cdataMatch[1].trim();
  }

  const tagMatch = xml.match(tagRegex);
  return tagMatch?.[1]?.trim() ?? "";
}

function extractTags(xml: string, tagName: string): string[] {
  const matches = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi")) ?? [];
  return matches.map((match) => extractTag(match, tagName)).filter(Boolean);
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
