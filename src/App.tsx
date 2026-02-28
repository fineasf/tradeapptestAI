import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Chart } from "./components/Chart";
import { NewsPanel } from "./components/NewsPanel";
import { AIAnalysis } from "./components/AIAnalysis";
import { mockAIAnalysis } from "./data";
import {
  AIAnalysisResult,
  NewsItem,
  Stock,
  TechnicalLevelsResponse,
} from "./types";

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState("NASDAQ:NVDA");
  const [timeframe, setTimeframe] = useState("D");
  const [watchlist, setWatchlist] = useState<Stock[]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [levels, setLevels] = useState<TechnicalLevelsResponse | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("watchlist");
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse watchlist", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    if (watchlist.length === 0) return;

    const fetchQuotes = async () => {
      try {
        const symbols = watchlist.map((s) => s.symbol).join(",");
        const res = await fetch(`/api/quotes?symbols=${symbols}`);
        if (res.ok) {
          const data = await res.json();
          setWatchlist((prev) =>
            prev.map((stock) => {
              const quote = data[stock.symbol];
              if (quote) {
                return {
                  ...stock,
                  price: quote.price,
                  change: quote.change,
                  changePercent: quote.changePercent,
                };
              }
              return stock;
            })
          );
        }
      } catch (e) {
        console.error("Failed to fetch quotes", e);
      }
    };

    fetchQuotes();
    const interval = setInterval(fetchQuotes, 10000);
    return () => clearInterval(interval);
  }, [watchlist.length]);

  const handleToggleWatchlist = (stock: Stock) => {
    setWatchlist((prev) => {
      const exists = prev.find((s) => s.symbol === stock.symbol);
      if (exists) {
        return prev.filter((s) => s.symbol !== stock.symbol);
      }
      return [...prev, stock];
    });
  };

  useEffect(() => {
    async function fetchNews() {
      try {
        const params = new URLSearchParams({
          symbols: selectedSymbol,
          selectedSymbol,
          includeMacro: "true",
        });
        const response = await fetch(`/api/news?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch news: ${response.status}`);
        }

        const result = (await response.json()) as NewsItem[];
        setNews(result);
      } catch (error) {
        console.error("Failed to fetch news", error);
        setNews([]);
      }
    }

    fetchNews();
  }, [selectedSymbol]);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchLevels() {
      setLevels(null);
      try {
        const params = new URLSearchParams({
          timeframe,
          lookback: "200",
        });
        const response = await fetch(`/api/levels/${selectedSymbol}?${params.toString()}`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch levels: ${response.status}`);
        }

        const result = (await response.json()) as TechnicalLevelsResponse;
        setLevels(result);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        console.error("Failed to fetch technical levels", error);
        setLevels(null);
      }
    }

    fetchLevels();

    return () => {
      abortController.abort();
    };
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    async function fetchAnalysis() {
      setIsLoading(true);
      const shortSymbol = selectedSymbol.split(":").pop() || selectedSymbol;

      if (mockAIAnalysis[shortSymbol]) {
        const mock = mockAIAnalysis[shortSymbol];
        setAnalysis((prev) => ({
          symbol: shortSymbol,
          signal: mock.signal,
          confidence: mock.confidence,
          summary: mock.summary,
          keyFactors: mock.keyFactors,
          supportLevels: levels?.supportLevels ?? prev?.supportLevels ?? mock.supportLevels,
          resistanceLevels: levels?.resistanceLevels ?? prev?.resistanceLevels ?? mock.resistanceLevels,
        }));
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            symbol: shortSymbol,
            context: `Timeframe ${timeframe}`,
          }),
        });

        if (!response.ok) {
          throw new Error(`Analysis unavailable: ${response.status}`);
        }

        const commentary = (await response.json()) as Pick<
          AIAnalysisResult,
          "symbol" | "signal" | "confidence" | "summary" | "keyFactors"
        >;

        if (commentary) {
          setAnalysis((prev) => ({
            symbol: commentary.symbol || shortSymbol,
            signal: commentary.signal,
            confidence: commentary.confidence,
            summary: commentary.summary,
            keyFactors: commentary.keyFactors,
            supportLevels: levels?.supportLevels ?? prev?.supportLevels ?? [],
            resistanceLevels: levels?.resistanceLevels ?? prev?.resistanceLevels ?? [],
          }));
        }
      } catch (error) {
        console.error("Error fetching AI analysis:", error);
        setAnalysis((prev) => ({
          symbol: shortSymbol,
          signal: "Hold",
          confidence: 50,
          supportLevels: levels?.supportLevels ?? prev?.supportLevels ?? [],
          resistanceLevels: levels?.resistanceLevels ?? prev?.resistanceLevels ?? [],
          summary: "Analysis unavailable. Technical levels are still computed server-side.",
          keyFactors: ["Analysis unavailable", "Using deterministic technical levels", "Try again later"],
        }));
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalysis();
  }, [selectedSymbol, levels]);

  return (
    <div className="flex h-screen bg-[#131722] text-gray-300 font-sans overflow-hidden">
      <Sidebar
        watchlist={watchlist}
        selectedSymbol={selectedSymbol}
        onSelectStock={setSelectedSymbol}
        onToggleWatchlist={handleToggleWatchlist}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
          <div className="lg:col-span-2 flex flex-col gap-4 h-full">
            <div className="flex-1 min-h-0">
              <Chart
                symbol={selectedSymbol}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                supportLevels={levels?.supportLevels ?? []}
                resistanceLevels={levels?.resistanceLevels ?? []}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
              />
            </div>
            <div className="h-64 shrink-0">
              <NewsPanel news={news} />
            </div>
          </div>

          <div className="h-full">
            <AIAnalysis analysis={analysis} isLoading={isLoading} />
          </div>
        </main>
      </div>
    </div>
  );
}
