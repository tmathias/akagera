import {
  Controller, Get, Query, Param, ParseFloatPipe,
  ParseIntPipe, Res, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { WeatherService } from './weather.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('weather')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('weather')
export class WeatherController {
  constructor(private readonly wx: WeatherService) {}

  @Get('forecast')
  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lon', type: Number })
  forecast(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lon', ParseFloatPipe) lon: number,
  ) {
    return this.wx.getPointForecast({ lat, lon });
  }

  @Get('winds-aloft')
  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lon', type: Number })
  @ApiQuery({ name: 'alt', type: Number, required: false })
  windsAloft(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lon', ParseFloatPipe) lon: number,
    @Query('alt') altitudeFt: number = 5000,
  ) {
    return this.wx.getWindsAloft({ lat, lon, altitudeFt: Number(altitudeFt) });
  }

  @Get('route')
  async routeWeather(
    @Query('waypoints') waypointsJson: string,
    @Query('alt') alt: number = 5000,
  ) {
    const waypoints = JSON.parse(waypointsJson) as { lat: number; lon: number }[];
    return this.wx.getRouteWeather(waypoints, Number(alt));
  }

  // Proxy Windy animated map tiles — keeps API key server-side
  @Get('windy/:layer/:z/:x/:y')
  async windyTile(
    @Param('layer') layer: string,
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Res() res: Response,
  ) {
    const buf = await this.wx.getWindyTile(layer, z, x, y);
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=900',
    });
    res.send(buf);
  }
}
