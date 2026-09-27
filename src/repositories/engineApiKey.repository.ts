import { prisma } from "@/lib/prisma";

export const engineApiKeyRepository = {
  findActiveByHashedKey(hashedKey: string) {
    return prisma.engineApiKey.findFirst({ where: { hashedKey, revokedAt: null } });
  },
  create(data: { label: string; hashedKey: string; scopes: string[]; agencyId?: string | null }) {
    return prisma.engineApiKey.create({ data });
  },
  touchLastUsed(id: string) {
    return prisma.engineApiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
  },
  revoke(id: string) {
    return prisma.engineApiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  },
};
