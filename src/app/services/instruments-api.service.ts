import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { EProvider, IInstrument, IInstrumentResponse } from '@models';

@Injectable({
  providedIn: 'root',
})
export class InstrumentsApiService {
  private readonly _baseUrl = '/api/api/instruments/v1/instruments';

  constructor(
    private readonly _httpClient: HttpClient,
    private readonly _authService: AuthService
  ) {}

  getSymbols(provider?: EProvider, kind?: string): Observable<string[]> {
    return this._getInstruments(provider, kind).pipe(
      switchMap((response) => {
        const symbols = response.data.map(
          (instrument: IInstrument) => instrument.symbol
        );
        return of(symbols);
      })
    );
  }

  getInstrumentIdBySymbol(
    symbol: string,
    provider?: EProvider,
    kind?: string
  ): Observable<string | null> {
    return this._getInstruments(provider, kind).pipe(
      switchMap((response) => {
        const instrument = response.data.find((item) => item.symbol === symbol);
        return instrument ? of(instrument.id) : of(null);
      })
    );
  }

  private _getInstruments(
    provider?: EProvider,
    kind?: string
  ): Observable<IInstrumentResponse> {
    return this._authService.getToken().pipe(
      switchMap((token: string | null) => {
        if (!token) {
          throw new Error('No token available');
        }

        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
        });

        let params = new HttpParams();
        if (provider) {
          params = params.append('provider', provider);
        }
        if (kind) {
          params = params.append('kind', kind);
        }

        return this._httpClient
          .get<IInstrumentResponse>(this._baseUrl, { headers, params })
          .pipe(
            catchError((error) => {
              console.error('Error fetching instruments:', error);
              throw error;
            })
          );
      })
    );
  }
}
