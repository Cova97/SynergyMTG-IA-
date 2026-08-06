import { Module } from '@nestjs/common';
import { ComboAnalysisAiService } from './combo-analysis-ai.service';

@Module({
  providers: [ComboAnalysisAiService],
  exports: [ComboAnalysisAiService],
})
export class AiModule {}
