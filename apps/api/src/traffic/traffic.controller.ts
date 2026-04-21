import { Controller, Get, Param, Query, ParseFloatPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TrafficService } from './traffic.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('traffic')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('traffic')
export class TrafficController {
  constructor(private readonly traffic: TrafficService) {}

  // GET /traffic/states?lamin=&lamax=&lomin=&lomax=
  @Get('states')
  getStates(
    @Query('lamin', ParseFloatPipe) lamin: number,
    @Query('lamax', ParseFloatPipe) lamax: number,
    @Query('lomin', ParseFloatPipe) lomin: number,
    @Query('lomax', ParseFloatPipe) lomax: number,
  ) {
    return this.traffic.getStates(lamin, lamax, lomin, lomax);
  }

  // GET /traffic/aircraft/:icao24
  @Get('aircraft/:icao24')
  getAircraft(@Param('icao24') icao24: string) {
    return this.traffic.getAircraft(icao24.toLowerCase());
  }
}
