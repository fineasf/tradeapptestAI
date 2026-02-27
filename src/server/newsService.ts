import { createHash } from "node:crypto";
import type { NewsItem } from "../types";

interface GetNewsOptions {
  symbols?: string[];
  region?: string;
  limit?: number;
  lang?: string;
}

interface ScoredNewsItem extends NewsItem {
  relevanceScore: number;
}


const FALLBACK_NEWS: Omit<NewsItem, "id">[] = [
  {
    title: "US futures edge higher ahead of inflation print",
    summary: "Markets are positioning cautiously before the latest inflation data and Federal Reserve commentary.",
    source: "TradeMind Wire",
    publishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    url: "https://example.com/news/us-futures-inflation",
    symbols: ["SPY", "QQQ"],
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
  const region = (options.region ?? "global").toLowerCase();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const language = options.lang?.toLowerCase() ?? "en";

  const feeds = RSS_FEEDS[region] ?? RSS_FEEDS.global;
  const allNews = (await Promise.all(feeds.map((feed) => fetchFeed(feed, symbols, language)))).flat();

  const deduped = dedupeNews(allNews);
  const candidates = deduped.length > 0 ? deduped : fallbackNews(symbols, language);
  const sorted = candidates.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }

    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return sorted.slice(0, limit).map(({ relevanceScore: _relevanceScore, ...item }) => item);
}

async function fetchFeed(feedUrl: string, requestedSymbols: string[], language: string): Promise<ScoredNewsItem[]> {
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
      .map((itemXml, index) => toNewsItem(itemXml, feedUrl, requestedSymbols, language, index))
      .filter((item): item is ScoredNewsItem => Boolean(item));
  } catch (error) {
    console.error(`Failed to fetch feed ${feedUrl}`, error);
    return [];
  }
}

function toNewsItem(
  itemXml: string,
  feedUrl: string,
  requestedSymbols: string[],
  language: string,
  index: number
): ScoredNewsItem | null {
  const title = decodeHtml(extractTag(itemXml, "title"));
  const summary = decodeHtml(stripHtml(extractTag(itemXml, "description"))).trim();
  const link = extractTag(itemXml, "link");
  const publishedAt = extractTag(itemXml, "pubDate");
  const source = decodeHtml(extractTag(itemXml, "source")) || new URL(feedUrl).hostname;

  if (!title || !link || !publishedAt) {
    return null;
  }

  const normalizedUrl = normalizeUrl(link);
  const matchedSymbols = findSymbols(`${title} ${summary}`, requestedSymbols);
  const sentiment = inferSentiment(`${title} ${summary}`);
  const impact = inferImpact(`${title} ${summary}`, matchedSymbols.length > 0);

  const item: ScoredNewsItem = {
    id: createHash("sha256").update(`${normalizedUrl}|${title}|${index}`).digest("hex"),
    title,
    summary: summary || "No summary available.",
    source,
    publishedAt: new Date(publishedAt).toISOString(),
    url: normalizedUrl,
    symbols: matchedSymbols,
    language,
    sentiment,
    impact,
    relevanceScore: scoreRelevance({ title, summary, publishedAt, matchedSymbols, impact, sentiment })
  };

  return item;
}


function fallbackNews(requestedSymbols: string[], language: string): ScoredNewsItem[] {
  return FALLBACK_NEWS
    .filter((item) => item.language === language)
    .map((item, index) => {
      const matchedSymbols = requestedSymbols.length > 0
        ? item.symbols.filter((symbol) => requestedSymbols.includes(symbol))
        : item.symbols;
      const itemSymbols = matchedSymbols.length > 0 ? matchedSymbols : item.symbols;

      const title = item.title;
      const summary = item.summary;
      const publishedAt = item.publishedAt;
      const impact = item.impact;
      const sentiment = item.sentiment;

      return {
        ...item,
        id: createHash("sha256").update(`${item.url}|${item.title}|fallback|${index}`).digest("hex"),
        symbols: itemSymbols,
        relevanceScore: scoreRelevance({ title, summary, publishedAt, matchedSymbols, impact, sentiment })
      };
    });
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
  matchedSymbols: string[];
  impact: NewsItem["impact"];
  sentiment: NewsItem["sentiment"];
}): number {
  const content = `${input.title} ${input.summary}`.toLowerCase();
  const ageHours = Math.max((Date.now() - new Date(input.publishedAt).getTime()) / (1000 * 60 * 60), 0);

  const recencyScore = Math.max(0, 100 - ageHours * 2);
  const symbolScore = input.matchedSymbols.length * 30;
  const impactScore = input.impact === "High" ? 20 : input.impact === "Medium" ? 10 : 5;
  const keywordScore = /(earnings|guidance|federal reserve|rates|merger|acquisition|outlook|forecast)/.test(content) ? 8 : 0;
  const sentimentScore = input.sentiment === "Neutral" ? 0 : 2;

  return recencyScore + symbolScore + impactScore + keywordScore + sentimentScore;
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

function findSymbols(text: string, requestedSymbols: string[]): string[] {
  if (requestedSymbols.length === 0) {
    return [];
  }

  const upper = text.toUpperCase();
  return requestedSymbols.filter((symbol) => upper.includes(symbol));
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
