import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Station {
  id: string;
  name: string;
  arm: number;      // moment arm in inches from datum
  defaultWeight: number;
  maxWeight: number;
}

export interface EnvelopePoint {
  weight: number;   // lbs
  cgMin: number;    // inches
  cgMax: number;    // inches
}

export interface LoadItem {
  stationId: string;
  weight: number;
}

export interface WBCalculation {
  totalWeight: number;
  totalMoment: number;
  cgInches: number;
  withinLimits: boolean;
  marginPercent: number;
  items: Array<{ stationId: string; name: string; arm: number; weight: number; moment: number }>;
}

@Injectable()
export class WbService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List templates for a tenant ──────────────────────────────────────────
  listTemplates(tenantId: string, aircraftId?: string) {
    return this.prisma.wBTemplate.findMany({
      where: { tenantId, ...(aircraftId ? { aircraftId } : {}) },
      include: { aircraft: { select: { registration: true, type: true } } },
    });
  }

  // ── Get single template ──────────────────────────────────────────────────
  async getTemplate(tenantId: string, templateId: string) {
    const t = await this.prisma.wBTemplate.findUnique({ where: { id: templateId } });
    if (!t || t.tenantId !== tenantId) throw new NotFoundException('W&B template not found');
    return t;
  }

  // ── Create template (seed from aircraft's known data) ────────────────────
  async createTemplate(
    tenantId: string,
    aircraftId: string,
    data: {
      name: string;
      emptyWeight: number;
      emptyCg: number;
      stations: Station[];
      envelopePoints: EnvelopePoint[];
    },
  ) {
    const emptyMoment = data.emptyWeight * data.emptyCg;
    return this.prisma.wBTemplate.create({
      data: {
        tenantId,
        aircraftId,
        name: data.name,
        emptyWeight: data.emptyWeight,
        emptyCg: data.emptyCg,
        emptyMoment,
        stations: data.stations as any,
        envelopePoints: data.envelopePoints as any,
      },
    });
  }

  // ── Core W&B calculation ─────────────────────────────────────────────────
  async calculate(
    tenantId: string,
    templateId: string,
    loadItems: LoadItem[],
  ): Promise<WBCalculation> {
    const template = await this.getTemplate(tenantId, templateId);
    const stations = template.stations as Station[];
    const envelope = template.envelopePoints as EnvelopePoint[];

    // Include empty aircraft as first item
    let totalWeight = template.emptyWeight;
    let totalMoment = template.emptyMoment;

    const itemDetails = [{
      stationId: 'empty',
      name: 'Empty Aircraft',
      arm: template.emptyCg,
      weight: template.emptyWeight,
      moment: template.emptyMoment,
    }];

    for (const item of loadItems) {
      const station = stations.find((s) => s.id === item.stationId);
      if (!station) throw new BadRequestException(`Unknown station: ${item.stationId}`);
      if (item.weight < 0) throw new BadRequestException('Negative weight');
      if (item.weight > station.maxWeight) {
        throw new BadRequestException(`Station ${station.name} exceeds max ${station.maxWeight} lbs`);
      }
      const moment = item.weight * station.arm;
      totalWeight += item.weight;
      totalMoment += moment;
      itemDetails.push({ stationId: item.stationId, name: station.name, arm: station.arm, weight: item.weight, moment });
    }

    const cgInches = totalWeight > 0 ? totalMoment / totalWeight : 0;
    const withinLimits = this.checkEnvelope(envelope, totalWeight, cgInches);

    // Calculate how far we are from the nearest envelope boundary
    const marginPercent = this.calcMargin(envelope, totalWeight, cgInches);

    return { totalWeight, totalMoment, cgInches, withinLimits, marginPercent, items: itemDetails };
  }

  // ── Save W&B record for a flight ─────────────────────────────────────────
  async saveRecord(
    tenantId: string,
    aircraftId: string,
    templateId: string,
    flightId: string | undefined,
    calculation: WBCalculation,
    loadItems: LoadItem[],
  ) {
    return this.prisma.wBRecord.create({
      data: {
        tenantId,
        aircraftId,
        templateId,
        flightId,
        loadItems: loadItems as any,
        totalWeight: calculation.totalWeight,
        totalMoment: calculation.totalMoment,
        cgInches: calculation.cgInches,
        withinLimits: calculation.withinLimits,
      },
    });
  }

  // Point-in-polygon check against the CG envelope
  private checkEnvelope(envelope: EnvelopePoint[], weight: number, cg: number): boolean {
    // Find the envelope row closest to our weight
    const sorted = [...envelope].sort((a, b) => a.weight - b.weight);
    if (weight < sorted[0].weight || weight > sorted[sorted.length - 1].weight) return false;

    // Linear interpolation between envelope rows
    for (let i = 0; i < sorted.length - 1; i++) {
      const lo = sorted[i], hi = sorted[i + 1];
      if (weight >= lo.weight && weight <= hi.weight) {
        const t = (weight - lo.weight) / (hi.weight - lo.weight);
        const cgMin = lo.cgMin + t * (hi.cgMin - lo.cgMin);
        const cgMax = lo.cgMax + t * (hi.cgMax - lo.cgMax);
        return cg >= cgMin && cg <= cgMax;
      }
    }
    return false;
  }

  private calcMargin(envelope: EnvelopePoint[], weight: number, cg: number): number {
    const sorted = [...envelope].sort((a, b) => a.weight - b.weight);
    for (let i = 0; i < sorted.length - 1; i++) {
      const lo = sorted[i], hi = sorted[i + 1];
      if (weight >= lo.weight && weight <= hi.weight) {
        const t = (weight - lo.weight) / (hi.weight - lo.weight);
        const cgMin = lo.cgMin + t * (hi.cgMin - lo.cgMin);
        const cgMax = lo.cgMax + t * (hi.cgMax - lo.cgMax);
        const range = cgMax - cgMin;
        if (range <= 0) return 0;
        const pos = (cg - cgMin) / range; // 0..1
        return Math.round(Math.min(pos, 1 - pos) * 100);
      }
    }
    return 0;
  }
}
