import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DecisionEngineService } from './decision-engine.service';

@Module({
  imports: [AiModule],
  providers: [DecisionEngineService],
  exports: [DecisionEngineService],
})
export class DecisionModule {}
