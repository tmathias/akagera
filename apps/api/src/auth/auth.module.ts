import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { ClerkService } from './clerk.service';
import { AuthController } from './auth.controller';

@Module({
  providers: [AuthGuard, ClerkService],
  controllers: [AuthController],
  exports: [AuthGuard, ClerkService],
})
export class AuthModule {}
