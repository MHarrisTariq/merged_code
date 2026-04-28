import { Module } from '@nestjs/common';
import { SyncOrchestratorService } from './sync-orchestrator.service';

@Module({
  providers: [SyncOrchestratorService],
  exports: [SyncOrchestratorService],
})
export class SyncModule {}
