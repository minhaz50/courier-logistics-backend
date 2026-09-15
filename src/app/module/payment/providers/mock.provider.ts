import { nanoid } from "nanoid";
import type { IPaymentProvider } from "../payment.interface";

export const MockPaymentProvider: IPaymentProvider = {
  name: "MOCK",

  async initiate({ amount, currency, reference }) {
    return {
      providerRef: `mock_${reference}_${nanoid(8)}`,
      redirectUrl: undefined,
    };
  },

  async verify(_providerRef: string) {
    return true;
  },

  async refund(_providerRef: string, _amount: number) {
    return true;
  },
};
