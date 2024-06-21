import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { webSocketChanelUrl } from '../utils/config';
import { IWebSocketMessage } from '@models';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private _socket$: WebSocketSubject<IWebSocketMessage>;
  private _token$: BehaviorSubject<string | null>;
  private _tokenSubscription: Subscription;
  public messages$: Subject<IWebSocketMessage> =
    new Subject<IWebSocketMessage>();

  constructor(private readonly _authService: AuthService) {
    this._token$ = new BehaviorSubject<string | null>(null);

    this._tokenSubscription = this._authService
      .getToken()
      .subscribe((token) => {
        this._token$.next(token);
      });
  }

  public connect(): void {
    this._tokenSubscription = this._token$.subscribe((token) => {
      if (token) {
        const url = `${webSocketChanelUrl}?token=${token}`;
        this._socket$ = webSocket(url);

        this._socket$.subscribe({
          next: (message) => this.messages$.next(message),
          error: (err) => this.messages$.error(err),
          complete: () => this.messages$.complete(),
        });
      }
    });
  }

  public sendMessage(message: IWebSocketMessage): void {
    if (this._socket$) {
      this._socket$.next(message);
    } else {
      console.error('WebSocket connection not initialized.');
    }
  }

  public closeConnection(): void {
    if (this._socket$) {
      this._socket$.complete();
    }
    if (this._tokenSubscription) {
      this._tokenSubscription.unsubscribe();
    }
  }
}
