import type { Difficulty } from './scoring'
import type { MapDetail } from './difficulty'

/** A single playable round: a place to find on the globe. */
export type Round = {
  name: string
  country: string | null
  lat: number
  lng: number
  difficulty: Difficulty
  fact: string | null
  /**
   * History mode (#4): a description shown INSTEAD of the name while guessing —
   * the player works out where it refers to. Reveal shows the name as usual.
   */
  clue?: string | null
}

/** A daily-set round row as stored, carrying the optional history blurb. */
export type DailyRoundInput = {
  difficulty?: Difficulty
  /** "On this day" event that selected the place; preferred over the location's facts. */
  event?: string | null
}

/** A full playable run (e.g. the daily 5). */
export type GameRun = {
  title: string
  rounds: Round[]
  /** 'daily' runs lock after one play (saved in the browser); 'practice' replays freely. */
  mode: 'daily' | 'practice'
  /** UTC day key (YYYY-MM-DD) for the daily; '' for practice. Used as the localStorage key. */
  dateKey: string
  /** Timed "speed run": each round is played against a countdown (issue #9). */
  timed?: boolean
  /**
   * Marks a History-mode run (the map isn't the puzzle). Kept as the mode flag
   * that `runKind` keys off; the *visual* detail is chosen by `mapDetail` below.
   */
  labeled?: boolean
  /**
   * How much the globe draws (issue #47): 'labeled' = borders + names,
   * 'borders' = outlines only, 'plain' = bare satellite. Defaults to 'plain'
   * when unset (every non-History mode).
   */
  mapDetail?: MapDetail
  /** Versus (#5): the challenge seed this run was dealt from. */
  versusSeed?: string
  /**
   * When set, the run locks after one completed play: the result is saved to
   * this browser storage key and replays show the saved result instead (#21).
   * The daily and the (daily-seeded) speed run both use this.
   */
  lockKey?: string
}
