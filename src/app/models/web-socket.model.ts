export interface IWebSocketMessage {
  bid?: IMarketOrder;
  ask?: IMarketOrder;
  last?: IMarketOrder;
  instrumentId: string;
  provider: string;
  type: string;
}

export interface IMarketOrder {
  timestamp: string;
  price: number;
  volume: number;
}
