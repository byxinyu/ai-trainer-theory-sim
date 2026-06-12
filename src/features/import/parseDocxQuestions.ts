import mammoth from 'mammoth'
import type { ImportReport, KnowledgeItem, Source } from '../../types/question'
import { createHash, createId } from '../../shared/utils/textNormalize'
import { parseTxtQuestions } from './parseTxtQuestions'

function normalizeDocxText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseJudgeSummary(fileName: string, text: string): ImportReport {
  const source: Source = {
    id: createId('src'),
    fileName,
    fileType: 'docx',
    importedAt: Date.now(),
    questionCount: 0,
    parseSuccessCount: 0,
    parseFailedCount: 0,
  }

  const normalizedLines = normalizeDocxText(text).split('\n').map((line) => line.trim()).filter(Boolean)
  const convertedBlocks: string[] = []
  const failedBlocks: string[] = []

  for (const line of normalizedLines) {
    const match = line.match(/^(\d+)[.、]\s*(.+?)(正确|错误)$/)
    if (!match) {
      failedBlocks.push(line)
      continue
    }

    convertedBlocks.push(`${match[1]}. ${match[2].trim()}\n答案: ${match[3]}\n解析: 判断题专项汇总。`)
  }

  const report = parseTxtQuestions(fileName, convertedBlocks.join('\n\n'))
  report.source.id = source.id
  report.source.fileType = 'docx'
  report.source.questionCount = normalizedLines.length
  report.source.parseFailedCount = failedBlocks.length
  report.failedBlocks.push(...failedBlocks)
  report.issues = [
    ...(report.issues ?? []),
    ...failedBlocks.map((block) => ({ type: 'parse-failed' as const, message: '判断题行尾未识别到正确/错误答案', block })),
  ]
  return report
}

function parseKnowledgeItems(fileName: string, text: string): ImportReport {
  const now = Date.now()
  const source: Source = {
    id: createId('src'),
    fileName,
    fileType: 'docx',
    importedAt: now,
    questionCount: 0,
    parseSuccessCount: 0,
    parseFailedCount: 0,
  }
  const sections = normalizeDocxText(text)
    .split(/\n(?=[^\n：:]{2,40}[：:])/)
    .map((section) => section.trim())
    .filter(Boolean)

  const knowledgeItems: KnowledgeItem[] = sections.map((section) => {
    const [firstLine, ...rest] = section.split('\n')
    const title = firstLine.replace(/[：:]\s*$/, '').trim()
    const content = rest.length > 0 ? rest.join('\n').trim() : section
    return {
      id: `knowledge_${createHash(`${fileName}${title}${content}`)}`,
      title: title || fileName.replace(/\.[^.]+$/, ''),
      content,
      tags: [fileName.replace(/\.[^.]+$/, ''), '关键概念'],
      relatedQuestionIds: [],
    }
  })

  source.questionCount = knowledgeItems.length
  source.parseSuccessCount = knowledgeItems.length

  return {
    source,
    questions: [],
    failedBlocks: [],
    duplicateCount: 0,
    knowledgeItems,
    issues: [],
  }
}

export async function parseDocxQuestions(fileName: string, file: File): Promise<ImportReport> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = normalizeDocxText(result.value)

  if (fileName.includes('关键概念')) {
    return parseKnowledgeItems(fileName, text)
  }

  if (fileName.includes('判断汇总')) {
    return parseJudgeSummary(fileName, text)
  }

  const report = parseTxtQuestions(fileName, text)
  report.source.fileType = 'docx'
  return report
}
