import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Database,
  FileUp,
  Heart,
  Home,
  Lightbulb,
  ListChecks,
  Menu,
  Pencil,
  Search,
  Timer,
  X,
  XCircle,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { clearAllData, db, importQuestions } from './db/dexie'
import { parseDocxQuestions } from './features/import/parseDocxQuestions'
import { parseTxtQuestions } from './features/import/parseTxtQuestions'
import { createBackup, downloadBackup, restoreBackup, validateBackup } from './features/settings/backupService'
import { buildLocalAiReport, recommendKnowledgePoints, recommendMistakeReason } from './services/localAiService'
import { saveAnswer } from './services/answerService'
import { filterQuestions, type PracticeFilter } from './services/questionFilterService'
import { buildExamTypeStats, buildKnowledgeSummary, buildSevenDayStats, buildStats, buildStudySuggestions, buildTopMistakes } from './services/statsService'
import type { AppData } from './types/app'
import type { ExamPaper, Favorite, ImportIssueType, ImportReport, KnowledgeItem, Mistake, Question, QuestionType } from './types/question'
import { createHash, createId } from './shared/utils/textNormalize'
import { formatAnswer, isSameAnswer, normalizeAnswer } from './shared/utils/answer'

type Page = 'dashboard' | 'import' | 'bank' | 'practice' | 'knowledge' | 'mistakes' | 'exam' | 'stats'

