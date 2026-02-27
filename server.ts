import express from "express";
import { createServer as createViteServer } from "vite";
import TradingView from "@mathieuc/tradingview";
import { getNews } from "./src/server/newsService";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      const region = typeof req.query.region === "string" ? req.query.region : undefined;
      const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
      const parsedLimit = Number(req.query.limit);
      const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

      const news = await getNews({ symbols, region, lang, limit });
      res.json(news);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ error: "Failed to fetch news" });
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
            close: p.close
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
