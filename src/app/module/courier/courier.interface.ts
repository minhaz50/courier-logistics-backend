import type { AssignmentLegType } from "../../../generated/prisma/client";

export interface IAssignCourierPayload {
  legType: AssignmentLegType;

  preferredCourierId?: string;
}

export interface IFailLegPayload {
  reason: string;
}
