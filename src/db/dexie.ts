import Dexie, { type Table } from 'dexie'
import type {
  AnswerRecord,
  ExamPaper,
  Favorite,
  KnowledgeItem,
  Mistake,
  Note,
  PracticeSession,
  Question,
  Source,
} from '../types/question'

class ExamPrepDatabase extends Dexie {
  sources!: Table<Source, string>
  questions!: Table<Question, string>
  practiceSessions!: Table<PracticeSession, string>
  answerRecords!: Table<AnswerRecord, string>
  mistakes!: Table<Mistake, string>
  favorites!: Table<Favorite, string>
  notes!: Table<Note, string>
  examPapers!: Table<ExamPaper, string>
  knowledgeItems!: Table<KnowledgeItem, string>

  constructor() {
    super('aiTrainerExamPrep')

    this.version(1).stores({
      sources: 'id, fileName, fileType, importedAt',
      questions: 'id, type, sourceId, normalizedHash, category, *knowledgePoints, *tags',
      practiceSessions: 'id, mode, startedAt, endedAt',
      answerRecords: 'id, questionId, sessionId, isCorrect, answeredAt, mode',
      mistakes: 'questionId, wrongCount, lastWrongAt, mastered',
      favorites: 'questionId, createdAt',
      notes: 'id, questionId, updatedAt',
      examPapers: 'id, createdAt, score, duration',
      knowledgeItems: 'id, title, *tags',
    })
  }
}

export const db = new ExamPrepDatabase()

export async function importQuestions(source: Source, questions: Question[], knowledgeItems: KnowledgeItem[] = []) {
  await db.transaction('rw', db.sources, db.questions, db.knowledgeItems, async () => {
    await db.sources.put(source)
    if (questions.length > 0) await db.questions.bulkPut(questions)
    if (knowledgeItems.length > 0) await db.knowledgeItems.bulkPut(knowledgeItems)
  })
}

export async function clearAllData() {
  await Promise.all([
    db.sources.clear(),
    db.questions.clear(),
    db.practiceSessions.clear(),
    db.answerRecords.clear(),
    db.mistakes.clear(),
    db.favorites.clear(),
    db.notes.clear(),
    db.examPapers.clear(),
    db.knowledgeItems.clear(),
  ])
}
