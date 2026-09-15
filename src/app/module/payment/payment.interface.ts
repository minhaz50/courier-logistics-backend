export interface IPaymentInitiateResult {
  providerRef: string;
  redirectUrl?: string;
}

export interface IPaymentProvider {
  name: string;
  initiate(params: {
    amount: number;
    currency: string;
    reference: string;
  }): Promise<IPaymentInitiateResult>;
  verify(providerRef: string): Promise<boolean>;
  refund(providerRef: string, amount: number): Promise<boolean>;
}
