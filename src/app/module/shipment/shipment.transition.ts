import type { Prisma, ShipmentStatus } from "../../../generated/prisma";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { HOLDER_AFTER_STATUS, isTransitionAllowed } from "./shipment.constant";

type TxClient = Prisma.TransactionClient;

export interface TransitionParams {
  shipmentId: string;
  toStatus: ShipmentStatus;
  actorId?: string;
  note?: string;
  location?: string;

  currentHubId?: string | null;
  extraData?: Record<string, unknown>;
}

export async function transitionStatusInTx(
  tx: TxClient,
  params: TransitionParams,
) {
  const shipment = await tx.shipment.findUnique({
    where: { id: params.shipmentId },
  });
  if (!shipment) throw ApiError.notFound("Shipment not found.");

  if (!isTransitionAllowed(shipment.status, params.toStatus)) {
    throw ApiError.conflict(
      `Cannot move shipment from ${shipment.status} to ${params.toStatus}.`,
    );
  }

  const holderType = HOLDER_AFTER_STATUS[params.toStatus];

  const updateResult = await tx.shipment.updateMany({
    where: { id: params.shipmentId, version: shipment.version },
    data: {
      status: params.toStatus,
      version: { increment: 1 },
      ...(holderType ? { holderType } : {}),
      ...(params.currentHubId !== undefined
        ? { currentHubId: params.currentHubId }
        : {}),
      ...params.extraData,
    },
  });

  if (updateResult.count === 0) {
    // Someone else updated this shipment between our read and our write.
    throw ApiError.conflict(
      "This shipment was updated by another action just now. Please retry.",
    );
  }

  await tx.shipmentEvent.create({
    data: {
      shipmentId: params.shipmentId,
      status: params.toStatus,
      note: params.note,
      location: params.location,
      actorId: params.actorId,
    },
  });

  return tx.shipment.findUniqueOrThrow({ where: { id: params.shipmentId } });
}

export async function transitionStatus(params: TransitionParams) {
  return prisma.$transaction((tx) => transitionStatusInTx(tx, params));
}
