import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
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
  @ViewChild('priceChart', { static: true })
  private readonly _priceChart: ElementRef;

  public readonly symbolControl = new FormControl<string>('');
  public filteredSymbols$: Observable<string[]>;
  public marketOrder = signal<IMarketOrder | undefined>(undefined);

  private _websocketSubscription: Subscription;
  private _priceHistorySubscription: Subscription;
  private _chart: Highcharts.Chart;
  private _instrumentId: string;
  private readonly _defaultKindInstrument = 'forex';
  private readonly _defaultSymbol = 'USD/PLN';

  private cachedSymbols: string[] = [];

  constructor(
    private readonly _webSocketService: WebSocketService,
    private readonly _priceApiService: PriceApiService,
    private readonly _instrumentsService: InstrumentsApiService
  ) {}

  public ngOnInit(): void {
    this._setupSymbolAutocomplete();
    this._loadInitialPriceHistory();
    this._subscribeToSymbolChanges();
  }

  public ngOnDestroy(): void {
    this._unsubscribeAll();
  }

  public subscribeToWebSocket(): void {
    const symbol = this.symbolControl.value;
    if (symbol) {
      this._fetchInstrumentIdAndSubscribeToWebSocket(symbol);
    }
  }

  private _unsubscribeAll(): void {
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

  private _setupSymbolAutocomplete(): void {
    this.filteredSymbols$ = this.symbolControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => this._filterSymbols(value ?? ''))
    );
  }

  private _filterSymbols(value: string): Observable<string[]> {
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

  private _subscribeToSymbolChanges(): void {
    this.symbolControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((symbol) =>
          this._fetchInstrumentIdAndLoadPriceHistory(symbol ?? '')
        )
      )
      .subscribe();
  }

  private _fetchInstrumentIdAndLoadPriceHistory(
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
            return this._loadPriceHistory();
          } else {
            console.error(`Instrument ID not found for symbol: ${symbol}`);
            return [];
          }
        })
      );
  }

  private _loadInitialPriceHistory(): void {
    this._fetchInstrumentIdAndLoadPriceHistory(this._defaultSymbol).subscribe();
  }

  private _loadPriceHistory(): Observable<void> {
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
        this._renderChart(response.data);
      }),
      catchError((error) => {
        console.error('Error fetching price history', error);
        return [];
      })
    );
  }

  private _fetchInstrumentIdAndSubscribeToWebSocket(symbol: string): void {
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
                  this.marketOrder.set(message.last);
                }
              }
            );
          this._webSocketService.sendMessage(subscriptionMessage);
        } else {
          console.error(`Instrument ID not found for symbol: ${symbol}`);
        }
      });
  }

  private _renderChart(priceData: IPriceData[]): void {
    const symbol = this.symbolControl.value
      ? this.symbolControl.value
      : this._defaultSymbol;
    const chartOptions: Highcharts.Options = {
      title: {
        text: `Price History for ${symbol}`,
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
