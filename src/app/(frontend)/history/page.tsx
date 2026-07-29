import GlobeGame from '@/components/GlobeGame'
import HistoryDifficultyPicker from '@/components/HistoryDifficultyPicker'
import { buildHistoryRun, HISTORY_RUN_LENGTH } from '@/lib/history'
import { toHistoryDifficulty } from '@/lib/difficulty'
import '../styles.css'
import '../play/play.css'

// The hand is dealt from the current UTC day — same five for everyone (#59).
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Geography History',
  description:
    "Today's five moments from history — read each one and tap the globe where it happened. Same hand for everyone. Pick your difficulty: borders and names, borders only, or a bare globe.",
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  const { d } = await searchParams
  const difficulty = toHistoryDifficulty(d)
  const day = new Date().toISOString().slice(0, 10)
  const run = buildHistoryRun(day, HISTORY_RUN_LENGTH, difficulty)
  return (
    <>
      <HistoryDifficultyPicker current={difficulty} />
      <GlobeGame run={run} />
    </>
  )
}
