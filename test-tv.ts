import TradingView from '@mathieuc/tradingview';

const client = new TradingView.Client(); // Creates a websocket client
const chart = new client.Session.Chart(); // Init a Chart session

chart.setMarket('NASDAQ:NVDA', { // Set the market
  timeframe: 'D',
  range: 100 // Fetch 100 days
});

chart.onUpdate(() => { // When price changes
  if (!chart.periods[0]) return;
  console.log(chart.periods.slice(0, 2));
  client.end();
});
