import { db } from '../db/dexie'
import type { AnswerRecord, Question } from '../types/question'
import { createId } from '../shared/utils/textNormalize'

export async function saveAnswer(question: Question, selected: string[], correct: boolean, durationMs: number, mode: AnswerRecord['mode']) {
  const record: AnswerRecord = {
    id: createId('answer'),
    questionId: question.id,
    sessionId: createId('session'),
    selectedAnswer: selected,
    correctAnswer: question.answer,
    isCorrect: correct,
    durationMs,
    answeredAt: Date.now(),
    mode,
  }
  await db.answerRecords.put(record)

  const existing = await db.mistakes.get(question.id)
  if (!correct) {
    await db.mistakes.put({
      questionId: question.id,
      wrongCount: (existing?.wrongCount ?? 0) + 1,
      correctStreak: 0,
      lastWrongAt: Date.now(),
      lastPracticeAt: Date.now(),
      mastered: false,
      reasonTags: existing?.reasonTags ?? [],
    })
    return
  }

  if (existing) {
    const correctStreak = existing.correctStreak + 1
    await db.mistakes.put({ ...existing, correctStreak, lastPracticeAt: Date.now(), mastered: correctStreak >= 3 })
  }
}
