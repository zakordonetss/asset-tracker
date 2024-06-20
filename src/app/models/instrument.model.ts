export interface IInstrumentResponse {
  paging: {
    page: number;
    pages: number;
    items: number;
  };
  data: IInstrument[];
}

export interface IInstrument {
  id: string;
  symbol: string;
  kind: string;
  description: string;
  tickSize: number;
  currency: string;
  baseCurrency: string;
  mappings: {
    [provider: string]: {
      symbol: string;
      exchange: string;
      defaultOrderSize: number;
    };
  };
}
