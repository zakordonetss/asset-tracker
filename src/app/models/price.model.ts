export interface IPriceData {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface IPriceResponse {
  data: IPriceData[];
}

export interface IPriceQueryParams {
  provider: string;
  interval: number;
  periodicity: string;
  startDate: string;
  endDate: string;
  instrumentId: string;
}

export enum EPriceQueryParams {
  provider = 'provider',
  interval = 'interval',
  periodicity = 'periodicity',
  startDate = 'startDate',
  endDate = 'endDate',
  instrumentId = 'instrumentId',
}
