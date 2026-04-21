import { Controller, Get, Put, Body, Req, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.tenants.get(req.tenantId);
  }

  @Put('me')
  update(@Req() req: any, @Body() body: any) {
    return this.tenants.update(req.tenantId, body);
  }

  @Get('me/users')
  users(@Req() req: any) {
    return this.tenants.listUsers(req.tenantId);
  }

  @Get('me/expiring-credentials')
  expiringCredentials(@Req() req: any, @Query('days') days?: number) {
    return this.tenants.getExpiringCredentials(req.tenantId, days ? Number(days) : 60);
  }
}
