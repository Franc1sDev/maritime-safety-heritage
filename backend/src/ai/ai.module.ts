import { Global, Module } from '@nestjs/common';
import { Ai } from './ai.service';

@Global()
@Module({ providers: [Ai], exports: [Ai] })
export class AiModule {}
