import { prisma } from "../../lib/prisma";
import type { NotificationChannel } from "../../../generated/prisma";

const notify = async (params: {
  userId: string;
  title: string;
  body: string;
  channel?: NotificationChannel;
  meta?: Record<string, unknown>;
}) => {
  const record = await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      body: params.body,
      channel: params.channel ?? "IN_APP",
      meta: params.meta as any,
      status: "PENDING",
    },
  });

  try {
    await dispatch(record.channel, params);
    await prisma.notification.update({
      where: { id: record.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  } catch (err) {
    console.error(`[notification] failed to send ${record.id}:`, err);
    await prisma.notification.update({
      where: { id: record.id },
      data: { status: "FAILED" },
    });
  }

  return record;
};

async function dispatch(
  channel: NotificationChannel,
  params: { userId: string; title: string; body: string },
) {
  if (channel === "IN_APP") return;
  console.log(
    `[notification:${channel}] -> user ${params.userId}: ${params.title}`,
  );
}

const getUserNotifications = async (userId: string) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
};

export const NotificationService = { notify, getUserNotifications };
