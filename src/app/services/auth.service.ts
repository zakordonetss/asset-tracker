import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { authConfig } from '../utils/config';
import { ESessionStorageKeys, IAuthResponse } from '@models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly _tokenUrl = `/api/identity/realms/fintatech/protocol/openid-connect/token`;
  private _tokenSubject: BehaviorSubject<string | null>;

  constructor(private readonly _httpClient: HttpClient) {
    const token = sessionStorage.getItem(ESessionStorageKeys.access_token);
    const expirationTime = sessionStorage.getItem(
      ESessionStorageKeys.expiration_time
    );

    if (
      token &&
      expirationTime &&
      new Date().getTime() < Number(expirationTime)
    ) {
      this._tokenSubject = new BehaviorSubject<string | null>(token);
    } else {
      this._tokenSubject = new BehaviorSubject<string | null>(null);
    }
  }

  public getToken(): Observable<string | null> {
    const expirationTime = sessionStorage.getItem(
      ESessionStorageKeys.expiration_time
    );
    const now = new Date().getTime();

    if (!expirationTime || (expirationTime && now >= Number(expirationTime))) {
      return this._refreshToken();
    }

    return this._tokenSubject.asObservable();
  }

  private _saveToken(token: string, expiresIn: number): void {
    const expirationTime = new Date().getTime() + expiresIn * 1000;
    sessionStorage.setItem(ESessionStorageKeys.access_token, token);
    sessionStorage.setItem(
      ESessionStorageKeys.expiration_time,
      expirationTime.toString()
    );
    this._tokenSubject.next(token);
  }

  private _clearToken(): void {
    sessionStorage.removeItem(ESessionStorageKeys.access_token);
    sessionStorage.removeItem(ESessionStorageKeys.expiration_time);
    this._tokenSubject.next(null);
  }

  private _refreshToken(): Observable<string | null> {
    return this._getAuth().pipe(
      tap((response: IAuthResponse) => {
        this._saveToken(response.access_token, response.expires_in);
      }),
      map((response) => response.access_token),
      catchError((error) => {
        this._clearToken();
        return throwError(() => error);
      })
    );
  }

  private _getAuth(): Observable<IAuthResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    const body = new URLSearchParams();
    body.set('grant_type', authConfig.grantType);
    body.set('client_id', authConfig.clientId);
    body.set('username', authConfig.userName);
    body.set('password', authConfig.password);

    return this._httpClient.post<IAuthResponse>(
      this._tokenUrl,
      body.toString(),
      { headers }
    );
  }
}
