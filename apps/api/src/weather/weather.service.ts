import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface WeatherPoint {
  lat: number;
  lon: number;
}

interface AltitudePoint extends WeatherPoint {
  altitudeFt: number;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly meteoblueKey: string;
  private readonly windyKey: string;

  // Simple in-memory cache to reduce API calls (production: use Redis TTL)
  private cache = new Map<string, { data: unknown; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {
    this.meteoblueKey = config.get<string>('METEOBLUE_API_KEY', '');
    this.windyKey = config.get<string>('WINDY_API_KEY', '');
  }

  // ── Meteoblue point forecast ────────────────────────────────────────────
  async getPointForecast({ lat, lon }: WeatherPoint) {
    const cacheKey = `forecast:${lat.toFixed(2)}:${lon.toFixed(2)}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const url = new URL('https://my.meteoblue.com/packages/basic-1h_basic-day');
    url.searchParams.set('apikey', this.meteoblueKey);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('asl', '0');
    url.searchParams.set('format', 'json');

    const data = await this.fetchOrMock(url.toString(), this.mockForecast(lat, lon));
    this.setCache(cacheKey, data, 30 * 60 * 1000); // 30 min TTL
    return data;
  }

  // ── Meteoblue winds aloft ───────────────────────────────────────────────
  async getWindsAloft({ lat, lon, altitudeFt }: AltitudePoint) {
    const cacheKey = `winds:${lat.toFixed(2)}:${lon.toFixed(2)}:${altitudeFt}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const url = new URL('https://my.meteoblue.com/packages/wind-800hpa_wind-500hpa');
    url.searchParams.set('apikey', this.meteoblueKey);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('format', 'json');

    const data = await this.fetchOrMock(url.toString(), this.mockWindsAloft());
    this.setCache(cacheKey, data, 60 * 60 * 1000); // 1 hr TTL
    return data;
  }

  // ── Route weather profile ───────────────────────────────────────────────
  // Sample weather at regular intervals along a route
  async getRouteWeather(waypoints: WeatherPoint[], altitudeFt = 5000) {
    const promises = waypoints.map((wp) =>
      this.getPointForecast(wp).catch(() => null),
    );
    return Promise.all(promises);
  }

  // ── Windy tile proxy ────────────────────────────────────────────────────
  // Proxies Windy map tile requests, adding API key server-side
  async getWindyTile(layer: string, z: number, x: number, y: number): Promise<Buffer> {
    const cacheKey = `windy:${layer}:${z}:${x}:${y}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as Buffer;

    // Windy Point Forecast API — tiles at https://api.windy.com/map-forecast
    const url = `https://api.windy.com/map-forecast/v2.0/${layer}/${z}/${x}/${y}`;

    try {
      const res = await fetch(url, {
        headers: { 'x-windy-api': this.windyKey },
      });
      if (!res.ok) throw new Error(`Windy tile ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      this.setCache(cacheKey, buf, 15 * 60 * 1000); // 15 min TTL
      return buf;
    } catch (err) {
      this.logger.warn(`Windy tile fetch failed: ${err}`);
      throw new HttpException('Tile unavailable', HttpStatus.BAD_GATEWAY);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  private async fetchOrMock(url: string, mockData: unknown): Promise<unknown> {
    if (!this.meteoblueKey) {
      this.logger.debug('No Meteoblue key — returning mock weather data');
      return mockData;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      this.logger.error(`Weather fetch failed: ${err}`);
      return mockData;
    }
  }

  private getCache(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); return null; }
    return entry.data;
  }

  private setCache(key: string, data: unknown, ttlMs: number) {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  // Realistic-looking mock data for development without API keys
  private mockForecast(lat: number, lon: number) {
    const now = new Date();
    return {
      metadata: { modelrun_utc: now.toISOString(), lat, lon },
      data_1h: {
        time: Array.from({ length: 48 }, (_, i) => {
          const d = new Date(now); d.setHours(d.getHours() + i);
          return d.toISOString();
        }),
        temperature: Array.from({ length: 48 }, () => 15 + Math.random() * 15),
        windspeed: Array.from({ length: 48 }, () => Math.random() * 25),
        winddirection: Array.from({ length: 48 }, () => Math.floor(Math.random() * 360)),
        visibility: Array.from({ length: 48 }, () => 5 + Math.random() * 45),
        precipitation: Array.from({ length: 48 }, () => Math.random() < 0.2 ? Math.random() * 5 : 0),
        cloudcover: Array.from({ length: 48 }, () => Math.floor(Math.random() * 100)),
        cape: Array.from({ length: 48 }, () => Math.random() * 500),
      },
    };
  }

  private mockWindsAloft() {
    return {
      FL050: { speed: 15, direction: 270 },
      FL100: { speed: 30, direction: 250 },
      FL180: { speed: 55, direction: 240 },
      FL240: { speed: 80, direction: 230 },
    };
  }
}
