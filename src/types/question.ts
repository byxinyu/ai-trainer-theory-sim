export type QuestionType = 'single' | 'multiple' | 'judge'
export type PracticeMode = 'practice' | 'exam' | 'mistake' | 'favorite'

export interface QuestionOption {
  key: string
  text: string
}

export interface Question {
  id: string
  sourceId: string
  sourceFile: string
  originalNumber?: number
  type: QuestionType
  stem: string
  options: QuestionOption[]
  answer: string[]
  explanation?: string
  category?: string
  knowledgePoints: string[]
  tags: string[]
  difficulty?: 1 | 2 | 3 | 4 | 5
  normalizedHash: string
  createdAt: number
  updatedAt: number
}

export interface Source {
  id: string
  fileName: string
  fileType: 'txt' | 'docx' | 'json'
  importedAt: number
  questionCount: number
  parseSuccessCount: number
  parseFailedCount: number
}

export interface PracticeSession {
  id: string
  mode: PracticeMode
  startedAt: number
  endedAt?: number
}

export interface AnswerRecord {
  id: string
  questionId: string
  sessionId: string
  selectedAnswer: string[]
  correctAnswer: string[]
  isCorrect: boolean
  durationMs: number
  answeredAt: number
  mode: PracticeMode
}

export interface Mistake {
  questionId: string
  wrongCount: number
  correctStreak: number
  lastWrongAt: number
  lastPracticeAt: number
  mastered: boolean
  reasonTags?: string[]
}

export interface Favorite {
  questionId: string
  createdAt: number
}

export interface Note {
  id: string
  questionId: string
  content: string
  updatedAt: number
}

export interface ExamPaper {
  id: string
  questionIds: string[]
  selectedAnswers: Record<string, string[]>
  score: number
  total: number
  duration: number
  createdAt: number
}

export interface KnowledgeItem {
  id: string
  title: string
  content: string
  tags: string[]
  relatedQuestionIds: string[]
}

export type ImportIssueType = 'parse-failed' | 'missing-stem' | 'missing-answer' | 'missing-options' | 'invalid-answer' | 'duplicate'

export interface ImportIssue {
  type: ImportIssueType
  message: string
  block?: string
  questionId?: string
  questionNumber?: number
}

export interface ImportReport {
  source: Source
  questions: Question[]
  failedBlocks: string[]
  duplicateCount: number
  knowledgeItems?: KnowledgeItem[]
  issues?: ImportIssue[]
}
