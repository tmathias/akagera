import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AircraftService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.aircraft.findMany({
      where: { tenantId },
      orderBy: { registration: 'asc' },
    });
  }

  async get(tenantId: string, id: string) {
    const ac = await this.prisma.aircraft.findUnique({ where: { id } });
    if (!ac) throw new NotFoundException();
    if (ac.tenantId !== tenantId) throw new ForbiddenException();
    return ac;
  }

  create(tenantId: string, data: any) {
    return this.prisma.aircraft.create({ data: { ...data, tenantId } });
  }

  async update(tenantId: string, id: string, data: any) {
    await this.get(tenantId, id);
    return this.prisma.aircraft.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.prisma.aircraft.delete({ where: { id } });
  }

  async getFleetStats(tenantId: string) {
    const aircraft = await this.list(tenantId);
    return {
      total: aircraft.length,
      active: aircraft.filter((a) => a.status === 'ACTIVE').length,
      maintenance: aircraft.filter((a) => a.status === 'MAINTENANCE').length,
      totalEngineHours: aircraft.reduce((s, a) => s + a.engineTimeHours, 0),
      totalAirframeHours: aircraft.reduce((s, a) => s + a.airframeHours, 0),
    };
  }
}
