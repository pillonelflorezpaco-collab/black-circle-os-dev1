import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const userRepository = {
  findMany() {
    return prisma.user.findMany({
      include: { team: true, assignedVideos: { select: { id: true, stage: true } } },
      orderBy: { name: "asc" },
    });
  },
  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, include: { team: true } });
  },
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  },
  update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  },
  delete(id: string) {
    return prisma.user.delete({ where: { id } });
  },
};
