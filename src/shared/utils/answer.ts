import type { QuestionType } from '../../types/question'

export function normalizeAnswer(raw: string, type?: QuestionType) {
  const value = raw.trim().replace(/[\s,，、]+/g, '').toUpperCase()

  if (['正确', '对', 'TRUE', 'T', '√', '✓'].includes(value)) {
    return ['true']
  }

  if (['错误', '错', 'FALSE', 'F', '×', '✕', 'X'].includes(value)) {
    return ['false']
  }

  if (type === 'judge') {
    return value.includes('正确') || value.includes('对') ? ['true'] : ['false']
  }

  return Array.from(new Set(value.match(/[A-F]/g) ?? []))
}

export function detectQuestionType(answer: string[]): QuestionType {
  if (answer[0] === 'true' || answer[0] === 'false') {
    return 'judge'
  }

  return answer.length > 1 ? 'multiple' : 'single'
}

export function isSameAnswer(a: string[], b: string[]) {
  return [...a].sort().join('|') === [...b].sort().join('|')
}

export function formatAnswer(answer: string[]) {
  if (answer[0] === 'true') return '正确'
  if (answer[0] === 'false') return '错误'
  return answer.join('')
}
