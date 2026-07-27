'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  DIFFICULTY_META,
  HISTORY_DIFFICULTIES,
  isHistoryDifficulty,
  type HistoryDifficulty,
} from '@/lib/difficulty'

const STORAGE_KEY = 'terratap:history:difficulty'

/**
 * Map-difficulty picker for Geography History (issue #47). Each choice is a
 * full navigation to `/history?d=…`, which re-deals the hand server-side with
 * the matching map detail. The last choice is remembered so a bare `/history`
 * visit restores it.
 */
export default function HistoryDifficultyPicker({
  current,
}: {
  current: HistoryDifficulty
}) {
  const router = useRouter()

  useEffect(() => {
    try {
      const explicit = new URL(window.location.href).searchParams.has('d')
      if (explicit) {
        window.localStorage.setItem(STORAGE_KEY, current)
        return
      }
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved && saved !== current && isHistoryDifficulty(saved)) {
        router.replace(`/history?d=${saved}`)
      }
    } catch {
      // localStorage/URL unavailable — fall back to the default difficulty.
    }
  }, [current, router])

  return (
    <div className="gg-mapdiff" role="group" aria-label="Map difficulty">
      {HISTORY_DIFFICULTIES.map((d) => {
        const meta = DIFFICULTY_META[d]
        const active = d === current
        return (
          <a
            key={d}
            href={`/history?d=${d}`}
            className={`gg-mapdiff-btn${active ? ' is-active' : ''}`}
            aria-current={active ? 'true' : undefined}
            title={meta.hint}
          >
            {meta.label}
          </a>
        )
      })}
    </div>
  )
}
