import { Module } from '@nestjs/common';
import { NotifyModule } from '../notify/notify.module';
import { ContractsController, PublicContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [NotifyModule],
  controllers: [PublicContractsController, ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
