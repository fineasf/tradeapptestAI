import { Globe, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { NewsItem } from "../types";
import { cn } from "../lib/utils";

interface NewsPanelProps {
  news: NewsItem[];
}

export function NewsPanel({ news }: NewsPanelProps) {
  return (
    <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-[#2A2E39] flex items-center gap-2">
        <Globe className="w-5 h-5 text-blue-400" />
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Market Impact News</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {news.map((item) => (
          <div key={item.id} className="bg-[#2A2E39] rounded-lg p-3 border border-[#363A45] hover:border-blue-500/50 transition-colors cursor-pointer">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-400">{item.time} • {item.source}</span>
              <div className="flex gap-2">
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider flex items-center gap-1",
                  item.impact === "High" ? "bg-rose-500/20 text-rose-400" :
                  item.impact === "Medium" ? "bg-amber-500/20 text-amber-400" :
                  "bg-blue-500/20 text-blue-400"
                )}>
                  {item.impact === "High" && <AlertTriangle className="w-3 h-3" />}
                  {item.impact} Impact
                </span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider",
                  item.sentiment === "Positive" ? "bg-emerald-500/20 text-emerald-400" :
                  item.sentiment === "Negative" ? "bg-rose-500/20 text-rose-400" :
                  "bg-gray-500/20 text-gray-400"
                )}>
                  {item.sentiment}
                </span>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1 leading-tight">{item.title}</h3>
            <p className="text-xs text-gray-400 line-clamp-2">{item.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
