import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import * as Highcharts from 'highcharts/highstock';
import HighchartsMore from 'highcharts/highcharts-more';
import HighchartsExporting from 'highcharts/modules/exporting';
import HighchartsAccessibility from 'highcharts/modules/accessibility';
import { WebSocketService } from 'src/app/services/websocket.service';
import {
  Observable,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
} from 'rxjs';
import { PriceApiService } from 'src/app/services/price-api.service';
import { CommonModule } from '@angular/common';
import {
  EProvider,
  IPriceData,
  IPriceQueryParams,
  IWebSocketMessage,
} from '@models';
import { InstrumentsApiService } from 'src/app/services/instruments-api.service';

HighchartsMore(Highcharts);
HighchartsExporting(Highcharts);
HighchartsAccessibility(Highcharts);

@Component({
  selector: 'app-assets',
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.sass'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  standalone: true,
})
export class AssetsComponent implements OnInit, OnDestroy {
  @ViewChild('priceChart', { static: true }) priceChart: ElementRef;

  public l1Data$: Observable<IWebSocketMessage> =
    this._webSocketService.messages$;
  public symbolControl = new FormControl();
  public filteredSymbols$: Observable<string[]>;
  private _websocketSubscription: Subscription;
  private _priceHistorySubscription: Subscription;
  private _chart: Highcharts.Chart;
  private instrumentId: string = 'ad9e5345-4c3b-41fc-9437-1d253f62db52';

  constructor(
    private readonly _webSocketService: WebSocketService,
    private readonly _priceApiService: PriceApiService,
    private readonly _instrumentsService: InstrumentsApiService
  ) {}

  ngOnInit(): void {
    this.setupSymbolAutocomplete();
    this.sendInitialWebSocketMessage();
    this.subscribeToL1Data();
  }

  private setupSymbolAutocomplete(): void {
    this.filteredSymbols$ = this.symbolControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => this.filterSymbols(value))
    );
  }

  private filterSymbols(value: string): Observable<string[]> {
    return this._instrumentsService
      .getSymbols(EProvider.Oanda, 'forex')
      .pipe(
        map((symbols) =>
          symbols.filter((symbol) =>
            symbol.toLowerCase().includes(value.toLowerCase())
          )
        )
      );
  }

  private sendInitialWebSocketMessage(): void {
    const subscriptionMessage = {
      type: 'l1-subscription',
      id: '1',
      instrumentId: this.instrumentId,
      provider: 'simulation',
      subscribe: true,
      kinds: ['ask', 'bid', 'last'],
    };
    this._webSocketService.connect();
    this._websocketSubscription = this._webSocketService.messages$.subscribe();
    this._webSocketService.sendMessage(subscriptionMessage);
    this.loadPriceHistory(); // Load initial price history
  }

  private subscribeToL1Data(): void {
    this.symbolControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((symbol) => {
        if (symbol) {
          this._instrumentsService
            .getInstrumentIdBySymbol(symbol, EProvider.Oanda, 'forex')
            .subscribe((instrumentId) => {
              if (instrumentId) {
                this.instrumentId = instrumentId;
                const subscriptionMessage = {
                  type: 'l1-subscription',
                  id: '1',
                  instrumentId: this.instrumentId,
                  provider: 'simulation',
                  subscribe: true,
                  kinds: ['ask', 'bid', 'last'],
                };
                this._webSocketService.sendMessage(subscriptionMessage);
                this.loadPriceHistory(); // Update price history on symbol change
              } else {
                console.error(`Instrument ID not found for symbol: ${symbol}`);
              }
            });
        }
      });
  }

  private loadPriceHistory(): void {
    if (!this.instrumentId) return; // Ensure we have an instrumentId before proceeding
    const queryParams: IPriceQueryParams = {
      provider: 'oanda',
      interval: 1,
      periodicity: 'day',
      startDate: '2023-06-08',
      endDate: '2024-06-08',
      instrumentId: this.instrumentId,
    };
    if (this._priceHistorySubscription) {
      this._priceHistorySubscription.unsubscribe();
    }
    this._priceHistorySubscription = this._priceApiService
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
