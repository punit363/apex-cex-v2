import {
  ColorType,
  createChart as createLightWeightChart,
  CrosshairMode,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";

export class ChartManager {
  private candleSeries: ISeriesApi<"Candlestick">;
  private lastUpdateTime: number = 0;
  private chart: any;
  private intervalMs: number;
  
  private currentBar: {
    open: number;
    high: number;
    low: number;
    close: number;
    time?: number;
  } | null = null;

  constructor(
    ref: any,
    initialData: any[],
    layout: { background: string; color: string },
    interval: string
  ) {

    this.intervalMs = this.getIntervalMs(interval);

    const chart = createLightWeightChart(ref, {
      autoSize: true,
      overlayPriceScales: {
        ticksVisible: true,
        borderVisible: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        visible: true,
        ticksVisible: true,
        entireTextOnly: true,
      },
      grid: {
        horzLines: { visible: false },
        vertLines: { visible: false },
      },
      layout: {
        background: {
          type: ColorType.Solid,
          color: layout.background,
        },
        textColor: layout.color,
      },
    });
    
    this.chart = chart;
    this.candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });

    const formattedData = initialData.map((data) => ({
      ...data,
      time: (data.timestamp.getTime() / 1000) as UTCTimestamp,
    }));

    this.candleSeries.setData(formattedData);

    if (formattedData.length > 0) {
      const last = formattedData[formattedData.length - 1];
      this.currentBar = { ...last, time: last.time };
      this.lastUpdateTime = last.time * 1000;
    }
  }
  
  public scrollLeft(bars: number = 20) {
    const currentPosition = this.chart.timeScale().scrollPosition();
    this.chart.timeScale().scrollToPosition(currentPosition - bars, true);
  }
  
  public scrollRight(bars: number = 20) {
    const currentPosition = this.chart.timeScale().scrollPosition();
    this.chart.timeScale().scrollToPosition(currentPosition + bars, true);
  }

  private getIntervalMs(interval: string): number {
    switch (interval) {
        case "1m": return 60 * 1000;
        case "5m": return 5 * 60 * 1000;
        case "15m": return 15 * 60 * 1000;
        case "1h": return 60 * 60 * 1000;
        case "1d": return 24 * 60 * 60 * 1000;
        default: return 60 * 60 * 1000; // Default to 1h
    }
  }

  public updateLivePrice(price: number, tradeTimeMs: number) {
    if (!this.currentBar) return;

    const currentCandleInterval = this.currentBar.time! * 1000;
    const nextCandleInterval = currentCandleInterval + this.intervalMs; 

    if (tradeTimeMs >= nextCandleInterval) {
      this.currentBar = {
        time: (nextCandleInterval / 1000) as UTCTimestamp,
        open: price,
        high: price,
        low: price,
        close: price,
      };
    } else {
      this.currentBar.close = price;
      this.currentBar.high = Math.max(this.currentBar.high, price);
      this.currentBar.low = Math.min(this.currentBar.low, price);
    }

    this.candleSeries.update({
      time: this.currentBar.time as UTCTimestamp,
      open: this.currentBar.open,
      high: this.currentBar.high,
      low: this.currentBar.low,
      close: this.currentBar.close,
    });
  }


  private isDestroyed = false;


  public destroy() {
    if (this.isDestroyed) return;
    
    try {
        this.chart.remove();
        this.isDestroyed = true;
    } catch (e) {
        console.warn("Chart already destroyed");
    }
  }
}