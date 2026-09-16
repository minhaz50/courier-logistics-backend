export const COURIER_COMMISSION_PERCENT = 0.3;
export const PICKUP_LEG_SHARE = 0.4;
export const DELIVERY_LEG_SHARE = 0.6;

export function calculateLegEarning(
  shipmentPrice: number,
  legShare: number,
): number {
  return Number(
    (shipmentPrice * COURIER_COMMISSION_PERCENT * legShare).toFixed(2),
  );
}
