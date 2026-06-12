import type { AppData } from '../types/app'
import type { Mistake, Question, QuestionType } from '../types/question'

type Page = 'dashboard' | 'import' | 'bank' | 'practice' | 'knowledge' | 'mistakes' | 'exam' | 'stats'

export interface AiPlanItem {
  title: string
  description: string
  target: Page
}

export interface WeakTypeInsight {
  type: QuestionType
  label: string
  accuracy: number
  answered: number
}

export interface WeakKnowledgeInsight {
  name: string
  accuracy: number
  answered: number
}

export interface LocalAiReport {
  plan: AiPlanItem[]
  weakestType: WeakTypeInsight | null
  weakestKnowledgePoints: WeakKnowledgeInsight[]
  reminders: string[]
  reasonSummary: Array<{ tag: string; count: number }>
}

const typeLabels: Record<QuestionType, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
}

const knowledgeRules: Array<[string, string[]]> = [
  ['法律法规', ['商标法', '劳动法', '个人信息保护法', '民法典', '法律', '法规', '侵权']],
  ['数据处理', ['数据清洗', '数据预处理', '数据整合', 'ETL', '数据质量', '数据标注']],
  ['机器学习', ['机器学习', '逻辑回归', '支持向量机', '决策树', 'K 折', 'K折', '模型', '损失函数']],
  ['深度学习', ['深度学习', '神经网络', 'SGD', '卷积']],
  ['人机交互', ['人机交互', 'GOMS', 'UAN', '用户', '交互']],
  ['业务分析', ['漏斗分析', 'RFM', 'PEST', '业务流程', '转化率']],
  ['数据库', ['数据库', 'DBMS', '数据仓库', 'NoSQL']],
  ['办公软件', ['Word', 'Excel', 'PowerPoint', 'SmartArt']],
]

export function recommendKnowledgePoints(question: Pick<Question, 'stem' | 'explanation' | 'options' | 'knowledgePoints'>) {
  const text = `${question.stem}\n${question.explanation ?? ''}\n${question.options.map((option) => option.text).join('\n')}`
  return knowledgeRules
    .filter(([label, keywords]) => !question.knowledgePoints.includes(label) && keywords.some((keyword) => text.includes(keyword)))
    .map(([label]) => label)
}

export function recommendMistakeReason(question: Question, mistake: Mistake) {
  const tags = new Set<string>()
  const text = `${question.stem}\n${question.explanation ?? ''}`

  if (question.type === 'multiple') tags.add('多选漏选')
  if (question.knowledgePoints.length === 0) tags.add('知识盲区')
  if (mistake.wrongCount >= 3) tags.add('记忆混淆')
  if (/下列|哪项|不属于|错误的是|正确的是/.test(text)) tags.add('审题失误')
  if (/(概念|定义|指的是|是什么)/.test(text)) tags.add('概念不清')
  if (tags.size === 0) tags.add('粗心错选')

  return [...tags].filter((tag) => !(mistake.reasonTags ?? []).includes(tag)).slice(0, 3)
}

export function buildSpecialPracticeQuestions(data: AppData, report: LocalAiReport) {
  const weakKnowledge = new Set(report.weakestKnowledgePoints.map((item) => item.name))
  const openMistakeIds = new Set(data.mistakes.filter((mistake) => !mistake.mastered).map((mistake) => mistake.questionId))
  const questions = data.questions.filter((question) => {
    if (report.weakestType && question.type === report.weakestType.type) return true
    if (openMistakeIds.has(question.id)) return true
    if (question.knowledgePoints.some((point) => weakKnowledge.has(point))) return true
    return false
  })

  return questions.slice(0, 30)
}

