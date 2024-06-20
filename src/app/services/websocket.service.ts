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
  private socket$: WebSocketSubject<IWebSocketMessage>;
  private token$: BehaviorSubject<string | null>;
  private tokenSubscription: Subscription;
  public messages$: Subject<IWebSocketMessage> =
    new Subject<IWebSocketMessage>();

  constructor(private authService: AuthService) {
    this.token$ = new BehaviorSubject<string | null>(null);

    this.tokenSubscription = this.authService.getToken().subscribe((token) => {
      this.token$.next(token);
    });
  }

  public connect(): void {
    this.tokenSubscription = this.token$.subscribe((token) => {
      if (token) {
        const url = `${webSocketChanelUrl}?token=${token}`;
        this.socket$ = webSocket(url);

        this.socket$.subscribe({
          next: (message) => this.messages$.next(message),
          error: (err) => this.messages$.error(err),
          complete: () => this.messages$.complete(),
        });
      }
    });
  }

  public sendMessage(message: IWebSocketMessage): void {
    if (this.socket$) {
      this.socket$.next(message);
    } else {
      console.error('WebSocket connection not initialized.');
    }
  }

  public closeConnection(): void {
    if (this.socket$) {
      this.socket$.complete();
    }
    if (this.tokenSubscription) {
      this.tokenSubscription.unsubscribe();
    }
  }
}