const navItems = [
  { key: 'dashboard', label: '首页', icon: Home },
  { key: 'import', label: '导入', icon: FileUp },
  { key: 'bank', label: '题库', icon: Database },
  { key: 'practice', label: '刷题', icon: BookOpen },
  { key: 'knowledge', label: '知识点', icon: Lightbulb },
  { key: 'mistakes', label: '错题', icon: Heart },
  { key: 'exam', label: '考试', icon: ClipboardList },
  { key: 'stats', label: '统计', icon: BarChart3 },
] satisfies Array<{ key: Page; label: string; icon: typeof Home }>

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [data, setData] = useState<AppData>({ questions: [], records: [], mistakes: [], favorites: [], exams: [], knowledgeItems: [] })

  const refresh = async () => {
    const [questions, records, mistakes, favorites, exams, knowledgeItems] = await Promise.all([
      db.questions.toArray(),
      db.answerRecords.toArray(),
      db.mistakes.toArray(),
      db.favorites.toArray(),
      db.examPapers.toArray(),
      db.knowledgeItems.toArray(),
    ])
    setData({ questions, records, mistakes, favorites, exams, knowledgeItems })
  }

  useEffect(() => {
    void refresh()
  }, [])

  const stats = useMemo(() => buildStats(data), [data])

  const CurrentPage = {
    dashboard: <Dashboard data={data} stats={stats} onNavigate={setPage} />,
    import: <ImportPage onImported={refresh} />,
    bank: <QuestionBank questions={data.questions} favorites={data.favorites} onChanged={refresh} />,
    practice: <PracticePage data={data} onChanged={refresh} />,
    knowledge: <KnowledgePage knowledgeItems={data.knowledgeItems} questions={data.questions} onChanged={refresh} />,
    mistakes: <MistakesPage data={data} onChanged={refresh} />,
    exam: <ExamPage data={data} onChanged={refresh} />,
    stats: <StatsPage data={data} stats={stats} />,
  }[page]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed left-4 top-4 bottom-4 z-30 hidden w-64 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-slate-200/70 backdrop-blur lg:block">
        <Brand />
        <nav className="mt-8 space-y-2" aria-label="主导航">
          {navItems.map((item) => (
            <NavButton key={item.key} item={item} active={page === item.key} onClick={() => setPage(item.key)} />
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand compact />
          <button
            type="button"
            className="rounded-xl border border-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="打开导航"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 p-4 lg:hidden" role="dialog" aria-modal="true">
          <div className="rounded-3xl bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <Brand compact />
              <button
                type="button"
                className="rounded-xl border border-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-100"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="关闭导航"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-2" aria-label="移动导航">
              {navItems.map((item) => (
                <NavButton
                  key={item.key}
                  item={item}
                  active={page === item.key}
                  onClick={() => {
                    setPage(item.key)
                    setMobileMenuOpen(false)
                  }}
                />
              ))}
            </nav>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 lg:ml-72 lg:px-8 lg:pb-8">
        {CurrentPage}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur lg:hidden" aria-label="底部导航">
        {navItems.filter((item) => ['dashboard', 'practice', 'knowledge', 'mistakes', 'exam'].includes(item.key)).map((item) => (
          <button
            key={item.key}
            type="button"
            className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs transition-colors ${page === item.key ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
            onClick={() => setPage(item.key)}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
        <ListChecks className="h-6 w-6" aria-hidden="true" />
      </div>
      {!compact && (
        <div>
          <p className="text-sm font-semibold text-slate-900">AI 训练师题库</p>
          <p className="text-xs text-slate-500">本地优先复习系统</p>
        </div>
      )}
      {compact && <p className="text-sm font-semibold text-slate-900">AI 训练师题库</p>}
    </div>
  )
}

function NavButton({ item, active, onClick }: { item: (typeof navItems)[number]; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
      onClick={onClick}
    >
      <item.icon className="h-5 w-5" aria-hidden="true" />
      {item.label}
    </button>
  )
}

function Dashboard({ data, stats, onNavigate }: { data: AppData; stats: ReturnType<typeof buildStats>; onNavigate: (page: Page) => void }) {
  const aiReport = useMemo(() => buildLocalAiReport(data), [data])

  return (
    <section className="space-y-6">
      <HeroCard data={data} stats={stats} onNavigate={onNavigate} />
      <StatGrid stats={stats} />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="智能复习计划" subtitle="基于本地答题、错题和模考记录生成">
          <div className="space-y-3">
            {aiReport.plan.map((item, index) => (
              <button key={item.title} type="button" className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50" onClick={() => onNavigate(item.target)}>
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700">{index + 1}</span>
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.description}</p>
                  </div>
                </div>
              </button>
            ))}
            {aiReport.plan.length === 0 && <EmptyState title="智能计划待生成" description="先导入题库并完成一轮刷题，系统会自动给出本地智能建议。" />}
          </div>
        </Panel>
        <Panel title="智能提醒" subtitle="识别当前最该处理的学习问题">
          <div className="space-y-3 text-sm text-slate-700">
            {aiReport.reminders.length === 0 ? <EmptyState title="暂无提醒" description="当前学习节奏稳定，继续保持即可。" /> : aiReport.reminders.map((item) => <p key={item} className="rounded-2xl bg-slate-50 p-3">{item}</p>)}
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel title="复习路线" subtitle="按导入、刷题、错题、考试形成闭环">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['1', '导入题库', '先导入两个 txt 核心题库', 'import'],
              ['2', '日常刷题', '顺序、随机、题型专项练习', 'practice'],
              ['3', 'AI专项', '按薄弱题型、知识点和错因组合练习', 'practice'],
              ['4', '错题巩固', '反复错题集中重练', 'mistakes'],
              ['5', '模拟考试', '按题型比例随机组卷', 'exam'],
            ].map(([step, title, desc, target]) => (
              <button
                key={step}
                type="button"
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
                onClick={() => onNavigate(target as Page)}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700">{step}</span>
                <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{desc}</p>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="题库状态" subtitle="当前本地 IndexedDB 数据">
          <div className="space-y-3 text-sm text-slate-600">
            <StatusRow label="总题数" value={`${data.questions.length} 题`} />
            <StatusRow label="错题数" value={`${data.mistakes.length} 题`} />
            <StatusRow label="收藏数" value={`${data.favorites.length} 题`} />
            <StatusRow label="考试记录" value={`${data.exams.length} 次`} />
          </div>
        </Panel>
      </div>
    </section>
  )
}

function HeroCard({ data, stats, onNavigate }: { data: AppData; stats: ReturnType<typeof buildStats>; onNavigate: (page: Page) => void }) {
  const suggestions = buildStudySuggestions(data, stats)

  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-600/20 md:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-center">
        <div>
          <p className="text-sm font-medium text-blue-100">人工智能训练师理论考试</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">把本地题库变成可多端复习的模拟考试系统</h1>
          <p className="mt-4 max-w-2xl text-blue-50">支持 txt 题库导入、刷题、错题本、模拟考试和学习统计。数据默认保存在本地浏览器，适合 PC、手机和平板复习。</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50" onClick={() => onNavigate('import')}>导入题库</button>
            <button type="button" className="rounded-2xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10" onClick={() => onNavigate('practice')}>开始刷题</button>
          </div>
        </div>
        <div className="rounded-3xl border border-white/20 bg-white/15 p-4 backdrop-blur">
          <div className="rounded-2xl bg-white p-4 text-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">今日建议</span>
              <Timer className="h-5 w-5 text-blue-600" />
            </div>
            <div className="mt-4 space-y-3">
              {suggestions.map((suggestion) => (
                <ProgressItem key={suggestion.label} label={suggestion.label} value={suggestion.value} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImportPage({ onImported }: { onImported: () => Promise<void> }) {
  const [report, setReport] = useState<ImportReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [duplicateStrategy, setDuplicateStrategy] = useState<'keep' | 'skip'>('keep')

  const handleFile = async (file: File) => {
    setBusy(true)
    setMessage('')
    try {
      const parsed = file.name.toLowerCase().endsWith('.docx')
        ? await parseDocxQuestions(file.name, file)
        : parseTxtQuestions(file.name, await file.text())
      setReport(parsed)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!report) return
    const questions = duplicateStrategy === 'skip'
      ? report.questions.filter((question) => !question.tags.includes('疑似重复'))
      : report.questions
    await importQuestions(report.source, questions, report.knowledgeItems ?? [])
    await onImported()
    setMessage(`已导入 ${questions.length} 道题、${report.knowledgeItems?.length ?? 0} 个知识点`)
  }

  return (
    <PageHeader title="题库导入" subtitle="优先导入 txt 核心题库，系统会自动识别题干、选项、答案和解析。" icon={FileUp}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel title="上传题库" subtitle="支持 txt 题库、docx 题库和关键概念资料">
          <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
            <FileUp className="h-10 w-10 text-blue-600" />
            <span className="mt-4 text-base font-semibold text-slate-900">选择 txt 或 docx 文件</span>
            <span className="mt-2 text-sm text-slate-600">推荐：两个 txt 核心题库，或判断汇总、关键概念等 docx 资料</span>
            <input className="sr-only" type="file" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => event.target.files?.[0] && void handleFile(event.target.files[0])} />
          </label>
          {busy && <p className="mt-4 text-sm text-slate-600">正在解析题库...</p>}
          {message && <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        </Panel>

        <div className="space-y-4">
          <Panel title="导入预览" subtitle="保存前可检查解析结果、失败题块和重复题处理策略">
            {!report ? (
              <EmptyState title="尚未选择文件" description="上传 txt 或 docx 文件后会显示解析统计。" />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MiniStat label="识别题块" value={report.source.questionCount} />
                  <MiniStat label="成功解析" value={report.source.parseSuccessCount} />
                  <MiniStat label="异常题块" value={report.source.parseFailedCount} />
                  <MiniStat label="重复题" value={report.duplicateCount} />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">建议导入</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{duplicateStrategy === 'skip' ? report.questions.filter((question) => !question.tags.includes('疑似重复')).length : report.questions.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">知识点条目</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{report.knowledgeItems?.length ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">校验问题</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{report.issues?.length ?? 0}</p>
                  </div>
                </div>
                {report.duplicateCount > 0 && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">重复题处理策略</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button type="button" className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${duplicateStrategy === 'keep' ? 'border-blue-300 bg-white text-blue-700' : 'border-blue-100 bg-blue-50 text-slate-600 hover:bg-white'}`} onClick={() => setDuplicateStrategy('keep')}>
                        保留全部重复题
                      </button>
                      <button type="button" className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${duplicateStrategy === 'skip' ? 'border-blue-300 bg-white text-blue-700' : 'border-blue-100 bg-blue-50 text-slate-600 hover:bg-white'}`} onClick={() => setDuplicateStrategy('skip')}>
                        跳过标记为疑似重复的题目
                      </button>
                    </div>
                  </div>
                )}
                <div className="max-h-96 space-y-3 overflow-auto pr-1">
                  {report.issues && report.issues.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">导入校验报告</p>
                      <div className="mt-3 space-y-2">
                        {report.issues.slice(0, 20).map((issue, issueIndex) => (
                          <div key={`${issue.type}-${issueIndex}`} className="rounded-xl bg-white/70 p-3 text-xs text-amber-800">
                            <p className="font-semibold">#{issueIndex + 1} · {importIssueTypeText(issue.type)}{issue.questionNumber ? `（原第 ${issue.questionNumber} 题）` : ''}</p>
                            <p className="mt-1">{issue.message}</p>
                            {issue.questionId && <p className="mt-1 text-amber-700">题目 ID：{issue.questionId}</p>}
                            {issue.block && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-amber-100/70 p-2 text-amber-900">{issue.block}</pre>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {report.questions.slice(0, 8).map((question) => (
                    <QuestionPreview key={question.id} question={question} />
                  ))}
                  {report.knowledgeItems?.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                      <p className="text-sm font-semibold text-cyan-900">知识点：{item.title}</p>
                      <p className="mt-2 line-clamp-2 text-xs text-cyan-700">{item.content}</p>
                    </div>
                  ))}
                </div>
                <button type="button" className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700" onClick={save}>保存到本地题库</button>
              </div>
            )}
          </Panel>
          <DataManagementPanel onChanged={onImported} />
        </div>
      </div>
    </PageHeader>
  )
}

function importIssueTypeText(type: ImportIssueType) {
  if (type === 'parse-failed') return '解析失败'
  if (type === 'missing-stem') return '缺少题干'
  if (type === 'missing-answer') return '缺少答案'
  if (type === 'missing-options') return '缺少选项'
  if (type === 'invalid-answer') return '答案异常'
  if (type === 'duplicate') return '疑似重复'
  return '校验问题'
}

function DataManagementPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const [message, setMessage] = useState('')

  const exportData = async () => {
    const backup = await createBackup()
    downloadBackup(backup)
    setMessage('已导出 JSON 备份')
  }

  const importBackupFile = async (file: File) => {
    try {
      const backup = validateBackup(JSON.parse(await file.text()))
      const confirmed = window.confirm(`将覆盖恢复：${backup.questions.length} 道题、${backup.answerRecords.length} 条答题记录、${backup.examPapers.length} 次考试记录。是否继续？`)
      if (!confirmed) return
      await restoreBackup(backup)
      await onChanged()
      setMessage('已恢复备份数据')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '备份恢复失败')
    }
  }

  const clearData = async () => {
    const confirmed = window.confirm('将清空本地题库、答题记录、错题、收藏和考试记录。建议先导出备份。是否继续？')
    if (!confirmed) return
    await clearAllData()
    await onChanged()
    setMessage('已清空本地数据')
  }

  return (
    <Panel title="数据管理" subtitle="本系统数据保存在本地浏览器，可通过 JSON 备份在多设备之间迁移">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {[
          ['1', '导出备份', '在当前设备下载完整 JSON 数据包'],
          ['2', '传到新设备', '用微信、网盘、U 盘或局域网发送文件'],
          ['3', '恢复备份', '在新设备导入 JSON，覆盖为同一份数据'],
        ].map(([step, title, description]) => (
          <div key={step} className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white">{step}</span>
            <p className="mt-3 font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100" onClick={exportData}>导出 JSON 备份</button>
        <label className="cursor-pointer rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
          恢复 JSON 备份
          <input className="sr-only" type="file" accept=".json,application/json" onChange={(event) => event.target.files?.[0] && void importBackupFile(event.target.files[0])} />
        </label>
        <button type="button" className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50" onClick={clearData}>清空本地数据</button>
      </div>
      <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-800">当前版本不连接云账号。换浏览器、换电脑或清理缓存前，请先导出 JSON 备份。</p>
      {message && <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}
    </Panel>
  )
}

function QuestionBank({ questions, favorites, onChanged }: { questions: Question[]; favorites: Favorite[]; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | QuestionType>('all')
  const favoriteSet = useMemo(() => new Set(favorites.map((item) => item.questionId)), [favorites])
  const filtered = questions.filter((question) => {
    const matchesQuery = `${question.stem}${question.explanation ?? ''}`.includes(query)
    const matchesType = type === 'all' || question.type === type
    return matchesQuery && matchesType
  })

  return (
    <PageHeader title="题库管理" subtitle="搜索题干、筛选题型、查看答案和解析。" icon={Database}>
      <Panel title="题目列表" subtitle={`共 ${filtered.length} 道题`}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900" placeholder="搜索题干或解析" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={type} onChange={(event) => setType(event.target.value as 'all' | QuestionType)}>
            <option value="all">全部题型</option>
            <option value="single">单选</option>
            <option value="multiple">多选</option>
            <option value="judge">判断</option>
          </select>
        </div>
        <QuestionList questions={filtered} favoriteSet={favoriteSet} onChanged={onChanged} />
      </Panel>
    </PageHeader>
  )
}

function KnowledgePage({ knowledgeItems, questions, onChanged }: { knowledgeItems: KnowledgeItem[]; questions: Question[]; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [reviewStates, setReviewStates] = useState<Record<string, string>>(() => JSON.parse(window.localStorage.getItem('ai-trainer-knowledge-review') ?? '{}') as Record<string, string>)
  const [relationQuery, setRelationQuery] = useState('')
  const filteredItems = knowledgeItems.filter((item) => `${item.title}${item.content}${item.tags.join('')}`.includes(query))
  const current = filteredItems[Math.min(index, Math.max(filteredItems.length - 1, 0))]
  const relatedQuestions = current ? buildRelatedQuestions(current, questions) : []
  const relationCandidates = current
    ? questions.filter((question) => `${question.originalNumber ?? ''}${question.stem}${question.options.map((option) => option.text).join('')}${question.explanation ?? ''}`.includes(relationQuery)).slice(0, 30)
    : []

  useEffect(() => {
    setIndex(0)
  }, [query])

  useEffect(() => {
    setRelationQuery('')
  }, [current?.id])

  const mark = (status: '不熟悉' | '有印象' | '已掌握') => {
    if (!current) return
    const next = { ...reviewStates, [current.id]: status }
    setReviewStates(next)
    window.localStorage.setItem('ai-trainer-knowledge-review', JSON.stringify(next))
  }

  const toggleRelatedQuestion = async (question: Question) => {
    if (!current) return

    const linked = current.relatedQuestionIds.includes(question.id)
    const nextKnowledgeItem: KnowledgeItem = {
      ...current,
      relatedQuestionIds: linked
        ? current.relatedQuestionIds.filter((questionId) => questionId !== question.id)
        : [...current.relatedQuestionIds, question.id],
    }
    const nextQuestion: Question = {
      ...question,
      knowledgePoints: linked
        ? question.knowledgePoints.filter((point) => point !== current.title)
        : Array.from(new Set([...question.knowledgePoints, current.title])),
      updatedAt: Date.now(),
    }

    await db.transaction('rw', db.knowledgeItems, db.questions, async () => {
      await db.knowledgeItems.put(nextKnowledgeItem)
      await db.questions.put(nextQuestion)
    })
    await onChanged()
  }

  return (
    <PageHeader title="知识点复习" subtitle="用卡片复习关键概念，标记掌握状态，并查看相关题目。" icon={Lightbulb}>
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Panel title="知识点列表" subtitle={`共 ${filteredItems.length} 个知识点`}>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900" placeholder="搜索概念、标签或内容" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          {knowledgeItems.length === 0 ? <EmptyState title="暂无知识点" description="请在导入页导入关键概念.docx。" /> : (
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {filteredItems.map((item, itemIndex) => (
                <button key={item.id} type="button" className={`w-full rounded-2xl border p-3 text-left transition-colors ${itemIndex === index ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`} onClick={() => setIndex(itemIndex)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    {reviewStates[item.id] && <span className="shrink-0 rounded-xl bg-slate-100 px-2 py-1 text-xs text-slate-600">{reviewStates[item.id]}</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.content}</p>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={current ? current.title : '知识点卡片'} subtitle={current ? `状态：${reviewStates[current.id] ?? '未复习'}` : '选择一个知识点开始复习'}>
          {!current ? <EmptyState title="没有匹配知识点" description="请调整搜索条件或先导入知识点资料。" /> : (
            <div className="space-y-5">
              <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-cyan-50 p-5">
                <p className="text-sm font-semibold text-blue-700">主动回忆</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">请用自己的话解释：{current.title}</h2>
                <details className="mt-4 rounded-2xl bg-white p-4">
                  <summary className="cursor-pointer font-semibold text-slate-800">查看标准解释</summary>
                  <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-700">{current.content}</p>
                </details>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(['不熟悉', '有印象', '已掌握'] as const).map((status) => (
                  <button key={status} type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100" onClick={() => mark(status)}>{status}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" disabled={index === 0} onClick={() => setIndex((currentIndex) => Math.max(0, currentIndex - 1))}>上一条</button>
                <button type="button" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={index >= filteredItems.length - 1} onClick={() => setIndex((currentIndex) => Math.min(filteredItems.length - 1, currentIndex + 1))}>下一条</button>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">关联题目</p>
                {relatedQuestions.length === 0 ? <p className="mt-2 text-sm text-slate-500">暂未关联题目，可在下方搜索并勾选。</p> : (
                  <div className="mt-3 space-y-2">
                    {relatedQuestions.map((question) => <p key={question.id} className="rounded-xl bg-white p-3 text-sm text-slate-700">{question.originalNumber}. {question.stem}</p>)}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">手动关联</p>
                    <p className="mt-1 text-sm text-slate-500">搜索题干或题号，勾选后会同步写入知识点和题目。</p>
                  </div>
                  <input className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 md:w-72" placeholder="搜索题目" value={relationQuery} onChange={(event) => setRelationQuery(event.target.value)} />
                </div>
                {questions.length === 0 ? <p className="mt-3 text-sm text-slate-500">暂无题目，请先导入题库。</p> : (
                  <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {relationCandidates.map((question) => {
                      const linked = current.relatedQuestionIds.includes(question.id) || question.knowledgePoints.includes(current.title)
                      return (
                        <label key={question.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${linked ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                          <input className="mt-1 h-4 w-4 accent-blue-600" type="checkbox" checked={linked} onChange={() => void toggleRelatedQuestion(question)} />
                          <span className="text-sm leading-relaxed text-slate-700"><span className="font-semibold text-slate-900">{question.originalNumber}.</span> {question.stem}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </PageHeader>
  )
}

function buildRelatedQuestions(item: KnowledgeItem, questions: Question[]) {
  const relatedIds = new Set(item.relatedQuestionIds)
  return questions
    .filter((question) => relatedIds.has(question.id) || question.knowledgePoints.some((point) => item.title.includes(point) || item.content.includes(point)) || `${question.stem}${question.explanation ?? ''}`.includes(item.title))
    .slice(0, 10)
}

function PracticePage({ data, onChanged }: { data: AppData; onChanged: () => Promise<void> }) {
  return <QuestionRunner title="刷题练习" subtitle="支持全部、题型、错题、收藏和未做题练习。" data={data} onChanged={onChanged} defaultFilter="all" />
}

const mistakeReasonOptions = ['概念不清', '审题失误', '记忆混淆', '多选漏选', '知识盲区', '粗心错选']

function MistakesPage({ data, onChanged }: { data: AppData; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [activeReason, setActiveReason] = useState<string>('全部')
  const aiReport = useMemo(() => buildLocalAiReport(data), [data])
  const questionById = useMemo(() => new Map(data.questions.map((question) => [question.id, question])), [data.questions])
  const mistakes = data.mistakes
    .filter((mistake) => !mistake.mastered)
    .map((mistake) => ({ mistake, question: questionById.get(mistake.questionId) }))
    .filter((item): item is { mistake: Mistake; question: Question } => Boolean(item.question))
    .filter(({ mistake, question }) => `${question.stem}${question.explanation ?? ''}${mistake.reasonTags?.join('') ?? ''}`.includes(query))
    .filter(({ mistake }) => activeReason === '全部' || (mistake.reasonTags ?? []).includes(activeReason))
    .sort((a, b) => b.mistake.wrongCount - a.mistake.wrongCount)

  const updateReasonTags = async (mistake: Mistake, tags: string[]) => {
    await db.mistakes.put({ ...mistake, reasonTags: tags })
    await onChanged()
  }

  return (
    <PageHeader title="错题本" subtitle="优先复习未掌握错题，给错题标记原因后更容易专项复盘。" icon={Heart}>
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Panel title="错题复盘" subtitle={`未掌握 ${mistakes.length} 题`}>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900" placeholder="搜索题干、解析或错因" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button type="button" className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${activeReason === '全部' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`} onClick={() => setActiveReason('全部')}>全部</button>
            {aiReport.reasonSummary.map((item) => (
              <button key={item.tag} type="button" className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${activeReason === item.tag ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`} onClick={() => setActiveReason(item.tag)}>
                {item.tag} · {item.count}
              </button>
            ))}
          </div>
          {mistakes.length === 0 ? <EmptyState title="暂无未掌握错题" description="答错后会自动进入错题本，连续答对 3 次后标记为掌握。" /> : (
            <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
              {mistakes.map(({ mistake, question }) => (
                <div key={mistake.questionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-relaxed text-slate-900">{question.originalNumber}. {question.stem}</p>
                    <span className="shrink-0 rounded-xl bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">错 {mistake.wrongCount} 次</span>
                  </div>
                  <MistakeReasonTags mistake={mistake} recommendedTags={recommendMistakeReason(question, mistake)} onChange={(tags) => void updateReasonTags(mistake, tags)} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <QuestionRunner title="错题重练" subtitle="按错题范围继续刷题，连续答对 3 次后自动标记掌握。" data={data} onChanged={onChanged} defaultFilter="mistakes" embedded />
      </div>
    </PageHeader>
  )
}

function MistakeReasonTags({ mistake, recommendedTags, onChange }: { mistake: Mistake; recommendedTags?: string[]; onChange: (tags: string[]) => void }) {
  const activeTags = mistake.reasonTags ?? []
  const toggle = (tag: string) => {
    onChange(activeTags.includes(tag) ? activeTags.filter((item) => item !== tag) : [...activeTags, tag])
  }

  return (
    <div className="mt-3 space-y-3">
      {recommendedTags && recommendedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-2xl bg-blue-50 p-3">
          <span className="px-1 py-2 text-xs font-semibold text-blue-700">推荐错因</span>
          {recommendedTags.map((tag) => (
            <button key={tag} type="button" className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100" onClick={() => toggle(tag)}>
              {tag}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {mistakeReasonOptions.map((tag) => (
          <button key={tag} type="button" className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${activeTags.includes(tag) ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`} onClick={() => toggle(tag)}>
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}

function QuestionRunner({ title, subtitle, data, onChanged, defaultFilter, embedded = false }: { title: string; subtitle: string; data: AppData; onChanged: () => Promise<void>; defaultFilter: PracticeFilter; embedded?: boolean }) {
  const [filter, setFilter] = useState<PracticeFilter>(defaultFilter)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())

  const questions = useMemo(() => filterQuestions(data, filter), [data, filter])
  const progressKey = `ai-trainer-practice-progress:${filter}`
  const question = questions[index]
  const isCorrect = question ? isSameAnswer(selected, question.answer) : false

  useEffect(() => {
    const savedIndex = Number(window.localStorage.getItem(progressKey) ?? '0')
    setIndex(Math.min(Math.max(savedIndex, 0), Math.max(questions.length - 1, 0)))
    setSelected([])
    setSubmitted(false)
    setStartedAt(Date.now())
  }, [filter, progressKey, questions.length])

  const submit = async () => {
    if (!question || selected.length === 0) return
    const correct = isSameAnswer(selected, question.answer)
    await saveAnswer(question, selected, correct, Date.now() - startedAt, filter === 'mistakes' ? 'mistake' : filter === 'favorites' ? 'favorite' : 'practice')
    setSubmitted(true)
    await onChanged()
  }

  const next = () => {
    setSelected([])
    setSubmitted(false)
    setStartedAt(Date.now())
    setIndex((current) => {
      const nextIndex = Math.min(current + 1, Math.max(questions.length - 1, 0))
      window.localStorage.setItem(progressKey, String(nextIndex))
      return nextIndex
    })
  }

  const resetProgress = () => {
    window.localStorage.removeItem(progressKey)
    setIndex(0)
    setSelected([])
    setSubmitted(false)
    setStartedAt(Date.now())
  }

  if (embedded) {
    return (
      <Panel title={`错题重练：${questions.length} 道`} subtitle={question ? `第 ${index + 1} / ${questions.length} 题` : '暂无可练习题目'}>
        <div className="mb-4 flex justify-end">
          <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100" onClick={resetProgress}>从第一题重刷</button>
        </div>
        {!question ? <EmptyState title="没有可练习的题目" description="请先导入题库，或完成新的错题记录。" /> : (
          <QuestionCard
            question={question}
            selected={selected}
            submitted={submitted}
            isCorrect={isCorrect}
            onSelect={setSelected}
            onSubmit={submit}
            onNext={next}
            onChanged={onChanged}
          />
        )}
      </Panel>
    )
  }

  return (
    <PageHeader title={title} subtitle={subtitle} icon={BookOpen}>
      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Panel title="练习设置" subtitle="选择题目范围">
          <div className="space-y-2">
            {[
              ['all', '全部题目'],
              ['single', '单选专项'],
              ['multiple', '多选专项'],
              ['judge', '判断专项'],
              ['ai', 'AI专项'],
              ['mistakes', '错题重练'],
              ['favorites', '收藏题'],
              ['unseen', '未做题'],
            ].map(([value, label]) => (
              <button key={value} type="button" className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors ${filter === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`} onClick={() => setFilter(value as PracticeFilter)}>{label}</button>
            ))}
            <button type="button" className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100" onClick={resetProgress}>从本模式第一题重刷</button>
          </div>
        </Panel>

        <Panel title={`当前练习：${questions.length} 道`} subtitle={question ? `第 ${index + 1} / ${questions.length} 题` : '暂无可练习题目'}>
          {!question ? <EmptyState title="没有可练习的题目" description="请先导入题库，或切换练习范围。" /> : (
            <QuestionCard
              question={question}
              selected={selected}
              submitted={submitted}
              isCorrect={isCorrect}
              onSelect={setSelected}
              onSubmit={submit}
              onNext={next}
              onChanged={onChanged}
            />
          )}
        </Panel>
      </div>
    </PageHeader>
  )
}

function ExamPage({ data, onChanged }: { data: AppData; onChanged: () => Promise<void> }) {
  const [paper, setPaper] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [result, setResult] = useState<ExamPaper | null>(null)
  const [examStartedAt, setExamStartedAt] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(90 * 60)
  const [currentExamIndex, setCurrentExamIndex] = useState(0)
  const [questionNavOpen, setQuestionNavOpen] = useState(false)

  const examStructure = [
    { type: 'single' as const, label: '单选', count: 70 },
    { type: 'multiple' as const, label: '多选', count: 20 },
    { type: 'judge' as const, label: '判断', count: 10 },
  ]
  const questionCounts = examStructure.map((item) => ({
    ...item,
    available: data.questions.filter((question) => question.type === item.type).length,
  }))
  const canStart = questionCounts.every((item) => item.available >= item.count)
  const answeredCount = Object.values(answers).filter((answer) => answer.length > 0).length
  const unansweredCount = paper ? paper.length - answeredCount : 0
  const examTypeStats = paper ? buildExamTypeStats(paper, answers) : []

  useEffect(() => {
    if (!paper || result) return
    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer)
          void submitExam(true)
          return 0
        }
        return seconds - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [paper, result])

  const startExam = () => {
    if (!canStart) return
    const nextPaper = examStructure.flatMap((item) => {
      const questions = data.questions.filter((question) => question.type === item.type)
      return [...questions].sort(() => Math.random() - 0.5).slice(0, item.count)
    })
    setPaper(nextPaper)
    setAnswers({})
    setResult(null)
    setExamStartedAt(Date.now())
    setRemainingSeconds(90 * 60)
    setCurrentExamIndex(0)
    setQuestionNavOpen(false)
  }

  const submitExam = async (skipConfirm = false) => {
    if (!paper) return
    if (!skipConfirm && unansweredCount > 0) {
      const confirmed = window.confirm(`还有 ${unansweredCount} 道题未作答，是否确认交卷？`)
      if (!confirmed) return
    }
    let score = 0
    for (const question of paper) {
      const selected = answers[question.id] ?? []
      const correct = isSameAnswer(selected, question.answer)
      if (correct) score += 1
      await saveAnswer(question, selected, correct, 0, 'exam')
    }
    const exam: ExamPaper = {
      id: createId('exam'),
      questionIds: paper.map((question) => question.id),
      selectedAnswers: answers,
      score,
      total: 100,
      duration: examStartedAt ? Date.now() - examStartedAt : 0,
      createdAt: Date.now(),
    }
    await db.examPapers.put(exam)
    setResult(exam)
    await onChanged()
  }

  return (
    <PageHeader title="模拟考试" subtitle="固定试卷结构：单选 70 题、多选 20 题、判断 10 题，共 100 分。" icon={ClipboardList}>
      {!paper ? (
        <Panel title="考试设置" subtitle="系统会按真实试卷结构随机组卷，每题 1 分。">
          <div className="max-w-2xl space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {questionCounts.map((item) => (
                <div key={item.type} className={`rounded-2xl border p-4 ${item.available >= item.count ? 'border-slate-200 bg-slate-50' : 'border-rose-200 bg-rose-50'}`}>
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{item.count} 题</p>
                  <p className={`mt-1 text-xs ${item.available >= item.count ? 'text-slate-500' : 'text-rose-700'}`}>题库已有 {item.available} 题</p>
                </div>
              ))}
            </div>
            {!canStart && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">当前题库题型数量不足，需至少包含单选 70、多选 20、判断 10 后才能开始标准模拟考试。</p>}
            <button type="button" className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300" onClick={startExam} disabled={!canStart}>开始标准模拟考试</button>
          </div>
        </Panel>
      ) : (
        <Panel title="考试答题" subtitle={result ? `得分 ${result.score} / 100，用时 ${formatDuration(result.duration)}` : `剩余 ${formatDuration(remainingSeconds * 1000)}，已答 ${answeredCount} / 100`}>
          <div className="space-y-4">
            <div className="relative rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" onMouseEnter={() => setQuestionNavOpen(true)} onMouseLeave={() => setQuestionNavOpen(false)}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="shrink-0 text-sm text-slate-600">第 <span className="font-semibold text-slate-900">{currentExamIndex + 1}</span> / 100 题 · 未答题：<span className="font-semibold text-slate-900">{unansweredCount}</span> 道</div>
                <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100" onClick={() => setQuestionNavOpen((open) => !open)}>{questionNavOpen ? '收起题号' : '选择题号'}</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-100 ring-1 ring-blue-200" />单选</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-violet-100 ring-1 ring-violet-200" />多选</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-200" />判断</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-900" />已答</span>
              </div>
              {questionNavOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%-1px)] z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl" onMouseEnter={() => setQuestionNavOpen(true)}>
                  <div className="grid max-h-64 grid-cols-10 gap-1 overflow-y-auto pr-1 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-20">
                    {paper.map((question, questionIndex) => {
                      const answered = (answers[question.id] ?? []).length > 0
                      return (
                        <button key={question.id} type="button" className={`flex h-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${questionTypeNavClass(question.type, answered)} ${questionIndex === currentExamIndex ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`} title={`${typeText(question.type)} 第 ${questionIndex + 1} 题`} onClick={() => { setCurrentExamIndex(questionIndex); setQuestionNavOpen(false) }}>
                          {questionIndex + 1}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {paper[currentExamIndex] && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <QuestionStem question={paper[currentExamIndex]} index={currentExamIndex + 1} />
                <OptionSelector question={paper[currentExamIndex]} selected={answers[paper[currentExamIndex].id] ?? []} disabled={Boolean(result)} onChange={(value) => setAnswers((current) => ({ ...current, [paper[currentExamIndex].id]: value }))} />
                {result && <AnswerFeedback question={paper[currentExamIndex]} selected={answers[paper[currentExamIndex].id] ?? []} />}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" disabled={currentExamIndex === 0} onClick={() => setCurrentExamIndex((current) => Math.max(0, current - 1))}>上一题</button>
              <button type="button" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={currentExamIndex === paper.length - 1} onClick={() => setCurrentExamIndex((current) => Math.min(paper.length - 1, current + 1))}>下一题</button>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-blue-600" style={{ width: `${((currentExamIndex + 1) / paper.length) * 100}%` }} />
            </div>

            {result && (
              <div className="grid gap-3 md:grid-cols-3">
                {examTypeStats.map((item) => (
                  <div key={item.type} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{typeText(item.type)}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-950">{item.correct} / {item.total}</p>
                    <p className="mt-1 text-xs text-slate-500">正确率 {item.accuracy}%</p>
                  </div>
                ))}
              </div>
            )}

            {!result ? (
              <button type="button" className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700" onClick={() => void submitExam()}>交卷评分</button>
            ) : (
              <button type="button" className="w-full rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100" onClick={() => setPaper(null)}>返回考试设置</button>
            )}
          </div>
        </Panel>
      )}
    </PageHeader>
  )
}

function StatsPage({ data, stats }: { data: AppData; stats: ReturnType<typeof buildStats> }) {
  const aiReport = useMemo(() => buildLocalAiReport(data), [data])
  const chartData = [
    { name: '单选', 正确率: stats.typeAccuracy.single },
    { name: '多选', 正确率: stats.typeAccuracy.multiple },
    { name: '判断', 正确率: stats.typeAccuracy.judge },
  ]
  const sevenDayData = buildSevenDayStats(data.records)
  const knowledgeReviewStates = JSON.parse(window.localStorage.getItem('ai-trainer-knowledge-review') ?? '{}') as Record<string, string>
  const knowledgeSummary = buildKnowledgeSummary(data.knowledgeItems, knowledgeReviewStates)
  const topMistakes = buildTopMistakes(data)

  return (
    <PageHeader title="学习统计" subtitle="用答题记录识别题型薄弱点、知识点掌握情况和模拟考试表现。" icon={BarChart3}>
      <div className="space-y-4">
        <StatGrid stats={stats} />
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="题型正确率" subtitle="根据历史答题记录计算">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="正确率" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="近 7 天学习趋势" subtitle="作答数量与正确率">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sevenDayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="作答数" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  <Bar yAxisId="right" dataKey="正确率" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="轻 AI 薄弱分析" subtitle="基于本地记录推断当前最薄弱区域">
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">最弱题型</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{aiReport.weakestType ? `${aiReport.weakestType.label} · 正确率 ${aiReport.weakestType.accuracy}%` : '暂无足够数据'}</p>
              </div>
              <div className="space-y-2">
                {aiReport.weakestKnowledgePoints.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">知识点答题记录不足，完成更多刷题后会生成薄弱知识点。</p> : aiReport.weakestKnowledgePoints.map((item) => (
                  <div key={item.name} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <span className="text-sm font-semibold text-rose-700">{item.accuracy}%</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">基于 {item.answered} 次相关作答生成</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="知识点掌握状态" subtitle="来自知识点卡片复习标记">
            <div className="grid gap-3 sm:grid-cols-4">
              <MiniStat label="知识点" value={knowledgeSummary.total} />
              <MiniStat label="不熟悉" value={knowledgeSummary.weak} />
              <MiniStat label="有印象" value={knowledgeSummary.learning} />
              <MiniStat label="已掌握" value={knowledgeSummary.mastered} />
            </div>
          </Panel>
          <Panel title="高频错题 Top 10" subtitle="按错误次数排序，优先复盘">
            {topMistakes.length === 0 ? <EmptyState title="暂无错题记录" description="开始刷题后会自动统计高频错题。" /> : (
              <div className="space-y-2">
                {topMistakes.map(({ question, mistake }) => (
                  <div key={question.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-relaxed text-slate-900">{question.originalNumber}. {question.stem}</p>
                      <span className="shrink-0 rounded-xl bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">错 {mistake.wrongCount} 次</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="考试历史" subtitle="最近模拟考试成绩">
            <div className="space-y-3">
              {data.exams.length === 0 ? <EmptyState title="暂无考试记录" description="完成一次模拟考试后会出现在这里。" /> : data.exams.slice(-8).reverse().map((exam) => (
                <StatusRow key={exam.id} label={new Date(exam.createdAt).toLocaleString()} value={`${exam.score}/${exam.total}`} />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </PageHeader>
  )
}

function QuestionCard({ question, selected, submitted, isCorrect, onSelect, onSubmit, onNext, onChanged }: { question: Question; selected: string[]; submitted: boolean; isCorrect: boolean; onSelect: (value: string[]) => void; onSubmit: () => Promise<void>; onNext: () => void; onChanged: () => Promise<void> }) {
  const feedbackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!submitted) return
    window.setTimeout(() => {
      feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }, [submitted])

  return (
    <div className="space-y-5">
      <QuestionStem question={question} />
      <OptionSelector question={question} selected={selected} disabled={submitted} onChange={onSelect} />
      {submitted && <div ref={feedbackRef}><AnswerFeedback question={question} selected={selected} /></div>}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FavoriteButton questionId={question.id} onChanged={onChanged} />
          <div className="grid grid-cols-2 gap-3 sm:flex">
            {!submitted ? (
              <button type="button" className="col-span-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:col-span-1" disabled={selected.length === 0} onClick={() => void onSubmit()}>提交答案</button>
            ) : (
              <>
                <span className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}{isCorrect ? '回答正确' : '回答错误'}</span>
                <button type="button" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700" onClick={onNext}>下一题</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuestionStem({ question, index }: { question: Question; index?: number }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {index && <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">第 {index} 题</span>}
        <span className="rounded-xl bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{typeText(question.type)}</span>
        {question.knowledgePoints.map((point) => <span key={point} className="rounded-xl bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">{point}</span>)}
      </div>
      <h2 className="whitespace-pre-wrap text-lg font-semibold leading-relaxed text-slate-900">{question.stem}</h2>
    </div>
  )
}

function OptionSelector({ question, selected, disabled, onChange }: { question: Question; selected: string[]; disabled: boolean; onChange: (value: string[]) => void }) {
  const toggle = (key: string) => {
    if (disabled) return
    if (question.type === 'multiple') {
      onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key])
      return
    }
    onChange([key])
  }

  return (
    <div className="grid gap-3">
      {question.options.map((option) => {
        const active = selected.includes(option.key)
        return (
          <button key={option.key} type="button" className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${active ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50'} ${disabled ? 'cursor-default' : ''}`} onClick={() => toggle(option.key)}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{question.type === 'judge' ? option.text.slice(0, 1) : option.key}</span>
            <span>{option.text}</span>
          </button>
        )
      })}
    </div>
  )
}

function AnswerFeedback({ question, selected }: { question: Question; selected: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
        <p>你的答案：<span className="font-semibold">{selected.length ? formatAnswer(selected) : '未作答'}</span></p>
        <p>标准答案：<span className="font-semibold text-blue-700">{formatAnswer(question.answer)}</span></p>
      </div>
      {question.explanation && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">解析：{question.explanation}</p>}
    </div>
  )
}

function QuestionList({ questions, favoriteSet, onChanged }: { questions: Question[]; favoriteSet: Set<string>; onChanged: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null)

  if (questions.length === 0) return <EmptyState title="没有匹配题目" description="请调整筛选条件，或先导入题库。" />
  return (
    <div className="space-y-3">
      {questions.slice(0, 200).map((question) => (
        <details key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 open:border-blue-200 open:bg-blue-50/30">
          <summary className="cursor-pointer list-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="rounded-xl bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{typeText(question.type)}</span>
                  <span className="rounded-xl bg-slate-100 px-2 py-1 text-xs text-slate-600">{question.sourceFile}</span>
                </div>
                <p className="font-medium leading-relaxed text-slate-900">{question.originalNumber}. {question.stem}</p>
              </div>
              {favoriteSet.has(question.id) && <Heart className="h-5 w-5 fill-blue-600 text-blue-600" />}
            </div>
          </summary>
          <div className="mt-4 space-y-3">
            {editingId === question.id ? (
              <QuestionEditor question={question} onCancel={() => setEditingId(null)} onSaved={async () => { setEditingId(null); await onChanged() }} />
            ) : (
              <>
                {question.options.map((option) => <p key={option.key} className="rounded-xl bg-white p-3 text-sm text-slate-700">{option.key}. {option.text}</p>)}
                <AnswerFeedback question={question} selected={[]} />
                <div className="flex flex-wrap gap-3">
                  <FavoriteButton questionId={question.id} onChanged={onChanged} />
                  <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100" onClick={() => setEditingId(question.id)}>
                    <Pencil className="h-5 w-5" />
                    编辑题目
                  </button>
                </div>
              </>
            )}
          </div>
        </details>
      ))}
    </div>
  )
}

function QuestionEditor({ question, onCancel, onSaved }: { question: Question; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<QuestionType>(question.type)
  const [stem, setStem] = useState(question.stem)
  const [optionsText, setOptionsText] = useState(question.options.map((option) => `${option.key}. ${option.text}`).join('\n'))
  const [answerText, setAnswerText] = useState(formatAnswer(question.answer))
  const [explanation, setExplanation] = useState(question.explanation ?? '')
  const [knowledgePointsText, setKnowledgePointsText] = useState(question.knowledgePoints.join('、'))
  const [error, setError] = useState('')
  const recommendedKnowledgePoints = recommendKnowledgePoints({
    stem,
    explanation,
    options: parseOptionsText(optionsText, type),
    knowledgePoints: knowledgePointsText.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean),
  })

  const addKnowledgePoint = (point: string) => {
    const points = knowledgePointsText.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean)
    setKnowledgePointsText(Array.from(new Set([...points, point])).join('、'))
  }

  useEffect(() => {
    if (type === 'judge' && optionsText.trim() === '') {
      setOptionsText('true. 正确\nfalse. 错误')
    }
  }, [type, optionsText])

  const save = async () => {
    const nextStem = stem.trim()
    const nextOptions = parseOptionsText(optionsText, type)
    const nextAnswer = normalizeAnswer(answerText, type)
    const optionKeys = new Set(nextOptions.map((option) => option.key))

    if (!nextStem) {
      setError('题干不能为空')
      return
    }

    if (nextAnswer.length === 0) {
      setError('答案不能为空，选择题填写 A/B/AB，判断题填写 正确/错误')
      return
    }

    if (type !== 'judge' && nextOptions.length === 0) {
      setError('选择题至少需要一个选项')
      return
    }

    if (type !== 'judge' && nextAnswer.some((answer) => !optionKeys.has(answer))) {
      setError('答案必须在选项范围内')
      return
    }

    if (type === 'judge' && !['true', 'false'].includes(nextAnswer[0] ?? '')) {
      setError('判断题答案只能是正确或错误')
      return
    }

    const nextQuestion: Question = {
      ...question,
      type,
      stem: nextStem,
      options: nextOptions,
      answer: nextAnswer,
      explanation: explanation.trim(),
      knowledgePoints: knowledgePointsText.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean),
      normalizedHash: createHash(`${nextStem}${nextOptions.map((option) => option.text).join('')}`),
      updatedAt: Date.now(),
    }

    await db.questions.put(nextQuestion)
    await onSaved()
  }

  return (
    <div className="rounded-3xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          题型
          <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900" value={type} onChange={(event) => setType(event.target.value as QuestionType)}>
            <option value="single">单选</option>
            <option value="multiple">多选</option>
            <option value="judge">判断</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          题干
          <textarea className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal leading-relaxed text-slate-900" value={stem} onChange={(event) => setStem(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          选项
          <textarea className="min-h-36 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal leading-relaxed text-slate-900" placeholder="A. 选项内容" value={optionsText} onChange={(event) => setOptionsText(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          答案
          <input className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900" placeholder="A / AB / 正确 / 错误" value={answerText} onChange={(event) => setAnswerText(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          解析
          <textarea className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal leading-relaxed text-slate-900" value={explanation} onChange={(event) => setExplanation(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          知识点
          <input className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900" placeholder="用顿号、逗号或换行分隔" value={knowledgePointsText} onChange={(event) => setKnowledgePointsText(event.target.value)} />
          {recommendedKnowledgePoints.length > 0 && (
            <div className="flex flex-wrap gap-2 rounded-2xl bg-blue-50 p-3">
              <span className="px-1 py-2 text-xs font-semibold text-blue-700">推荐知识点</span>
              {recommendedKnowledgePoints.map((point) => (
                <button key={point} type="button" className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100" onClick={() => addKnowledgePoint(point)}>
                  {point}
                </button>
              ))}
            </div>
          )}
        </label>
      </div>
      {error && <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100" onClick={onCancel}>取消</button>
        <button type="button" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700" onClick={() => void save()}>保存修改</button>
      </div>
    </div>
  )
}

function parseOptionsText(value: string, type: QuestionType) {
  const options = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^([A-Fa-f]|true|false)[.．、:：\s]+(.+)$/)
      return match
        ? { key: match[1].toLowerCase() === 'true' || match[1].toLowerCase() === 'false' ? match[1].toLowerCase() : match[1].toUpperCase(), text: match[2].trim() }
        : { key: String.fromCharCode(65 + index), text: line }
    })

  if (type === 'judge' && options.length === 0) {
    return [
      { key: 'true', text: '正确' },
      { key: 'false', text: '错误' },
    ]
  }

  return options
}

function FavoriteButton({ questionId, onChanged }: { questionId: string; onChanged: () => Promise<void> }) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    void db.favorites.get(questionId).then((favorite) => setActive(Boolean(favorite)))
  }, [questionId])

  const toggle = async () => {
    if (active) await db.favorites.delete(questionId)
    else await db.favorites.put({ questionId, createdAt: Date.now() })
    setActive(!active)
    await onChanged()
  }

  return (
    <button type="button" className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`} onClick={toggle}>
      <Heart className={`h-5 w-5 ${active ? 'fill-blue-600' : ''}`} />
      {active ? '已收藏' : '收藏题目'}
    </button>
  )
}

function StatGrid({ stats }: { stats: ReturnType<typeof buildStats> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="题库总量" value={stats.questionCount} icon={Database} />
      <MetricCard label="累计作答" value={stats.recordCount} icon={BookOpen} />
      <MetricCard label="总正确率" value={`${stats.accuracy}%`} icon={CheckCircle2} />
      <MetricCard label="未掌握错题" value={stats.mistakeCount} icon={Heart} />
      <MetricCard label="模拟考试" value={stats.examCount} icon={ClipboardList} />
    </div>
  )
}

function PageHeader({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Home; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 sm:flex">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 md:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Home }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{value}</p></div>
}

function QuestionPreview({ question }: { question: Question }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-medium text-slate-900">{question.originalNumber}. {question.stem}</p><p className="mt-2 text-xs text-slate-500">{typeText(question.type)} · 答案 {formatAnswer(question.answer)}</p></div>
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><p className="font-semibold text-slate-900">{title}</p><p className="mt-2 text-sm text-slate-500">{description}</p></div>
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3"><span>{label}</span><span className="font-semibold text-slate-900">{value}</span></div>
}

function ProgressItem({ label, value }: { label: string; value: number }) {
  return <div><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{value}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${value}%` }} /></div></div>
}

function questionTypeNavClass(type: QuestionType, answered: boolean) {
  if (answered) return 'bg-slate-900 text-white hover:bg-slate-800'
  if (type === 'single') return 'bg-blue-100 text-blue-800 ring-1 ring-blue-200 hover:bg-blue-200'
  if (type === 'multiple') return 'bg-violet-100 text-violet-800 ring-1 ring-violet-200 hover:bg-violet-200'
  return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-200'
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function typeText(type: QuestionType) {
  if (type === 'single') return '单选'
  if (type === 'multiple') return '多选'
  return '判断'
}

export default App