export function buildLocalAiReport(data: AppData): LocalAiReport {
  const recordsByQuestionId = new Map<string, typeof data.records>()
  for (const record of data.records) {
    const current = recordsByQuestionId.get(record.questionId) ?? []
    current.push(record)
    recordsByQuestionId.set(record.questionId, current)
  }

  const unansweredCount = data.questions.length - new Set(data.records.map((record) => record.questionId)).size
  const openMistakes = data.mistakes.filter((mistake) => !mistake.mastered)
  const latestExam = data.exams.at(-1)
  const previousExam = data.exams.at(-2)

  const typeInsights = (['single', 'multiple', 'judge'] as QuestionType[])
    .map((type) => {
      const questions = data.questions.filter((question) => question.type === type)
      const questionIds = new Set(questions.map((question) => question.id))
      const records = data.records.filter((record) => questionIds.has(record.questionId))
      const correct = records.filter((record) => record.isCorrect).length
      return {
        type,
        label: typeLabels[type],
        accuracy: records.length ? Math.round((correct / records.length) * 100) : 0,
        answered: records.length,
      }
    })
    .filter((item) => item.answered > 0)
    .sort((a, b) => a.accuracy - b.accuracy)

  const weakestType = typeInsights[0] ?? null

  const knowledgeStats = new Map<string, { correct: number; total: number }>()
  for (const question of data.questions) {
    const records = recordsByQuestionId.get(question.id) ?? []
    if (records.length === 0) continue
    for (const point of question.knowledgePoints) {
      const stat = knowledgeStats.get(point) ?? { correct: 0, total: 0 }
      stat.total += records.length
      stat.correct += records.filter((record) => record.isCorrect).length
      knowledgeStats.set(point, stat)
    }
  }

  const weakestKnowledgePoints = [...knowledgeStats.entries()]
    .map(([name, stat]) => ({
      name,
      accuracy: stat.total ? Math.round((stat.correct / stat.total) * 100) : 0,
      answered: stat.total,
    }))
    .filter((item) => item.answered >= 2)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5)

  const reminders: string[] = []
  if (openMistakes.length >= 10) reminders.push(`当前有 ${openMistakes.length} 道未掌握错题，建议先做错题重练。`)
  if (unansweredCount >= 50) reminders.push(`还有 ${unansweredCount} 道题未做，建议优先推进未做题。`)
  if (latestExam && previousExam && latestExam.score < previousExam.score) reminders.push(`最近一次模考比上一次低 ${previousExam.score - latestExam.score} 分，建议安排一次专项复盘。`)
  if (data.records.length === 0) reminders.push('当前还没有答题记录，先完成一轮基础刷题再看智能分析更准确。')

  const reasonSummary = summarizeReasonTags(data.mistakes)

  const plan: AiPlanItem[] = []
  if (weakestType) {
    plan.push({
      title: `${weakestType.label}专项巩固`,
      description: `${weakestType.label}正确率 ${weakestType.accuracy}%，优先安排该题型专项练习。`,
      target: 'practice',
    })
  }
  if (openMistakes.length > 0) {
    plan.push({
      title: '错题集中复盘',
      description: `当前有 ${openMistakes.length} 道未掌握错题，建议按错因标签分组重练。`,
      target: 'mistakes',
    })
  }
  if (weakestKnowledgePoints[0]) {
    plan.push({
      title: `知识点“${weakestKnowledgePoints[0].name}”补强`,
      description: `该知识点正确率 ${weakestKnowledgePoints[0].accuracy}%，建议先复习知识点再回刷相关题目。`,
      target: 'knowledge',
    })
  }
  if (unansweredCount > 0) {
    plan.push({
      title: '推进未做题覆盖率',
      description: `还有 ${unansweredCount} 道未做题，建议先扩充覆盖面。`,
      target: 'practice',
    })
  }

  return {
    plan: plan.slice(0, 4),
    weakestType,
    weakestKnowledgePoints,
    reminders: reminders.slice(0, 4),
    reasonSummary,
  }
}

function summarizeReasonTags(mistakes: Mistake[]) {
  const counts = new Map<string, number>()
  for (const mistake of mistakes) {
    for (const tag of mistake.reasonTags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
}
