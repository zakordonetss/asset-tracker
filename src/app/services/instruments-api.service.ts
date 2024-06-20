import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { IInstrumentResponse } from '@models';

@Injectable({
  providedIn: 'root',
})
export class InstrumentsApiService {
  private readonly _baseUrl =
    'https://platform.fintacharts.com/api/instruments/v1/instruments';

  constructor(
    private readonly _httpClient: HttpClient,
    private readonly _authService: AuthService
  ) {}

  getInstruments(): Observable<IInstrumentResponse> {
    return this._authService.getToken().pipe(
      switchMap((token: string | null) => {
        if (!token) {
          throw new Error('No token available');
        }

        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
        });

        return this._httpClient
          .get<IInstrumentResponse>(this._baseUrl, { headers })
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
