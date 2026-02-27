import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../lib/utils";

interface IndexData {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
}

const INITIAL_INDICES: IndexData[] = [
  { name: "S&P 500", symbol: "SP:SPX", value: 0, change: 0, changePercent: 0 },
  { name: "NASDAQ", symbol: "NASDAQ:IXIC", value: 0, change: 0, changePercent: 0 },
  { name: "DOW JONES", symbol: "DJ:DJI", value: 0, change: 0, changePercent: 0 },
  { name: "VIX", symbol: "CBOE:VIX", value: 0, change: 0, changePercent: 0 },
];

export function TopBar() {
  const [indices, setIndices] = useState<IndexData[]>(INITIAL_INDICES);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const symbols = INITIAL_INDICES.map(idx => idx.symbol).join(',');
        const res = await fetch(`/api/quotes?symbols=${symbols}`);
        if (res.ok) {
          const data = await res.json();
          setIndices(prev => prev.map(idx => {
            const quote = data[idx.symbol];
            if (quote) {
              return {
                ...idx,
                value: quote.price,
                change: quote.change,
                changePercent: quote.changePercent
              };
            }
            return idx;
          }));
        }
      } catch (e) {
        console.error("Failed to fetch indices", e);
      }
    };

    fetchIndices();
    const interval = setInterval(fetchIndices, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 bg-[#1E222D] border-b border-[#2A2E39] flex items-center px-4 overflow-x-auto hide-scrollbar">
      <div className="flex items-center gap-6">
        {indices.map((idx) => (
          <div key={idx.name} className="flex items-center gap-3 whitespace-nowrap">
            <span className="text-xs font-semibold text-gray-400">{idx.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">
                {idx.value ? idx.value.toFixed(2) : '---'}
              </span>
              {idx.value > 0 && (
                <span className={cn(
                  "text-xs flex items-center font-medium",
                  idx.change >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {idx.change >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {Math.abs(idx.changePercent || 0).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}
