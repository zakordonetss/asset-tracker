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
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { Subscription, Observable } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  startWith,
  catchError,
  map,
} from 'rxjs/operators';
import * as Highcharts from 'highcharts/highstock';
import HighchartsMore from 'highcharts/highcharts-more';
import HighchartsExporting from 'highcharts/modules/exporting';
import HighchartsAccessibility from 'highcharts/modules/accessibility';
import { WebSocketService } from 'src/app/services/websocket.service';
import { PriceApiService } from 'src/app/services/price-api.service';
import { CommonModule } from '@angular/common';
import { InstrumentsApiService } from 'src/app/services/instruments-api.service';
import {
  EProvider,
  IMarketOrder,
  IPriceData,
  IPriceQueryParams,
  IWebSocketMessage,
} from '@models';

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
    MatButtonModule,
  ],
  standalone: true,
})
export class AssetsComponent implements OnInit, OnDestroy {
  @ViewChild('priceChart', { static: true }) private _priceChart: ElementRef;

  symbolControl = new FormControl('USD/PLN');
  filteredSymbols$: Observable<string[]>;
  marketOrder: IMarketOrder;

  private _websocketSubscription: Subscription;
  private _priceHistorySubscription: Subscription;
  private _chart: Highcharts.Chart;
  private _instrumentId: string;
  private readonly _defaultKindInstrument = 'forex';

  constructor(
    private readonly _webSocketService: WebSocketService,
    private readonly _priceApiService: PriceApiService,
    private readonly _instrumentsService: InstrumentsApiService
  ) {}

  ngOnInit(): void {
    this.setupSymbolAutocomplete();
    this.loadInitialPriceHistory();
    this.subscribeToSymbolChanges();
  }

  ngOnDestroy(): void {
    this.unsubscribeAll();
  }

  private unsubscribeAll(): void {
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

  private setupSymbolAutocomplete(): void {
    this.filteredSymbols$ = this.symbolControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => this.filterSymbols(value ?? ''))
    );
  }

  private filterSymbols(value: string): Observable<string[]> {
    return this._instrumentsService
      .getSymbols(EProvider.Oanda, this._defaultKindInstrument)
      .pipe(
        map((symbols) =>
          symbols.filter((symbol) =>
            symbol.toLowerCase().includes(value.toLowerCase())
          )
        )
      );
  }

  private subscribeToSymbolChanges(): void {
    this.symbolControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((symbol) =>
          this.fetchInstrumentIdAndLoadPriceHistory(symbol ?? '')
        )
      )
      .subscribe();
  }

  private fetchInstrumentIdAndLoadPriceHistory(
    symbol: string
  ): Observable<void> {
    return this._instrumentsService
      .getInstrumentIdBySymbol(
        symbol,
        EProvider.Oanda,
        this._defaultKindInstrument
      )
      .pipe(
        switchMap((instrumentId) => {
          if (instrumentId) {
            this._instrumentId = instrumentId;
            return this.loadPriceHistory();
          } else {
            console.error(`Instrument ID not found for symbol: ${symbol}`);
            return [];
          }
        })
      );
  }

  loadInitialPriceHistory(): void {
    this.fetchInstrumentIdAndLoadPriceHistory('USD/PLN').subscribe();
  }

  loadPriceHistory(): Observable<void> {
    if (!this._instrumentId) {
      return new Observable();
    }
    const queryParams: IPriceQueryParams = {
      provider: 'oanda',
      interval: 1,
      periodicity: 'day',
      startDate: '2023-06-08',
      endDate: '2024-06-08',
      instrumentId: this._instrumentId,
    };
    if (this._priceHistorySubscription) {
      this._priceHistorySubscription.unsubscribe();
    }
    return this._priceApiService.getPriceData(queryParams).pipe(
      map((response) => {
        this.renderChart(response.data);
      }),
      catchError((error) => {
        console.error('Error fetching price history', error);
        return [];
      })
    );
  }

  subscribeToWebSocket(): void {
    const symbol = this.symbolControl.value;
    if (symbol) {
      this.fetchInstrumentIdAndSubscribeToWebSocket(symbol);
    }
  }

  private fetchInstrumentIdAndSubscribeToWebSocket(symbol: string): void {
    this._instrumentsService
      .getInstrumentIdBySymbol(
        symbol,
        EProvider.Oanda,
        this._defaultKindInstrument
      )
      .subscribe((instrumentId) => {
        if (instrumentId) {
          this._instrumentId = instrumentId;
          const subscriptionMessage = {
            type: 'l1-subscription',
            id: '1',
            instrumentId: this._instrumentId,
            provider: 'simulation',
            subscribe: true,
            kinds: ['ask', 'bid', 'last'],
          };
          this._webSocketService.connect();
          if (this._websocketSubscription) {
            this._websocketSubscription.unsubscribe();
          }
          this._websocketSubscription =
            this._webSocketService.messages$.subscribe(
              (message: IWebSocketMessage) => {
                if (message.last) {
                  this.marketOrder = message.last;
                }
              }
            );
          this._webSocketService.sendMessage(subscriptionMessage);
        } else {
          console.error(`Instrument ID not found for symbol: ${symbol}`);
        }
      });
  }

  private renderChart(priceData: IPriceData[]): void {
    const chartOptions: Highcharts.Options = {
      title: {
        text: `Price History for ${this.symbolControl.value}`,
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
      this._priceChart.nativeElement,
      chartOptions
    );
  }
}
