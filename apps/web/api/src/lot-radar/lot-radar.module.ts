import { Module } from '@nestjs/common';
import { NotifyModule } from '../notify/notify.module';
import { LotRadarController } from './lot-radar.controller';
import { LotRadarService } from './lot-radar.service';
@Module({ imports: [NotifyModule], controllers: [LotRadarController], providers: [LotRadarService] })
export class LotRadarModule {}
