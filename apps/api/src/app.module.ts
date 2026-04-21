import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { AircraftModule } from './aircraft/aircraft.module';
import { FlightsModule } from './flights/flights.module';
import { WeatherModule } from './weather/weather.module';
import { TrafficModule } from './traffic/traffic.module';
import { DocumentsModule } from './documents/documents.module';
import { WbModule } from './wb/wb.module';
import { RoutesModule } from './routes/routes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // Rate limiting — protect all endpoints
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ([{
        ttl: cfg.get('RATE_LIMIT_TTL', 60) * 1000,
        limit: cfg.get('RATE_LIMIT_MAX', 120),
      }]),
    }),

    PrismaModule,
    AuthModule,
    TenantsModule,
    AircraftModule,
    FlightsModule,
    WeatherModule,
    TrafficModule,
    DocumentsModule,
    WbModule,
    RoutesModule,
  ],
})
export class AppModule {}
