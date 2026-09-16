import { Module } from '@nestjs/common';
import { TestimonialsController } from './testimonials.controller';

@Module({
  controllers: [TestimonialsController],
})
export class TestimonialsModule {}
