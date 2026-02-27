import TradingView from '@mathieuc/tradingview';

async function test() {
  const client = new TradingView.Client();
  const quoteSession = new client.Session.Quote({ fields: 'all' });
  
  const symbols = ['SP:SPX', 'NASDAQ:IXIC', 'DJ:DJI', 'CBOE:VIX'];
  symbols.forEach(s => {
    const market = new quoteSession.Market(s);
    market.onData((data) => {
      console.log(s, data.lp);
    });
  });
  
  setTimeout(() => client.end(), 5000);
}
test();
