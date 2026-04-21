import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WbService, LoadItem } from './wb.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('weight-balance')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('wb')
export class WbController {
  constructor(private readonly wb: WbService) {}

  @Get('templates')
  list(@Req() req: any, @Query('aircraftId') aircraftId?: string) {
    return this.wb.listTemplates(req.tenantId, aircraftId);
  }

  @Get('templates/:id')
  getTemplate(@Req() req: any, @Param('id') id: string) {
    return this.wb.getTemplate(req.tenantId, id);
  }

  @Post('templates')
  createTemplate(@Req() req: any, @Body() body: any) {
    return this.wb.createTemplate(req.tenantId, body.aircraftId, body);
  }

  @Post('calculate')
  calculate(
    @Req() req: any,
    @Body() body: { templateId: string; loadItems: LoadItem[] },
  ) {
    return this.wb.calculate(req.tenantId, body.templateId, body.loadItems);
  }

  @Post('records')
  saveRecord(@Req() req: any, @Body() body: any) {
    return this.wb.saveRecord(
      req.tenantId,
      body.aircraftId,
      body.templateId,
      body.flightId,
      body.calculation,
      body.loadItems,
    );
  }
}
