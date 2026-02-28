import express from "express";
import { createServer as createViteServer } from "vite";
import TradingView from "@mathieuc/tradingview";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { getNews } from "./src/server/newsService";
import { computeTechnicalLevels } from "./src/server/technicalLevels";

dotenv.config();

type AnalysisRequest = {
  symbol: string;
  context?: string;
};

type AnalysisResponse = {
  symbol: string;
  signal: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  confidence: number;
  summary: string;
  keyFactors: string[];
};

const VALID_SIGNALS = new Set(["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"]);

function sanitizeContext(input: string | undefined) {
  if (!input) return undefined;
  return input.replace(/[\r\n\t]+/g, " ").trim().slice(0, 600);
}

function validateAnalysisRequest(body: unknown): AnalysisRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request payload");
  }

  const parsed = body as Record<string, unknown>;
  if (typeof parsed.symbol !== "string" || !parsed.symbol.trim()) {
    throw new Error("symbol is required");
  }

  if (parsed.context !== undefined && typeof parsed.context !== "string") {
    throw new Error("context must be a string");
  }

  return {
    symbol: parsed.symbol.trim(),
    context: sanitizeContext(parsed.context as string | undefined),
  };
}

function validateAnalysisOutput(value: unknown): AnalysisResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid analysis output");
  }

  const parsed = value as Record<string, unknown>;
  const symbol = typeof parsed.symbol === "string" ? parsed.symbol.trim().slice(0, 30) : "";
  const signal = typeof parsed.signal === "string" ? parsed.signal : "";
  const confidence = typeof parsed.confidence === "number" ? parsed.confidence : NaN;
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const keyFactors = Array.isArray(parsed.keyFactors)
    ? parsed.keyFactors.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : [];

  if (!symbol || !VALID_SIGNALS.has(signal)) {
    throw new Error("Invalid symbol or signal");
  }

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
    throw new Error("Invalid confidence");
  }

  if (!summary || keyFactors.length === 0) {
    throw new Error("Invalid summary or key factors");
  }

  return {
    symbol,
    signal: signal as AnalysisResponse["signal"],
    confidence: Math.round(confidence),
    summary: summary.slice(0, 1000),
    keyFactors: keyFactors.slice(0, 5),
  };
}

