import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FlightsService } from './flights.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('flights')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('flights')
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  @Get()
  list(
    @Req() req: any,
    @Query('aircraftId') aircraftId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.flights.list(req.tenantId, {
      aircraftId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('summary')
  summary(@Req() req: any, @Query('userId') userId?: string) {
    return this.flights.getLogbookSummary(req.tenantId, userId);
  }

  @Get(':id') get(@Req() req: any, @Param('id') id: string) { return this.flights.get(req.tenantId, id); }
  @Post() create(@Req() req: any, @Body() body: any) { return this.flights.create(req.tenantId, req.user.id, body); }
  @Put(':id') update(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.flights.update(req.tenantId, id, body); }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) { return this.flights.remove(req.tenantId, id); }
}
