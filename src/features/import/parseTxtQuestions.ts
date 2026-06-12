import type { ImportIssue, ImportReport, Question, QuestionOption, Source } from '../../types/question'
import { detectQuestionType, normalizeAnswer } from '../../shared/utils/answer'
import { createHash, createId } from '../../shared/utils/textNormalize'

const questionStartPattern = /^(\d+)[.、]\s*(.+)$/
const optionPattern = /^[•\s\t]*([A-Fa-f])[.．、]\s*(.+)$/
const answerPattern = /^答案[:：]\s*(.+)$/
const explanationPattern = /^解析[:：]\s*(.+)$/

interface RawBlock {
  number?: number
  lines: string[]
}

function splitBlocks(text: string) {
  const blocks: RawBlock[] = []
  let current: RawBlock | null = null

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const cleanLine = line.trimEnd()
    const start = cleanLine.match(questionStartPattern)

    if (start) {
      if (current) blocks.push(current)
      current = { number: Number(start[1]), lines: [cleanLine] }
      continue
    }

    if (current && cleanLine.trim()) {
      current.lines.push(cleanLine)
    }
  }

  if (current) blocks.push(current)
  return blocks
}

function parseBlock(block: RawBlock, source: Source, blockIndex: number): Question | null {
  const firstLine = block.lines[0]?.trim()
  const firstMatch = firstLine?.match(questionStartPattern)

  if (!firstMatch) return null

  const options: QuestionOption[] = []
  const stemLines = [firstMatch[2].trim()]
  const explanationLines: string[] = []
  let rawAnswer = ''
  let readingExplanation = false

  for (const line of block.lines.slice(1)) {
    const trimmed = line.trim()
    const optionMatch = trimmed.match(optionPattern)
    const answerMatch = trimmed.match(answerPattern)
    const explanationMatch = trimmed.match(explanationPattern)

    if (answerMatch) {
      rawAnswer = answerMatch[1].trim()
      readingExplanation = false
      continue
    }

    if (explanationMatch) {
      explanationLines.push(explanationMatch[1].trim())
      readingExplanation = true
      continue
    }

    if (optionMatch && !rawAnswer) {
      options.push({ key: optionMatch[1].toUpperCase(), text: optionMatch[2].trim() })
      continue
    }

    if (readingExplanation) {
      explanationLines.push(trimmed)
      continue
    }

    if (!rawAnswer && !optionMatch) {
      stemLines.push(trimmed)
    }
  }

  if (!rawAnswer || stemLines.join('').length === 0) return null

  const normalizedAnswer = normalizeAnswer(rawAnswer)
  const type = detectQuestionType(normalizedAnswer)
  const now = Date.now()
  const stem = stemLines.join('\n').trim()
  const normalizedHash = createHash(`${stem}${options.map((option) => option.text).join('')}`)

  return {
    id: `${source.id}_${blockIndex + 1}_${block.number ?? createId('q')}`,
    sourceId: source.id,
    sourceFile: source.fileName,
    originalNumber: block.number,
    type,
    stem,
    options: type === 'judge' && options.length === 0
      ? [
          { key: 'true', text: '正确' },
          { key: 'false', text: '错误' },
        ]
      : options,
    answer: normalizedAnswer,
    explanation: explanationLines.join('\n').trim(),
    knowledgePoints: inferKnowledgePoints(`${stem}\n${explanationLines.join('\n')}`),
    tags: [typeLabel(type), source.fileName.replace(/\.[^.]+$/, '')],
    normalizedHash,
    createdAt: now,
    updatedAt: now,
  }
}

function validateQuestion(question: Question): ImportIssue[] {
  const issues: ImportIssue[] = []
  const optionKeys = new Set(question.options.map((option) => option.key))

  if (!question.stem.trim()) {
    issues.push({ type: 'missing-stem', message: '题干为空', questionId: question.id, questionNumber: question.originalNumber })
  }

  if (question.answer.length === 0) {
    issues.push({ type: 'missing-answer', message: '答案为空或无法识别', questionId: question.id, questionNumber: question.originalNumber })
  }

  if (question.type !== 'judge' && question.options.length === 0) {
    issues.push({ type: 'missing-options', message: '选择题缺少选项', questionId: question.id, questionNumber: question.originalNumber })
  }

  if (question.type !== 'judge' && question.answer.some((answer) => !optionKeys.has(answer))) {
    issues.push({ type: 'invalid-answer', message: '答案不在选项范围内', questionId: question.id, questionNumber: question.originalNumber })
  }

  if (question.type === 'judge' && !['true', 'false'].includes(question.answer[0] ?? '')) {
    issues.push({ type: 'invalid-answer', message: '判断题答案无法归一化为正确/错误', questionId: question.id, questionNumber: question.originalNumber })
  }

  return issues
}

function typeLabel(type: Question['type']) {
  if (type === 'single') return '单选'
  if (type === 'multiple') return '多选'
  return '判断'
}

function inferKnowledgePoints(text: string) {
  const rules: Array<[string, string[]]> = [
    ['法律法规', ['商标法', '劳动法', '个人信息保护法', '民法典', '法律', '法规']],
    ['数据处理', ['数据清洗', '数据预处理', '数据整合', 'ETL', '数据质量', '数据标注']],
    ['机器学习', ['机器学习', '逻辑回归', '支持向量机', '决策树', 'K 折', 'K折', '模型', '损失函数']],
    ['深度学习', ['深度学习', '神经网络', 'SGD', '卷积']],
    ['人机交互', ['人机交互', 'GOMS', 'UAN', '用户', '交互']],
    ['业务分析', ['漏斗分析', 'RFM', 'PEST', '业务流程', '转化率']],
    ['数据库', ['数据库', 'DBMS', '数据仓库', 'NoSQL']],
    ['办公软件', ['Word', 'Excel', 'PowerPoint', 'SmartArt']],
  ]

  return rules
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([label]) => label)
}

export function parseTxtQuestions(fileName: string, text: string): ImportReport {
  const source: Source = {
    id: createId('src'),
    fileName,
    fileType: 'txt',
    importedAt: Date.now(),
    questionCount: 0,
    parseSuccessCount: 0,
    parseFailedCount: 0,
  }

  const blocks = splitBlocks(text)
  const failedBlocks: string[] = []
  const seenHashes = new Set<string>()
  const questions: Question[] = []
  const issues: ImportIssue[] = []
  let duplicateCount = 0

  for (const [blockIndex, block] of blocks.entries()) {
    const question = parseBlock(block, source, blockIndex)

    if (!question) {
      const blockText = block.lines.join('\n')
      failedBlocks.push(blockText)
      issues.push({ type: 'parse-failed', message: '题块无法解析为有效题目', block: blockText, questionNumber: block.number })
      continue
    }

    if (seenHashes.has(question.normalizedHash)) {
      duplicateCount += 1
      question.tags.push('疑似重复')
      issues.push({ type: 'duplicate', message: '文件内疑似重复题目', questionId: question.id, questionNumber: question.originalNumber })
    }

    const validationIssues = validateQuestion(question)
    issues.push(...validationIssues)

    seenHashes.add(question.normalizedHash)
    questions.push(question)
  }

  source.questionCount = blocks.length
  source.parseSuccessCount = questions.length
  source.parseFailedCount = failedBlocks.length

  return { source, questions, failedBlocks, duplicateCount, issues }
}
