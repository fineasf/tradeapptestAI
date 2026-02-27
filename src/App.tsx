import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Chart } from "./components/Chart";
import { NewsPanel } from "./components/NewsPanel";
import { AIAnalysis } from "./components/AIAnalysis";
import { mockAIAnalysis } from "./data";
import { AIAnalysisResult, NewsItem, Stock } from "./types";
import { GoogleGenAI, Type } from "@google/genai";

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState("NASDAQ:NVDA");
  const [watchlist, setWatchlist] = useState<Stock[]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load watchlist from local storage on mount
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

  // Save watchlist to local storage when it changes
  useEffect(() => {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  // Real-time updates for watchlist
  useEffect(() => {
    if (watchlist.length === 0) return;

    const fetchQuotes = async () => {
      try {
        const symbols = watchlist.map(s => s.symbol).join(',');
        const res = await fetch(`/api/quotes?symbols=${symbols}`);
        if (res.ok) {
          const data = await res.json();
          setWatchlist(prev => prev.map(stock => {
            const quote = data[stock.symbol];
            if (quote) {
              return {
                ...stock,
                price: quote.price,
                change: quote.change,
                changePercent: quote.changePercent
              };
            }
            return stock;
          }));
        }
      } catch (e) {
        console.error("Failed to fetch quotes", e);
      }
    };

    fetchQuotes();
    const interval = setInterval(fetchQuotes, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [watchlist.length]); // Only re-run if length changes to avoid infinite loop

  const handleToggleWatchlist = (stock: Stock) => {
    setWatchlist(prev => {
      const exists = prev.find(s => s.symbol === stock.symbol);
      if (exists) {
        return prev.filter(s => s.symbol !== stock.symbol);
      } else {
        return [...prev, stock];
      }
    });
  };

  useEffect(() => {
    async function fetchNews() {
      try {
        const params = new URLSearchParams({
          symbols: selectedSymbol,
          selectedSymbol,
          includeMacro: "true"
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
    async function fetchAnalysis() {
      setIsLoading(true);
      
      const shortSymbol = selectedSymbol.split(':').pop() || selectedSymbol;

      // If we have mock data, use it immediately for a fast response
      if (mockAIAnalysis[shortSymbol]) {
        setAnalysis(mockAIAnalysis[shortSymbol]);
        setIsLoading(false);
        return;
      }

      // Otherwise, generate it using Gemini
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analyze the stock ${shortSymbol} for a day trader. Provide support levels, resistance levels, a signal (Strong Buy, Buy, Hold, Sell, Strong Sell), confidence score (0-100), a short summary, and 3 key factors.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                symbol: { type: Type.STRING },
                signal: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                supportLevels: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                resistanceLevels: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                summary: { type: Type.STRING },
                keyFactors: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["symbol", "signal", "confidence", "supportLevels", "resistanceLevels", "summary", "keyFactors"]
            }
          }
        });

        if (response.text) {
          const result = JSON.parse(response.text) as AIAnalysisResult;
          setAnalysis(result);
        }
      } catch (error) {
        console.error("Error fetching AI analysis:", error);
        // Fallback
        setAnalysis({
          symbol: shortSymbol,
          signal: "Hold",
          confidence: 50,
          supportLevels: [100, 90],
          resistanceLevels: [110, 120],
          summary: "Unable to fetch real-time AI analysis. Showing default placeholder.",
          keyFactors: ["API Error", "Check console", "Fallback data"]
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalysis();
  }, [selectedSymbol]);

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
          {/* Main Chart Area - Takes up 2 columns on large screens */}
          <div className="lg:col-span-2 flex flex-col gap-4 h-full">
            <div className="flex-1 min-h-0">
              <Chart 
                symbol={selectedSymbol} 
                supportLevels={analysis?.supportLevels}
                resistanceLevels={analysis?.resistanceLevels}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
              />
            </div>
            <div className="h-64 shrink-0">
              <NewsPanel news={news} />
            </div>
          </div>
          
          {/* Right Sidebar - AI Analysis */}
          <div className="h-full">
            <AIAnalysis analysis={analysis} isLoading={isLoading} />
          </div>
        </main>
      </div>
    </div>
  );
}