async function generateAnalysisWithGemini(payload: AnalysisRequest): Promise<AnalysisResponse> {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const prompt = [
    `Provide trading commentary for ${payload.symbol}.`,
    "Return only the requested JSON structure.",
    "Include signal, confidence score, summary and 3 key factors.",
    "Do not provide support or resistance prices.",
    payload.context ? `Additional context: ${payload.context}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING },
          signal: { type: Type.STRING, enum: Array.from(VALID_SIGNALS) },
          confidence: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          keyFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["symbol", "signal", "confidence", "summary", "keyFactors"],
      },
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned empty response");
  }

  const parsed = JSON.parse(response.text) as unknown;
  return validateAnalysisOutput(parsed);
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json({ limit: "16kb" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/search/:query", async (req, res) => {
    try {
      const results = await TradingView.searchMarket(req.params.query);
      // Filter for US stocks/funds if possible, or just return top results
      const stocks = results.filter(r => r.type === 'stock' || r.type === 'fund' || r.type === 'dr');
      res.json(stocks.slice(0, 10));
    } catch (e) {
      console.error("Search error:", e);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/quotes", async (req, res) => {
    const symbols = req.query.symbols as string;
    if (!symbols) return res.json({});
    
    const symbolList = symbols.split(',');
    
    try {
      const client = new TradingView.Client();
      const quoteSession = new client.Session.Quote({ fields: 'all' });
      
      const results: Record<string, any> = {};
      let completed = 0;
      
      symbolList.forEach(symbol => {
        const market = new quoteSession.Market(symbol);
        market.onData((data) => {
          if (data.lp !== undefined) {
            results[symbol] = {
              symbol: data.short_name || symbol.split(':').pop() || symbol,
              name: data.description || data.local_description || symbol,
              price: data.lp,
              change: data.ch,
              changePercent: data.chp
            };
            completed++;
            if (completed === symbolList.length) {
              if (!res.headersSent) {
                res.json(results);
                client.end();
              }
            }
          }
        });
      });
      
      setTimeout(() => {
        if (!res.headersSent) {
          res.json(results);
          client.end();
        }
      }, 3000);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to fetch quotes" });
      }
    }
  });

  app.get("/api/news", async (req, res) => {
    try {
      const symbols = typeof req.query.symbols === "string"
        ? req.query.symbols.split(",").map((symbol) => symbol.trim()).filter(Boolean)
        : [];
      const selectedSymbol = typeof req.query.selectedSymbol === "string" ? req.query.selectedSymbol : undefined;
      const includeMacro = typeof req.query.includeMacro === "string"
        ? req.query.includeMacro.toLowerCase() !== "false"
        : undefined;
      const region = typeof req.query.region === "string" ? req.query.region : undefined;
      const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
      const parsedLimit = Number(req.query.limit);
      const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

      const news = await getNews({ symbols, selectedSymbol, includeMacro, region, lang, limit });
      res.json(news);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  app.post("/api/analysis", async (req, res) => {
    try {
      const payload = validateAnalysisRequest(req.body);
      const analysis = await generateAnalysisWithGemini(payload);

      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      if (error instanceof SyntaxError) {
        return res.status(400).json({ error: "Invalid JSON body" });
      }

      const message = error instanceof Error ? error.message : "Analysis unavailable";
      if (message.includes("required") || message.includes("Invalid request")) {
        return res.status(400).json({ error: message });
      }

      return res.status(503).json({ error: "analysis unavailable" });
    }
  });

  app.get("/api/stock/:symbol", async (req, res) => {
    const symbol = req.params.symbol;
    const timeframe = (req.query.timeframe as string) || 'D';
    
    try {
      const client = new TradingView.Client();
      
      client.onError((err) => {
        console.error("TradingView Client Error:", err);
      });

      const chart = new client.Session.Chart();
      
      chart.setMarket(symbol, {
        timeframe: timeframe,
        range: 150
      });
      
      chart.onUpdate(() => {
        if (!chart.periods[0]) return;
        
        if (!res.headersSent) {
          const data = chart.periods.map(p => ({
            time: p.time,
            open: p.open,
            high: p.max,
            low: p.min,
            close: p.close,
            volume: p.volume,
          })).reverse(); // lightweight-charts needs ascending order
          
          res.json({ data });
          client.end();
        }
      });

      chart.onError((err) => {
        console.error("TradingView Error:", err);
        client.end();
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to fetch data" });
        }
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!res.headersSent) {
          client.end();
          res.status(504).json({ error: "Timeout fetching data" });
        }
      }, 5000);
      
    } catch (error) {
      console.error("Error setting up TradingView client:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.get("/api/levels/:symbol", async (req, res) => {
    const symbol = req.params.symbol;
    const timeframe = (req.query.timeframe as string) || "D";
    const lookback = Math.max(50, Number(req.query.lookback) || 200);
    const swingLookback = Math.max(2, Number(req.query.swingLookback) || 3);
    const proximityPercent = Math.max(0.001, Number(req.query.proximityPercent) || 0.006);
    const useVolumeConfirmation = req.query.useVolumeConfirmation !== "false";

    try {
      const client = new TradingView.Client();
      const chart = new client.Session.Chart();

      chart.setMarket(symbol, {
        timeframe,
        range: lookback,
      });

      chart.onUpdate(() => {
        if (!chart.periods[0] || res.headersSent) return;

        const candles = chart.periods
          .map((period) => ({
            time: period.time,
            open: period.open,
            high: period.max,
            low: period.min,
            close: period.close,
            volume: period.volume,
          }))
          .reverse();

        const result = computeTechnicalLevels(candles, {
          swingLookback,
          proximityPercent,
          maxLevelsPerSide: 4,
          useVolumeConfirmation,
        });

        res.json(result);
        client.end();
      });

      chart.onError((err) => {
        console.error("TradingView levels error:", err);
        client.end();
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to compute levels" });
        }
      });

      setTimeout(() => {
        if (!res.headersSent) {
          client.end();
          res.status(504).json({ error: "Timeout fetching levels" });
        }
      }, 5000);
    } catch (error) {
      console.error("Error setting up levels endpoint:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });


  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
    return next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
