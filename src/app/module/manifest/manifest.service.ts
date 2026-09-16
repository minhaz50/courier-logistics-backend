import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import {
  ManifestStatus,
  ShipmentStatus,
} from "../../../generated/prisma/client";
import { transitionStatusInTx } from "../shipment/shipment.transition";

const create = async (params: {
  organizationId: string;
  fromHubId: string;
  toHubId: string;
  vehicleInfo?: string;
  createdById: string;
}) => {
  if (params.fromHubId === params.toHubId) {
    throw ApiError.badRequest(
      "A manifest must move between two different hubs.",
    );
  }
  const [fromHub, toHub] = await Promise.all([
    prisma.hub.findFirst({
      where: { id: params.fromHubId, organizationId: params.organizationId },
    }),
    prisma.hub.findFirst({
      where: { id: params.toHubId, organizationId: params.organizationId },
    }),
  ]);
  if (!fromHub || !toHub)
    throw ApiError.badRequest("Both hubs must belong to your organization.");

  return prisma.hubManifest.create({
    data: {
      organizationId: params.organizationId,
      fromHubId: params.fromHubId,
      toHubId: params.toHubId,
      vehicleInfo: params.vehicleInfo,
      createdById: params.createdById,
      status: ManifestStatus.OPEN,
    },
  });
};

const addItems = async (
  manifestId: string,
  shipmentIds: string[],
  actorId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const manifest = await tx.hubManifest.findUnique({
      where: { id: manifestId },
    });
    if (!manifest) throw ApiError.notFound("Manifest not found.");
    if (manifest.status !== ManifestStatus.OPEN) {
      throw ApiError.conflict(
        `Cannot add shipments to a manifest that is already ${manifest.status}.`,
      );
    }

    const results = [];
    for (const shipmentId of shipmentIds) {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
      });
      if (!shipment)
        throw ApiError.notFound(`Shipment ${shipmentId} not found.`);

      const isForwardLeg =
        shipment.status === ShipmentStatus.AT_ORIGIN_HUB &&
        shipment.currentHubId === manifest.fromHubId &&
        shipment.destinationHubId === manifest.toHubId;

      const isReturnLeg =
        shipment.status === ShipmentStatus.RETURN_INITIATED &&
        shipment.currentHubId === manifest.fromHubId &&
        shipment.originHubId === manifest.toHubId;

      if (!isForwardLeg && !isReturnLeg) {
        throw ApiError.badRequest(
          `Shipment ${shipment.trackingId} is not ready to move from this hub to the manifest's destination hub (currently ${shipment.status} at a different location or headed elsewhere).`,
        );
      }

      const item = await tx.manifestItem.create({
        data: { manifestId, shipmentId },
      });
      results.push(item);
    }

    void actorId;
    return results;
  });
};

const dispatch = async (manifestId: string, actorId: string) => {
  return prisma.$transaction(async (tx) => {
    const manifest = await tx.hubManifest.findUnique({
      where: { id: manifestId },
      include: { items: { include: { shipment: true } } },
    });
    if (!manifest) throw ApiError.notFound("Manifest not found.");
    if (manifest.status !== ManifestStatus.OPEN) {
      throw ApiError.conflict(
        `Manifest must be OPEN to dispatch (currently ${manifest.status}).`,
      );
    }
    if (manifest.items.length === 0) {
      throw ApiError.badRequest("Cannot dispatch an empty manifest.");
    }

    for (const item of manifest.items) {
      const toStatus =
        item.shipment.status === ShipmentStatus.AT_ORIGIN_HUB
          ? ShipmentStatus.IN_TRANSIT
          : ShipmentStatus.RETURN_IN_TRANSIT;

      await transitionStatusInTx(tx, {
        shipmentId: item.shipmentId,
        toStatus,
        actorId,
        note: `Dispatched on manifest ${manifest.id} (${manifest.fromHubId} -> ${manifest.toHubId})`,
        currentHubId: null,
      });
    }

    return tx.hubManifest.update({
      where: { id: manifestId },
      data: { status: ManifestStatus.DISPATCHED, dispatchedAt: new Date() },
    });
  });
};

const arrive = async (manifestId: string, actorId: string) => {
  return prisma.$transaction(async (tx) => {
    const manifest = await tx.hubManifest.findUnique({
      where: { id: manifestId },
      include: { items: { include: { shipment: true } } },
    });
    if (!manifest) throw ApiError.notFound("Manifest not found.");
    if (manifest.status !== ManifestStatus.DISPATCHED) {
      throw ApiError.conflict(
        `Manifest must be DISPATCHED to mark arrival (currently ${manifest.status}).`,
      );
    }

    for (const item of manifest.items) {
      const isReturnLeg =
        item.shipment.status === ShipmentStatus.RETURN_IN_TRANSIT;
      const toStatus = isReturnLeg
        ? ShipmentStatus.RETURNED_TO_SENDER
        : ShipmentStatus.AT_DESTINATION_HUB;

      await transitionStatusInTx(tx, {
        shipmentId: item.shipmentId,
        toStatus,
        actorId,
        note: `Arrived at hub via manifest ${manifest.id}`,
        currentHubId: manifest.toHubId,
      });

      if (isReturnLeg) {
        await tx.returnRequest.update({
          where: { shipmentId: item.shipmentId },
          data: { status: "COMPLETED", resolvedAt: new Date() },
        });
      }

      await tx.manifestItem.update({
        where: { id: item.id },
        data: { unloadedAt: new Date() },
      });
    }

    return tx.hubManifest.update({
      where: { id: manifestId },
      data: { status: ManifestStatus.ARRIVED, arrivedAt: new Date() },
    });
  });
};

const close = async (manifestId: string) => {
  const manifest = await prisma.hubManifest.findUnique({
    where: { id: manifestId },
  });
  if (!manifest) throw ApiError.notFound("Manifest not found.");
  if (manifest.status !== ManifestStatus.ARRIVED) {
    throw ApiError.conflict(
      `Manifest must be ARRIVED to close (currently ${manifest.status}).`,
    );
  }
  return prisma.hubManifest.update({
    where: { id: manifestId },
    data: { status: ManifestStatus.CLOSED, closedAt: new Date() },
  });
};

const getById = async (id: string) => {
  const manifest = await prisma.hubManifest.findUnique({
    where: { id },
    include: {
      fromHub: true,
      toHub: true,
      items: {
        include: {
          shipment: { select: { id: true, trackingId: true, status: true } },
        },
      },
    },
  });
  if (!manifest) throw ApiError.notFound("Manifest not found.");
  return manifest;
};

const listForOrganization = async (organizationId: string) => {
  return prisma.hubManifest.findMany({
    where: { organizationId },
    include: { fromHub: true, toHub: true, items: true },
    orderBy: { createdAt: "desc" },
  });
};

export const ManifestService = {
  create,
  addItems,
  dispatch,
  arrive,
  close,
  getById,
  listForOrganization,
};
