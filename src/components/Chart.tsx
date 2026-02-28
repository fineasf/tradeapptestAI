import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries, CrosshairMode } from 'lightweight-charts';
import { generateChartData } from '../data';
import { Stock } from '../types';
import { Star, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChartProps {
  symbol: string;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  supportLevels?: number[];
  resistanceLevels?: number[];
  watchlist?: Stock[];
  onToggleWatchlist?: (stock: Stock) => void;
}

const TIMEFRAMES = [
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
  { label: '1M', value: 'M' },
  { label: '15m', value: '15' },
  { label: '1h', value: '60' },
];

const getTimeframeLabel = (value: string) => TIMEFRAMES.find((timeframe) => timeframe.value === value)?.label || value;

export function Chart({ symbol, timeframe, onTimeframeChange, supportLevels = [], resistanceLevels = [], watchlist = [], onToggleWatchlist }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [loading, setLoading] = useState(false);
  const timeframeLabel = getTimeframeLabel(timeframe);

  const isWatchlisted = watchlist.some(s => s.symbol === symbol);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
      },
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    seriesRef.current = candlestickSeries;

    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/stock/${symbol}?timeframe=${timeframe}`);
        if (response.ok) {
          const result = await response.json();
          if (result.data && result.data.length > 0) {
            if (!isMounted) return;
            const formattedData = result.data.map((d: any) => ({
              ...d,
              time: d.time
            }));
            candlestickSeries.setData(formattedData);
            chart.timeScale().fitContent();
          } else {
            throw new Error("No data returned");
          }
        } else {
          throw new Error("Failed to fetch data");
        }
      } catch (error) {
        console.error("Error fetching real chart data:", error);
        if (!isMounted) return;
        const startPrice = symbol.includes('NVDA') ? 700 : symbol.includes('TSLA') ? 200 : 150;
        const data = generateChartData(150, startPrice);
        candlestickSeries.setData(data);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    supportLevels.forEach(level => {
      candlestickSeries.createPriceLine({
        price: level,
        color: '#26a69a',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `Support (${timeframeLabel})`,
      });
    });

    resistanceLevels.forEach(level => {
      candlestickSeries.createPriceLine({
        price: level,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `Resistance (${timeframeLabel})`,
      });
    });

    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol, timeframe, supportLevels, resistanceLevels]);

  return (
    <div className="w-full h-full relative bg-[#131722] rounded-lg overflow-hidden border border-[#2A2E39] flex flex-col">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <h2 className="text-2xl font-bold text-white tracking-tight">{symbol.split(':').pop() || symbol}</h2>

        <div className="flex bg-[#2A2E39] rounded-lg p-0.5">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={cn(
                "px-2 py-1 text-xs rounded font-medium transition-colors",
                timeframe === tf.value
                  ? "bg-[#363A45] text-white"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {onToggleWatchlist && (
          <button
            onClick={() => onToggleWatchlist({
              symbol,
              name: symbol,
              price: 0,
              change: 0,
              changePercent: 0
            })}
            className="p-1.5 bg-[#2A2E39] rounded-md hover:bg-[#363A45] text-gray-400 hover:text-white transition-colors ml-2"
          >
            {isWatchlisted ? (
              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        )}

        {loading && <span className="text-xs text-blue-400 animate-pulse ml-2">Loading...</span>}
      </div>
      <div ref={chartContainerRef} className="w-full flex-1 mt-14" />
    </div>
  );
}
