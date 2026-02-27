import { Brain, Target, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { AIAnalysisResult } from "../types";
import { cn } from "../lib/utils";

interface AIAnalysisProps {
  analysis: AIAnalysisResult | null;
  isLoading?: boolean;
}

export function AIAnalysis({ analysis, isLoading }: AIAnalysisProps) {
  if (isLoading) {
    return (
      <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg h-full flex flex-col items-center justify-center p-6">
        <Activity className="w-8 h-8 text-blue-500 animate-pulse mb-3" />
        <p className="text-sm text-gray-400 animate-pulse">AI is analyzing market signals...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg h-full flex flex-col items-center justify-center p-6">
        <Brain className="w-8 h-8 text-gray-600 mb-3" />
        <p className="text-sm text-gray-500">Select a stock to view AI analysis</p>
      </div>
    );
  }

  const isBullish = analysis.signal.includes("Buy");
  const isBearish = analysis.signal.includes("Sell");

  return (
    <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-[#2A2E39] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">AI Analysis: {analysis.symbol}</h2>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1",
          isBullish ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
          isBearish ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
          "bg-blue-500/20 text-blue-400 border border-blue-500/30"
        )}>
          {isBullish ? <ArrowUpRight className="w-4 h-4" /> : isBearish ? <ArrowDownRight className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
          {analysis.signal}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <div className="flex justify-between items-end mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Confidence Score</h3>
            <span className="text-lg font-bold text-white">{analysis.confidence}%</span>
          </div>
          <div className="h-2 bg-[#2A2E39] rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                analysis.confidence > 80 ? "bg-emerald-500" :
                analysis.confidence > 60 ? "bg-blue-500" :
                "bg-amber-500"
              )}
              style={{ width: `${analysis.confidence}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#2A2E39] rounded-lg p-3 border border-[#363A45]">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Target className="w-3 h-3 text-emerald-400" /> Support Levels
            </h4>
            <div className="space-y-1">
              {analysis.supportLevels.map((level, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">S{i+1}</span>
                  <span className="text-sm font-mono text-emerald-400">${level.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#2A2E39] rounded-lg p-3 border border-[#363A45]">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Target className="w-3 h-3 text-rose-400" /> Resistance Levels
            </h4>
            <div className="space-y-1">
              {analysis.resistanceLevels.map((level, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">R{i+1}</span>
                  <span className="text-sm font-mono text-rose-400">${level.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">AI Summary</h3>
          <p className="text-sm text-gray-300 leading-relaxed bg-[#2A2E39] p-3 rounded-lg border border-[#363A45]">
            {analysis.summary}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Factors</h3>
          <ul className="space-y-2">
            {analysis.keyFactors.map((factor, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-purple-500 mt-1">•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
