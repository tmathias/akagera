import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.route.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async get(tenantId: string, id: string) {
    const r = await this.prisma.route.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    if (r.tenantId !== tenantId) throw new ForbiddenException();
    return r;
  }

  create(tenantId: string, createdById: string, data: any) {
    const waypoints = data.waypoints ?? [];
    const distanceNm = this.calcDistanceNm(waypoints);
    return this.prisma.route.create({
      data: { ...data, tenantId, createdById, distanceNm, waypoints, geoJson: this.toGeoJson(waypoints) },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    await this.get(tenantId, id);
    return this.prisma.route.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.prisma.route.delete({ where: { id } });
  }

  private calcDistanceNm(waypoints: Array<{ lat: number; lon: number }>): number {
    let total = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      total += this.haversineNm(waypoints[i], waypoints[i + 1]);
    }
    return Math.round(total * 10) / 10;
  }

  private haversineNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const R = 3440.065; // Earth radius in nm
    const dLat = this.toRad(b.lat - a.lat);
    const dLon = this.toRad(b.lon - a.lon);
    const x = Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(a.lat)) * Math.cos(this.toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  private toRad(deg: number) { return (deg * Math.PI) / 180; }

  private toGeoJson(waypoints: Array<{ lat: number; lon: number }>) {
    return {
      type: 'LineString',
      coordinates: waypoints.map((w) => [w.lon, w.lat]),
    };
  }
}
