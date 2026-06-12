import { isSameAnswer } from '../shared/utils/answer'
import type { AppData } from '../types/app'
import type { AnswerRecord, KnowledgeItem, Mistake, Question, QuestionType } from '../types/question'

export function buildStats(data: AppData) {
  const correct = data.records.filter((record) => record.isCorrect).length
  const accuracy = data.records.length ? Math.round((correct / data.records.length) * 100) : 0
  const typeAccuracy = { single: 0, multiple: 0, judge: 0 }

  for (const type of Object.keys(typeAccuracy) as QuestionType[]) {
    const questionIds = new Set(data.questions.filter((question) => question.type === type).map((question) => question.id))
    const records = data.records.filter((record) => questionIds.has(record.questionId))
    const correctRecords = records.filter((record) => record.isCorrect).length
    typeAccuracy[type] = records.length ? Math.round((correctRecords / records.length) * 100) : 0
  }

  return {
    questionCount: data.questions.length,
    recordCount: data.records.length,
    accuracy,
    mistakeCount: data.mistakes.filter((mistake) => !mistake.mastered).length,
    examCount: data.exams.length,
    typeAccuracy,
  }
}

export function buildExamTypeStats(questions: Question[], answers: Record<string, string[]>) {
  return (['single', 'multiple', 'judge'] as QuestionType[]).map((type) => {
    const typeQuestions = questions.filter((question) => question.type === type)
    const correct = typeQuestions.filter((question) => isSameAnswer(answers[question.id] ?? [], question.answer)).length
    return {
      type,
      total: typeQuestions.length,
      correct,
      accuracy: typeQuestions.length ? Math.round((correct / typeQuestions.length) * 100) : 0,
    }
  })
}

export function buildSevenDayStats(records: AnswerRecord[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return { key, name: `${date.getMonth() + 1}/${date.getDate()}`, records: [] as AnswerRecord[] }
  })

  for (const record of records) {
    const key = new Date(record.answeredAt).toISOString().slice(0, 10)
    const day = days.find((item) => item.key === key)
    if (day) day.records.push(record)
  }

  return days.map((day) => {
    const correct = day.records.filter((record) => record.isCorrect).length
    return {
      name: day.name,
      作答数: day.records.length,
      正确率: day.records.length ? Math.round((correct / day.records.length) * 100) : 0,
    }
  })
}

export function buildKnowledgeSummary(items: KnowledgeItem[], states: Record<string, string>) {
  return {
    total: items.length,
    weak: items.filter((item) => states[item.id] === '不熟悉').length,
    learning: items.filter((item) => states[item.id] === '有印象').length,
    mastered: items.filter((item) => states[item.id] === '已掌握').length,
  }
}

export function buildTopMistakes(data: AppData) {
  const questionById = new Map(data.questions.map((question) => [question.id, question]))
  return data.mistakes
    .slice()
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 10)
    .map((mistake) => ({ mistake, question: questionById.get(mistake.questionId) }))
    .filter((item): item is { mistake: Mistake; question: Question } => Boolean(item.question))
}

export function buildStudySuggestions(data: AppData, stats: ReturnType<typeof buildStats>) {
  const typeLabels: Record<QuestionType, string> = { single: '单选专项', multiple: '多选巩固', judge: '判断速刷' }
  const weakestType = (Object.entries(stats.typeAccuracy) as Array<[QuestionType, number]>).sort((a, b) => a[1] - b[1])[0]
  const unseenCount = data.questions.length - new Set(data.records.map((record) => record.questionId)).size
  const latestExam = data.exams.at(-1)
  const latestExamValue = latestExam ? Math.round((latestExam.score / Math.max(latestExam.total, 1)) * 100) : 0

  return [
    { label: weakestType ? typeLabels[weakestType[0]] : '题型专项', value: weakestType ? Math.max(weakestType[1], 8) : 8 },
    { label: '错题复盘', value: data.mistakes.length ? Math.max(15, Math.min(100, 100 - stats.mistakeCount * 5)) : 100 },
    { label: latestExam ? '最近模考' : '未做题推进', value: latestExam ? latestExamValue : data.questions.length ? Math.round(((data.questions.length - unseenCount) / data.questions.length) * 100) : 0 },
  ]
}
