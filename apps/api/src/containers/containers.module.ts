import { Module } from '@nestjs/common';
import { VesselsModule } from '../vessels/vessels.module';
import { ContainersController } from './containers.controller';
import { ContainersService } from './containers.service';

@Module({
  imports: [VesselsModule],
  controllers: [ContainersController],
  providers: [ContainersService],
  exports: [ContainersService],
})
export class ContainersModule {}
