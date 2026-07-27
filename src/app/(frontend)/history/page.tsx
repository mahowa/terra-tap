import GlobeGame from '@/components/GlobeGame'
import HistoryDifficultyPicker from '@/components/HistoryDifficultyPicker'
import { buildHistoryRun, HISTORY_RUN_LENGTH } from '@/lib/history'
import { toHistoryDifficulty } from '@/lib/difficulty'
import '../styles.css'
import '../play/play.css'

// Each visit deals a fresh random hand from the history pool.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Geography History',
  description:
    'Read a moment from history and tap the globe where it happened. Pick your difficulty: borders and names, borders only, or a bare globe.',
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  const { d } = await searchParams
  const difficulty = toHistoryDifficulty(d)
  const run = buildHistoryRun(Math.random, HISTORY_RUN_LENGTH, difficulty)
  return (
    <>
      <HistoryDifficultyPicker current={difficulty} />
      <GlobeGame run={run} />
    </>
  )
}
