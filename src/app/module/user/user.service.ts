import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { config } from "../../config";
import { pick } from "../../utils/pick";
import type {
  IChangePasswordPayload,
  IUpdateProfilePayload,
} from "./user.interface";

function sanitize<T extends { password?: string }>(user: T) {
  const { password, ...rest } = user;
  return rest;
}

const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { courierProfile: true, organization: true },
  });
  if (!user) throw ApiError.notFound("User not found.");
  return sanitize(user);
};

const updateProfile = async (
  userId: string,
  payload: IUpdateProfilePayload,
) => {
  const data = pick(payload as Record<string, unknown>, ["name", "phone"]);
  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(
      "Provide at least one field (name or phone) to update.",
    );
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  return sanitize(updated);
};

const changePassword = async (
  userId: string,
  payload: IChangePasswordPayload,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found.");

  const isCurrentValid = await bcrypt.compare(
    payload.currentPassword,
    user.password,
  );
  if (!isCurrentValid) {
    throw ApiError.unauthorized("Current password is incorrect.");
  }

  const hashed = await bcrypt.hash(
    payload.newPassword,
    config.bcryptSaltRounds,
  );
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });

  return { message: "Password changed successfully." };
};

export const UserService = { getMe, updateProfile, changePassword };
