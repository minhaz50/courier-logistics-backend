import type { Prisma } from "../../../generated/prisma/client";

type TxClient = Prisma.TransactionClient;


export interface IAssignmentStrategy {
 
  getCandidates(
    tx: TxClient,
    params: { organizationId: string; zoneId: string; limit?: number },
  ): Promise<{ id: string }[]>;
}

export const LeastLoadedInZoneStrategy: IAssignmentStrategy = {
  async getCandidates(tx, { organizationId, zoneId, limit = 5 }) {
    return tx.courierProfile.findMany({
      where: { organizationId, currentZoneId: zoneId, isAvailable: true },
      orderBy: [{ activeParcelCount: "asc" }, { rating: "desc" }],
      take: limit,
      select: { id: true },
    });
  },
};


export const AnyAvailableCourierStrategy: IAssignmentStrategy = {
  async getCandidates(tx, { organizationId, limit = 5 }) {
    return tx.courierProfile.findMany({
      where: { organizationId, isAvailable: true },
      orderBy: [{ activeParcelCount: "asc" }, { rating: "desc" }],
      take: limit,
      select: { id: true },
    });
  },
};
