import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Public } from '../common/decorators';

@ApiTags('Health') @SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly ds: DataSource) {}

  @Public() @Get() @ApiOperation({ summary: 'Is the API up and can it reach the database?' })
  async check() {
    try {
      await this.ds.query('SELECT 1');
      return { status: 'ok', database: 'ok', time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
  }
}
