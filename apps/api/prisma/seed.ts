/**
 * Prisma seed script — populates the database with:
 *  - Akagera Aviation tenant (based on the original fleet data)
 *  - Demo aircraft (Robinson R44s and AgustaWestland helicopters)
 *  - W&B templates for R44 and A139
 *  - Sample checklists
 *
 * Run with:  npm run db:seed  (from apps/api)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database…');

  // ── Tenant ──────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'akagera-aviation' },
    update: {},
    create: {
      name: 'Akagera Aviation',
      slug: 'akagera-aviation',
      primaryColor: '#00d4ff',
      timezone: 'Africa/Kigali',
      country: 'RW',
    },
  });
  console.log('  ✓ Tenant:', tenant.name);

  // ── Aircraft ─────────────────────────────────────────────────────────────
  const aircraftData = [
    { registration: '9XR-SG', type: 'R44', manufacturer: 'Robinson', serialNumber: '10331', emptyWeight: 1464, maxGrossWeight: 2500, engineTimeHours: 5001, airframeHours: 5000, category: 'HELICOPTER' },
    { registration: '9XR-SF', type: 'R44', manufacturer: 'Robinson', serialNumber: '11452', emptyWeight: 1464, maxGrossWeight: 2500, engineTimeHours: 1998, airframeHours: 2280, category: 'HELICOPTER' },
    { registration: '9XR-SJ', type: 'R44 II', manufacturer: 'Robinson', serialNumber: '13437', emptyWeight: 1500, maxGrossWeight: 2500, engineTimeHours: 784, airframeHours: 988, category: 'HELICOPTER' },
    { registration: '9XR-SQ', type: 'AW139', manufacturer: 'AgustaWestland', serialNumber: '12522', emptyWeight: 7055, maxGrossWeight: 14991, engineTimeHours: 668, airframeHours: 569, multiEngine: true, turbineEngine: true, category: 'HELICOPTER' },
    { registration: '9XR-SO', type: 'AW109', manufacturer: 'AgustaWestland', serialNumber: '1458', emptyWeight: 3748, maxGrossWeight: 6283, engineTimeHours: 1699, airframeHours: 1255, multiEngine: true, turbineEngine: true, category: 'HELICOPTER' },
    { registration: '9XR-SH', type: 'R44 II', manufacturer: 'Robinson', serialNumber: '12918', emptyWeight: 1500, maxGrossWeight: 2500, engineTimeHours: 488, airframeHours: 486, category: 'HELICOPTER' },
    { registration: '9XR-SE', type: 'R44 II', manufacturer: 'Robinson', serialNumber: '10323', emptyWeight: 1500, maxGrossWeight: 2500, engineTimeHours: 1204, airframeHours: 3725, category: 'HELICOPTER' },
  ];

  const aircraft: Record<string, any> = {};
  for (const ac of aircraftData) {
    const created = await prisma.aircraft.upsert({
      where: { tenantId_registration: { tenantId: tenant.id, registration: ac.registration } },
      update: {},
      create: { ...ac, tenantId: tenant.id, status: 'ACTIVE', category: ac.category as any },
    });
    aircraft[ac.registration] = created;
    console.log(`  ✓ Aircraft: ${ac.registration} (${ac.type})`);
  }

  // ── W&B Template: Robinson R44 II ─────────────────────────────────────────
  // Reference: R44 II Pilot's Operating Handbook, Section 6
  const r44 = aircraft['9XR-SG'] || Object.values(aircraft).find((a: any) => a.type === 'R44');
  if (r44) {
    await prisma.wBTemplate.upsert({
      where: { id: 'wb-r44-standard' },
      update: {},
      create: {
        id: 'wb-r44-standard',
        tenantId: tenant.id,
        aircraftId: r44.id,
        name: 'R44 Standard',
        emptyWeight: 1464,
        emptyCg: 106.3,
        emptyMoment: 1464 * 106.3,
        stations: [
          { id: 'pilot', name: 'Pilot (Front Left)', arm: 100.8, defaultWeight: 170, maxWeight: 300 },
          { id: 'copilot', name: 'Co-Pilot (Front Right)', arm: 100.8, defaultWeight: 170, maxWeight: 300 },
          { id: 'rear_left', name: 'Rear Passenger Left', arm: 119.0, defaultWeight: 0, maxWeight: 300 },
          { id: 'rear_right', name: 'Rear Passenger Right', arm: 119.0, defaultWeight: 0, maxWeight: 300 },
          { id: 'baggage', name: 'Baggage Compartment', arm: 138.0, defaultWeight: 0, maxWeight: 50 },
          { id: 'fuel', name: 'Fuel (main, 35 gal max)', arm: 106.0, defaultWeight: 180, maxWeight: 231 },
        ] as any,
        envelopePoints: [
          { weight: 1200, cgMin: 102.0, cgMax: 110.5 },
          { weight: 1500, cgMin: 102.0, cgMax: 110.5 },
          { weight: 1900, cgMin: 103.5, cgMax: 110.5 },
          { weight: 2200, cgMin: 104.5, cgMax: 110.5 },
          { weight: 2500, cgMin: 104.5, cgMax: 108.5 },
        ] as any,
      },
    });
    console.log('  ✓ W&B Template: R44 Standard');
  }

  // ── W&B Template: AW139 ──────────────────────────────────────────────────
  const aw139 = aircraft['9XR-SQ'];
  if (aw139) {
    await prisma.wBTemplate.upsert({
      where: { id: 'wb-aw139-standard' },
      update: {},
      create: {
        id: 'wb-aw139-standard',
        tenantId: tenant.id,
        aircraftId: aw139.id,
        name: 'AW139 Standard Config',
        emptyWeight: 7055,
        emptyCg: 245.5,
        emptyMoment: 7055 * 245.5,
        stations: [
          { id: 'pilots', name: 'Flight Crew (2)', arm: 192.0, defaultWeight: 380, maxWeight: 500 },
          { id: 'pax_fwd', name: 'Fwd Cabin Pax (4)', arm: 230.0, defaultWeight: 680, maxWeight: 880 },
          { id: 'pax_aft', name: 'Aft Cabin Pax (4)', arm: 270.0, defaultWeight: 680, maxWeight: 880 },
          { id: 'baggage_fwd', name: 'Fwd Baggage', arm: 175.0, defaultWeight: 0, maxWeight: 220 },
          { id: 'baggage_aft', name: 'Aft Baggage', arm: 320.0, defaultWeight: 0, maxWeight: 440 },
          { id: 'fuel', name: 'Fuel (max 1800 lb)', arm: 248.0, defaultWeight: 1200, maxWeight: 1800 },
        ] as any,
        envelopePoints: [
          { weight: 7000, cgMin: 235.0, cgMax: 260.0 },
          { weight: 9000, cgMin: 237.0, cgMax: 260.0 },
          { weight: 12000, cgMin: 239.0, cgMax: 258.0 },
          { weight: 14000, cgMin: 241.0, cgMax: 256.0 },
          { weight: 14991, cgMin: 241.0, cgMax: 254.0 },
        ] as any,
      },
    });
    console.log('  ✓ W&B Template: AW139 Standard');
  }

  // ── Checklist for R44 ────────────────────────────────────────────────────
  await prisma.checklist.upsert({
    where: { id: 'ckl-r44-preflight' },
    update: {},
    create: {
      id: 'ckl-r44-preflight',
      tenantId: tenant.id,
      aircraftType: 'R44',
      title: 'R44 Pre-Flight',
      phase: 'preflight',
      version: '1.0',
      items: [
        { id: '1', text: 'Technical log reviewed and signed', response: 'DONE', critical: true },
        { id: '2', text: 'Fuel — quantity confirmed, caps secure', response: 'CHECKED', critical: true },
        { id: '3', text: 'Oil level — within limits', response: 'CHECKED', critical: true },
        { id: '4', text: 'Drive belt — tension and condition', response: 'CHECKED', critical: true },
        { id: '5', text: 'Main rotor blades — condition and security', response: 'CHECKED' },
        { id: '6', text: 'Tail rotor — condition, travel', response: 'CHECKED', critical: true },
        { id: '7', text: 'W&B — calculated within limits', response: 'DONE', critical: true },
      ] as any,
    },
  });
  console.log('  ✓ Checklist: R44 Pre-Flight');

  console.log('\n✅ Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
