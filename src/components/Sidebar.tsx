import { useState, useEffect } from "react";
import { Search, TrendingUp, TrendingDown, Star, Filter, Activity, BarChart2, Plus, X } from "lucide-react";
import { Stock } from "../types";
import { cn } from "../lib/utils";

interface SidebarProps {
  watchlist: Stock[];
  selectedSymbol: string;
  onSelectStock: (symbol: string) => void;
  onToggleWatchlist: (stock: Stock) => void;
}

export function Sidebar({ watchlist, selectedSymbol, onSelectStock, onToggleWatchlist }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search/${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (e) {
        console.error("Search failed", e);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredWatchlist = watchlist.filter(stock => 
    stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isWatchlisted = (symbol: string) => watchlist.some(s => s.symbol === symbol);

  return (
    <aside className="w-72 bg-[#1E222D] border-r border-[#2A2E39] flex flex-col h-full text-gray-300">
      <div className="p-4 border-b border-[#2A2E39]">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-6 h-6 text-blue-500" />
          <h1 className="text-xl font-bold text-white tracking-tight">TradeMind AI</h1>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search symbol..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#2A2E39] text-sm rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-gray-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {searchQuery.trim() ? (
          <div className="p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Search Results</h2>
            {isSearching ? (
              <div className="text-sm text-gray-500 text-center py-4 animate-pulse">Searching...</div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-lg transition-colors hover:bg-[#2A2E39] group cursor-pointer",
                      selectedSymbol === result.id ? "bg-[#2A2E39] text-white" : ""
                    )}
                    onClick={() => onSelectStock(result.id)}
                  >
                    <div className="flex flex-col items-start overflow-hidden pr-2">
                      <span className="font-semibold text-sm">{result.symbol}</span>
                      <span className="text-xs text-gray-500 truncate w-full">{result.description}</span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist({
                          symbol: result.id,
                          name: result.description,
                          price: 0,
                          change: 0,
                          changePercent: 0
                        });
                      }}
                      className="p-1.5 rounded-md hover:bg-[#363A45] text-gray-400 hover:text-white transition-colors"
                    >
                      {isWatchlisted(result.id) ? (
                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">No results found</div>
            )}
          </div>
        ) : (
          <>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3 h-3" /> Watchlist
                </h2>
                <button className="text-gray-500 hover:text-white transition-colors">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-1">
                {watchlist.length > 0 ? (
                  watchlist.map((stock) => (
                    <div
                      key={stock.symbol}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-lg transition-colors hover:bg-[#2A2E39] group cursor-pointer",
                        selectedSymbol === stock.symbol ? "bg-[#2A2E39] text-white" : ""
                      )}
                      onClick={() => onSelectStock(stock.symbol)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-semibold text-sm">{stock.symbol.split(':').pop()}</span>
                        <span className="text-xs text-gray-500 truncate w-24">{stock.name}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-medium">${stock.price ? stock.price.toFixed(2) : '---'}</span>
                        <span className={cn(
                          "text-xs flex items-center gap-0.5",
                          stock.change >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {stock.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(stock.changePercent || 0).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 text-center py-4 border border-dashed border-[#363A45] rounded-lg">
                    Watchlist is empty.<br/>Search to add stocks.
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#2A2E39]">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                <BarChart2 className="w-3 h-3" /> AI Hot Suggestions
              </h2>
              <div className="space-y-2">
                <button 
                  onClick={() => onSelectStock("NASDAQ:NVDA")}
                  className="w-full text-left bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 rounded-lg p-3"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-emerald-400">NVDA</span>
                    <span className="text-xs font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">STRONG BUY</span>
                  </div>
                  <p className="text-xs text-gray-400">AI detects breakout pattern with high volume.</p>
                </button>
                <button 
                  onClick={() => onSelectStock("NASDAQ:TSLA")}
                  className="w-full text-left bg-rose-500/10 hover:bg-rose-500/20 transition-colors border border-rose-500/20 rounded-lg p-3"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-rose-400">TSLA</span>
                    <span className="text-xs font-semibold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded">SELL</span>
                  </div>
                  <p className="text-xs text-gray-400">Resistance hit at $200, momentum slowing.</p>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
