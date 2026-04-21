import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FlightsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, opts?: { aircraftId?: string; from?: Date; to?: Date }) {
    return this.prisma.flight.findMany({
      where: {
        tenantId,
        ...(opts?.aircraftId ? { aircraftId: opts.aircraftId } : {}),
        ...(opts?.from || opts?.to ? {
          flightDate: {
            ...(opts.from ? { gte: opts.from } : {}),
            ...(opts.to ? { lte: opts.to } : {}),
          },
        } : {}),
      },
      orderBy: { flightDate: 'desc' },
      include: {
        aircraft: { select: { registration: true, type: true } },
        pic: { select: { name: true } },
        sic: { select: { name: true } },
      },
    });
  }

  async get(tenantId: string, id: string) {
    const f = await this.prisma.flight.findUnique({
      where: { id },
      include: {
        aircraft: true,
        pic: { select: { name: true, licenseNumber: true } },
        wbRecord: true,
      },
    });
    if (!f) throw new NotFoundException();
    if (f.tenantId !== tenantId) throw new ForbiddenException();
    return f;
  }

  create(tenantId: string, loggedById: string, data: any) {
    return this.prisma.flight.create({
      data: { ...data, tenantId, loggedById },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    await this.get(tenantId, id);
    return this.prisma.flight.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.prisma.flight.delete({ where: { id } });
  }

  async getLogbookSummary(tenantId: string, userId?: string) {
    const flights = await this.prisma.flight.findMany({
      where: { tenantId, ...(userId ? { picId: userId } : {}) },
    });
    const totalMinutes = flights.reduce((s, f) => s + (f.airborneMinutes ?? 0), 0);
    return {
      totalFlights: flights.length,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      totalLandings: flights.reduce((s, f) => s + f.landingCount, 0),
    };
  }
}
