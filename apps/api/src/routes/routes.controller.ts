import { Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('routes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get() list(@Req() req: any) { return this.routes.list(req.tenantId); }
  @Get(':id') get(@Req() req: any, @Param('id') id: string) { return this.routes.get(req.tenantId, id); }
  @Post() create(@Req() req: any, @Body() body: any) { return this.routes.create(req.tenantId, req.user.id, body); }
  @Put(':id') update(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.routes.update(req.tenantId, id, body); }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) { return this.routes.remove(req.tenantId, id); }
}
