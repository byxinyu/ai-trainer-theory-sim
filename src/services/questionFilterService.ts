import { buildLocalAiReport, buildSpecialPracticeQuestions } from './localAiService'
import type { AppData } from '../types/app'
import type { QuestionType } from '../types/question'

export type PracticeFilter = 'all' | QuestionType | 'mistakes' | 'favorites' | 'unseen' | 'ai'

export function filterQuestions(data: AppData, filter: PracticeFilter) {
  const mistakeSet = new Set(data.mistakes.filter((mistake) => !mistake.mastered).map((mistake) => mistake.questionId))
  const favoriteSet = new Set(data.favorites.map((favorite) => favorite.questionId))
  const seenSet = new Set(data.records.map((record) => record.questionId))

  if (filter === 'ai') return buildSpecialPracticeQuestions(data, buildLocalAiReport(data))
  if (filter === 'mistakes') return data.questions.filter((question) => mistakeSet.has(question.id))
  if (filter === 'favorites') return data.questions.filter((question) => favoriteSet.has(question.id))
  if (filter === 'unseen') return data.questions.filter((question) => !seenSet.has(question.id))
  if (filter === 'all') return data.questions
  return data.questions.filter((question) => question.type === filter)
}
