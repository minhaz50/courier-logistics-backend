import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { OrganizationController } from "./organization.controller";
import {
  createOrganizationValidation,
  updateOrganizationValidation,
} from "./organization.validation";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.get("/public", OrganizationController.getAllPublic);

router.post(
  "/",
  auth(Role.SUPER_ADMIN),
  validateRequest(createOrganizationValidation),
  OrganizationController.create,
);
router.get(
  "/",
  auth(Role.SUPER_ADMIN, Role.ADMIN),
  OrganizationController.getAll,
);
router.get(
  "/:id",
  auth(Role.SUPER_ADMIN, Role.ADMIN),
  OrganizationController.getById,
);
router.patch(
  "/:id",
  auth(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(updateOrganizationValidation),
  OrganizationController.update,
);

export const OrganizationRoutes = router;
