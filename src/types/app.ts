import type { AnswerRecord, ExamPaper, Favorite, KnowledgeItem, Mistake, Question } from './question'

export interface AppData {
  questions: Question[]
  records: AnswerRecord[]
  mistakes: Mistake[]
  favorites: Favorite[]
  exams: ExamPaper[]
  knowledgeItems: KnowledgeItem[]
}
