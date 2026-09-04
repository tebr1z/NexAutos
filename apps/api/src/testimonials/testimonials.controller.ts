import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('testimonials')
export class TestimonialsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.testimonial.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
