import type { PaymentMethod, ServiceLevel } from "../../../generated/prisma";

export interface IAddressInput {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  zoneId: string;
  postCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
}

export interface ICreateShipmentPayload {
  senderAddress: IAddressInput;
  receiverAddress: IAddressInput;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  declaredValue?: number;
  codAmount?: number;
  serviceLevel?: ServiceLevel;
  description?: string;
  paymentMethod: PaymentMethod;
}

export interface IUpdateShipmentPayload {
  description?: string;
  declaredValue?: number;
  codAmount?: number;
}
