import { clearAllData, db } from '../../db/dexie'
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
} from '../../types/question'

export interface BackupFile {
  version: 1
  exportedAt: number
  sources: Source[]
  questions: Question[]
  practiceSessions: PracticeSession[]
  answerRecords: AnswerRecord[]
  mistakes: Mistake[]
  favorites: Favorite[]
  notes: Note[]
  examPapers: ExamPaper[]
  knowledgeItems: KnowledgeItem[]
}

export async function createBackup(): Promise<BackupFile> {
  const [sources, questions, practiceSessions, answerRecords, mistakes, favorites, notes, examPapers, knowledgeItems] = await Promise.all([
    db.sources.toArray(),
    db.questions.toArray(),
    db.practiceSessions.toArray(),
    db.answerRecords.toArray(),
    db.mistakes.toArray(),
    db.favorites.toArray(),
    db.notes.toArray(),
    db.examPapers.toArray(),
    db.knowledgeItems.toArray(),
  ])

  return {
    version: 1,
    exportedAt: Date.now(),
    sources,
    questions,
    practiceSessions,
    answerRecords,
    mistakes,
    favorites,
    notes,
    examPapers,
    knowledgeItems,
  }
}

export function downloadBackup(backup: BackupFile) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ai-trainer-exam-backup-${new Date(backup.exportedAt).toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function validateBackup(value: unknown): BackupFile {
  const backup = value as Partial<BackupFile>
  if (!backup || backup.version !== 1) {
    throw new Error('备份文件版本不匹配')
  }

  const keys: Array<keyof BackupFile> = [
    'sources',
    'questions',
    'practiceSessions',
    'answerRecords',
    'mistakes',
    'favorites',
    'notes',
    'examPapers',
    'knowledgeItems',
  ]

  for (const key of keys) {
    if (!Array.isArray(backup[key])) {
      throw new Error(`备份文件缺少 ${key} 数据`)
    }
  }

  return backup as BackupFile
}

export async function restoreBackup(backup: BackupFile) {
  await clearAllData()
  await Promise.all([
    db.sources.bulkPut(backup.sources),
    db.questions.bulkPut(backup.questions),
    db.practiceSessions.bulkPut(backup.practiceSessions),
    db.answerRecords.bulkPut(backup.answerRecords),
    db.mistakes.bulkPut(backup.mistakes),
    db.favorites.bulkPut(backup.favorites),
    db.notes.bulkPut(backup.notes),
    db.examPapers.bulkPut(backup.examPapers),
    db.knowledgeItems.bulkPut(backup.knowledgeItems),
  ])
}
