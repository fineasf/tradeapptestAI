import TradingView from '@mathieuc/tradingview';

async function test() {
  try {
    const results = await TradingView.searchMarket('AAPL');
    console.log(results);
  } catch (e) {
    console.error(e);
  }
}
test();
