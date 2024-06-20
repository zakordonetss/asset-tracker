import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import * as Highcharts from 'highcharts/highstock';
import HighchartsMore from 'highcharts/highcharts-more';
import HighchartsExporting from 'highcharts/modules/exporting';
import HighchartsAccessibility from 'highcharts/modules/accessibility';
import { WebSocketService } from 'src/app/services/websocket.service';
import { Observable, Subscription } from 'rxjs';
import { PriceApiService } from 'src/app/services/price-api.service';
import { CommonModule } from '@angular/common';
import { IPriceData, IPriceQueryParams, IWebSocketMessage } from '@models';

HighchartsMore(Highcharts);
HighchartsExporting(Highcharts);
HighchartsAccessibility(Highcharts);

@Component({
  selector: 'app-assets',
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.sass'],
  imports: [CommonModule],
  standalone: true,
})
export class AssetsComponent implements OnInit, OnDestroy {
  @ViewChild('priceChart', { static: true }) priceChart: ElementRef;

  public l1Data$: Observable<IWebSocketMessage> =
    this.webSocketService.messages$;

  private readonly instrumentId = 'ad9e5345-4c3b-41fc-9437-1d253f62db52';
  private _websocketSubscription: Subscription;
  private _priceHistorySubscription: Subscription;
  private _chart: Highcharts.Chart;

  constructor(
    private webSocketService: WebSocketService,
    private priceApiService: PriceApiService
  ) {}

  ngOnInit(): void {
    this.subscribeToL1Data();
    this.loadPriceHistory();
  }

  private subscribeToL1Data(): void {
    const subscriptionMessage = {
      type: 'l1-subscription',
      id: '1',
      instrumentId: this.instrumentId,
      provider: 'simulation',
      subscribe: true,
      kinds: ['ask', 'bid', 'last'],
    };

    this.webSocketService.connect();
    this._websocketSubscription = this.webSocketService.messages$.subscribe();
    this.webSocketService.sendMessage(subscriptionMessage);
  }

  private loadPriceHistory(): void {
    const queryParams: IPriceQueryParams = {
      provider: 'oanda',
      interval: 1,
      periodicity: 'day',
      startDate: '2023-06-08',
      endDate: '2024-06-08',
      instrumentId: this.instrumentId,
    };

    this._priceHistorySubscription = this.priceApiService
      .getPriceData(queryParams)
      .subscribe({
        next: (response) => this.renderChart(response.data),
        error: (error) => console.error('Error fetching price history', error),
      });
  }

  private renderChart(priceData: IPriceData[]): void {
    const chartOptions: Highcharts.Options = {
      title: {
        text: 'Price Data',
      },
      xAxis: {
        type: 'datetime',
        title: {
          text: 'Date',
        },
      },
      yAxis: {
        title: {
          text: 'Price',
        },
      },
      series: [
        {
          type: 'candlestick',
          name: 'Price Data',
          data: priceData.map((data) => [
            new Date(data.t).getTime(),
            data.o,
            data.h,
            data.l,
            data.c,
          ]),
        },
      ],
      chart: {
        backgroundColor: 'transparent',
      },
      plotOptions: {
        series: {
          states: {
            hover: {
              enabled: true,
            },
          },
        },
        candlestick: {
          color: 'red',
          lineColor: 'red',
          upColor: 'green',
          upLineColor: 'green',
        },
      },
      rangeSelector: {
        selected: 1,
      },
      navigator: {
        enabled: true,
      },
      scrollbar: {
        enabled: true,
      },
    };

    if (this._chart) {
      this._chart.destroy();
    }

    this._chart = Highcharts.stockChart(
      this.priceChart.nativeElement,
      chartOptions
    );
  }

  ngOnDestroy(): void {
    if (this._websocketSubscription) {
      this._websocketSubscription.unsubscribe();
    }
    if (this._priceHistorySubscription) {
      this._priceHistorySubscription.unsubscribe();
    }
    if (this._chart) {
      this._chart.destroy();
    }
  }
}
