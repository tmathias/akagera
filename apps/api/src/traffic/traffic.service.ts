import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AircraftState {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  timePosition: number | null;
  lastContact: number;
  longitude: number | null;
  latitude: number | null;
  baroAltitude: number | null;  // meters
  onGround: boolean;
  velocity: number | null;      // m/s
  trueTrack: number | null;     // degrees
  verticalRate: number | null;  // m/s
  squawk: string | null;
  category: number | null;
}

@Injectable()
export class TrafficService {
  private readonly logger = new Logger(TrafficService.name);
  private readonly openskyUser: string;
  private readonly openskyPass: string;

  // Per-bounding-box cache to avoid hammering OpenSky (free: 10 req/min)
  private stateCache = new Map<string, { data: AircraftState[]; ts: number }>();
  private readonly CACHE_TTL_MS = 12_000; // 12 s — ADS-B updates every 10 s

  constructor(private readonly config: ConfigService) {
    this.openskyUser = config.get<string>('OPENSKY_USERNAME', '');
    this.openskyPass = config.get<string>('OPENSKY_PASSWORD', '');
  }

  // ── Fetch states for a bounding box ─────────────────────────────────────
  async getStates(
    lamin: number, lamax: number,
    lomin: number, lomax: number,
  ): Promise<AircraftState[]> {
    const key = `${lamin}:${lamax}:${lomin}:${lomax}`;
    const cached = this.stateCache.get(key);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const url = new URL('https://opensky-network.org/api/states/all');
    url.searchParams.set('lamin', String(lamin));
    url.searchParams.set('lamax', String(lamax));
    url.searchParams.set('lomin', String(lomin));
    url.searchParams.set('lomax', String(lomax));

    try {
      const headers: Record<string, string> = {};
      if (this.openskyUser && this.openskyPass) {
        const creds = Buffer.from(`${this.openskyUser}:${this.openskyPass}`).toString('base64');
        headers['Authorization'] = `Basic ${creds}`;
      }

      const res = await fetch(url.toString(), { headers });

      if (res.status === 429) {
        this.logger.warn('OpenSky rate limited — returning cached/empty data');
        return cached?.data ?? [];
      }

      if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);

      const json = await res.json() as { states?: unknown[][] };
      const states = this.parseStates(json.states ?? []);
      this.stateCache.set(key, { data: states, ts: Date.now() });
      return states;
    } catch (err) {
      this.logger.error(`OpenSky fetch error: ${err}`);
      return cached?.data ?? this.mockTraffic(lamin, lamax, lomin, lomax);
    }
  }

  // ── Single aircraft detail ───────────────────────────────────────────────
  async getAircraft(icao24: string): Promise<AircraftState | null> {
    const url = `https://opensky-network.org/api/states/all?icao24=${icao24}`;
    try {
      const res = await fetch(url);
      const json = await res.json() as { states?: unknown[][] };
      if (!json.states?.length) return null;
      return this.parseStates(json.states)[0] ?? null;
    } catch {
      return null;
    }
  }

  // Map raw OpenSky state vector array to typed objects
  private parseStates(raw: unknown[][]): AircraftState[] {
    return (raw ?? [])
      .filter((s) => s[5] != null && s[6] != null) // must have position
      .map((s) => ({
        icao24: String(s[0]),
        callsign: s[1] ? String(s[1]).trim() : null,
        originCountry: String(s[2]),
        timePosition: s[3] as number | null,
        lastContact: s[4] as number,
        longitude: s[5] as number,
        latitude: s[6] as number,
        baroAltitude: s[7] as number | null,
        onGround: Boolean(s[8]),
        velocity: s[9] as number | null,
        trueTrack: s[10] as number | null,
        verticalRate: s[11] as number | null,
        squawk: s[14] ? String(s[14]) : null,
        category: s[17] as number | null,
      }))
      // Filter out ground traffic for map cleanliness unless explicitly needed
      .filter((s) => !s.onGround);
  }

  // Generate mock traffic around the centre of the bounding box
  private mockTraffic(lamin: number, lamax: number, lomin: number, lomax: number): AircraftState[] {
    const lat = (lamin + lamax) / 2;
    const lon = (lomin + lomax) / 2;
    return Array.from({ length: 6 }, (_, i) => ({
      icao24: `mock${i.toString(16).padStart(6, '0')}`,
      callsign: `MOCK${100 + i}`,
      originCountry: 'Rwanda',
      timePosition: Date.now() / 1000,
      lastContact: Date.now() / 1000,
      longitude: lon + (Math.random() - 0.5) * 2,
      latitude: lat + (Math.random() - 0.5) * 2,
      baroAltitude: 1000 + Math.random() * 4000,
      onGround: false,
      velocity: 50 + Math.random() * 200,
      trueTrack: Math.random() * 360,
      verticalRate: (Math.random() - 0.5) * 10,
      squawk: '1200',
      category: 1,
    }));
  }
}
