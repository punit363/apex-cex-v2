import { prisma } from "../client.js";

export const TickerRepo = {
  get24hTicker: async (market: string) => {
    const [baseAsset, quoteAsset] = market.split("_");

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.$queryRaw<any[]>`
        SELECT 
            MAX(high) as high,
            MIN(low) as low,
            SUM(volume) as volume,
            (array_agg(open ORDER BY created_at ASC))[1] as first_price,
            (array_agg(close ORDER BY created_at DESC))[1] as last_price
        FROM candles
        WHERE base_asset = ${baseAsset}
          AND quote_asset = ${quoteAsset}
          AND interval = '1m'
          AND created_at >= ${twentyFourHoursAgo}
    `;

    if (!result || result.length === 0 || result[0].last_price === null) {
      const fallback = await prisma.candle.findFirst({
        where: { base_asset: baseAsset, quote_asset: quoteAsset },
        orderBy: { created_at: "desc" },
      });

      if (!fallback) return null;

      return {
        symbol: market,
        firstPrice: fallback.close.toString(),
        lastPrice: fallback.close.toString(),
        high: fallback.close.toString(),
        low: fallback.close.toString(),
        volume: "0",
        priceChange: "0",
        priceChangePercent: "0",
      };
    }

    const row = result[0];
    const firstPrice = Number(row.first_price);
    const lastPrice = Number(row.last_price);

    const priceChange = lastPrice - firstPrice;
    const priceChangePercent =
      firstPrice === 0 ? 0 : (priceChange / firstPrice) * 100;

    return {
      symbol: market,
      firstPrice: firstPrice.toString(),
      lastPrice: lastPrice.toString(),
      high: row.high.toString(),
      low: row.low.toString(),
      volume: row.volume.toString(),
      priceChange: priceChange.toFixed(4),
      priceChangePercent: priceChangePercent.toFixed(2),
    };
  },
};
