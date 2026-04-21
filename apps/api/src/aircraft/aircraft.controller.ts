import {
  Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AircraftService } from './aircraft.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('aircraft')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('aircraft')
export class AircraftController {
  constructor(private readonly ac: AircraftService) {}

  @Get() list(@Req() req: any) { return this.ac.list(req.tenantId); }
  @Get('stats') stats(@Req() req: any) { return this.ac.getFleetStats(req.tenantId); }
  @Get(':id') get(@Req() req: any, @Param('id') id: string) { return this.ac.get(req.tenantId, id); }
  @Post() create(@Req() req: any, @Body() body: any) { return this.ac.create(req.tenantId, body); }
  @Put(':id') update(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.ac.update(req.tenantId, id, body); }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) { return this.ac.remove(req.tenantId, id); }
}
