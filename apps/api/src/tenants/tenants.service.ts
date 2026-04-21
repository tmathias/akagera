import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(id: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      include: { _count: { select: { users: true, aircraft: true, documents: true } } },
    });
    if (!t) throw new NotFoundException('Tenant not found');
    return t;
  }

  update(id: string, data: Partial<{ name: string; logoUrl: string; primaryColor: string; timezone: string }>) {
    return this.prisma.tenant.update({ where: { id }, data });
  }

  listUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true, name: true, email: true, role: true,
        licenseNumber: true, medicalExpiry: true, licenseExpiry: true,
        instructorExpiry: true, recurrencyExpiry: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // Return pilots whose credentials are expiring within 60 days
  async getExpiringCredentials(tenantId: string, daysAhead = 60) {
    const cutoff = new Date(Date.now() + daysAhead * 86400_000);
    return this.prisma.user.findMany({
      where: {
        tenantId,
        OR: [
          { medicalExpiry: { lte: cutoff } },
          { licenseExpiry: { lte: cutoff } },
          { instructorExpiry: { lte: cutoff } },
          { recurrencyExpiry: { lte: cutoff } },
        ],
      },
      select: {
        id: true, name: true, email: true,
        medicalExpiry: true, licenseExpiry: true, instructorExpiry: true, recurrencyExpiry: true,
      },
    });
  }
}
