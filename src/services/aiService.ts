import type { AppData } from '../types/app'
import type { Mistake, Question } from '../types/question'
import {
  buildLocalAiReport,
  buildSpecialPracticeQuestions,
  recommendKnowledgePoints,
  recommendMistakeReason,
  type LocalAiReport,
} from './localAiService'

export interface AiService {
  buildReport(data: AppData): LocalAiReport
  buildPracticeQuestions(data: AppData, report: LocalAiReport): Question[]
  recommendKnowledgePoints(question: Pick<Question, 'stem' | 'explanation' | 'options' | 'knowledgePoints'>): string[]
  recommendMistakeReason(question: Question, mistake: Mistake): string[]
}

export const localAiService: AiService = {
  buildReport: buildLocalAiReport,
  buildPracticeQuestions: buildSpecialPracticeQuestions,
  recommendKnowledgePoints,
  recommendMistakeReason,
}
