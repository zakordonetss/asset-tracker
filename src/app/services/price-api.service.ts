import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { EPriceQueryParams, IPriceResponse, IPriceQueryParams } from '@models';

@Injectable({
  providedIn: 'root',
})
export class PriceApiService {
  private readonly _baseUrl =
    'https://platform.fintacharts.com/api/bars/v1/bars/date-range';

  constructor(
    private readonly _httpClient: HttpClient,
    private readonly _authService: AuthService
  ) {}

  getPriceData(queryParams: IPriceQueryParams): Observable<IPriceResponse> {
    return this._authService.getToken().pipe(
      switchMap((token) => {
        if (!token) {
          return throwError(() => new Error('No token available'));
        }

        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
        });

        const params = new HttpParams()
          .set(EPriceQueryParams.provider, queryParams.provider)
          .set(EPriceQueryParams.interval, queryParams.interval.toString())
          .set(EPriceQueryParams.periodicity, queryParams.periodicity)
          .set(EPriceQueryParams.startDate, queryParams.startDate)
          .set(EPriceQueryParams.endDate, queryParams.endDate)
          .set(EPriceQueryParams.instrumentId, queryParams.instrumentId);

        return this._httpClient
          .get<IPriceResponse>(this._baseUrl, { headers, params })
          .pipe(
            catchError((error) => {
              console.error('Error fetching price data', error);
              return throwError(() => error);
            })
          );
      })
    );
  }
}
