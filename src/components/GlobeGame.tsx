'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import type { Map as MlMap, Marker as MlMarker, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { scoreRound, type LatLng, DIFFICULTY_MULTIPLIER } from '@/lib/scoring'
import type { GameRun, Round } from '@/lib/game-types'
import { formatRunShare, sharePlan, shareHeading, shareUrlFromLocation } from '@/lib/share'
import { pickReaction, pickVerdict } from '@/lib/reactions'
import { cameraActionFor, initialGlobeZoom, pairBounds } from '@/lib/camera'
import {
  KEYBOARD_HELP,
  describePlacement,
  describeReveal,
  isPlaceGuessKey,
  prefersReducedMotion,
  revealDuration,
} from '@/lib/a11y'
import { collapseAttribution } from '@/lib/attribution'
import {
  countryAt,
  countryFeatureAt,
  describeMiss,
  loadBordersGeoJSON,
  type CountryGeometry,
} from '@/lib/country-lookup'
import type { MapDetail } from '@/lib/difficulty'
import {
  COUNTUP_MS,
  LINE_ANIM_MS,
  easeOutCubic,
  greatCirclePath,
  partialGreatCirclePath,
} from '@/lib/anim'
import {
  SPEED_ROUND_SECONDS,
  expiryAction,
  formatDuration,
  initialStarted,
  showStartGate,
} from '@/lib/speed'
import { legacyDailyLockKey } from '@/lib/locks'
import { loadStats, streakText, type DailyStats } from '@/lib/stats'
import {
  clearProgress,
  loadProgress,
  resumePlan,
  saveProgress,
} from '@/lib/progress'
import { otherGameLinks, runKind } from '@/lib/nav'
import {
  challengeBannerText,
  challengeUrl,
  formatChallengeShare,
  opponentRunningTotal,
  pointsFromBase,
  totalFromBases,
  versusOutcome,
} from '@/lib/versus'

const GUESS_COLOR = '#38bdf8' // sky-400
const ANSWER_COLOR = '#34d399' // emerald-400

// ESRI World Imagery: free, key-less, label-free satellite tiles with deep zoom
// (sub-meter to ~z19). No place names → fair guessing. Attribution is required
// and shown via MapLibre's attribution control.
//
// History difficulty (#47) chooses what's drawn on top:
//   'labeled' → Esri's boundaries+places raster (borders AND names, fused)
//   'borders' → an offline vector border layer added post-load (see below)
//   'plain'   → nothing (bare satellite)
function buildMapStyle(detail: MapDetail): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [
          'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      },
    },
    layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
  }
  if (detail === 'labeled') {
    style.sources.labels = {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Labels © Esri',
    }
    style.layers.push({ id: 'labels', type: 'raster', source: 'labels' })
  }
  return style
}

const LINE_SOURCE = 'gg-line'
const REGION_SOURCE = 'gg-region'
// Medium history map (#47): all-country outlines from the offline dataset. The
// Esri reference raster can't give borders without names, so borders-only is
// drawn as a vector line layer instead.
const BORDERS_SOURCE = 'gg-borders'

// Neutral full-globe framing the game starts from; the zoom is sized to the
// viewport at mount (issue #34). Applied after the globe projection is active
// (the mercator→globe switch otherwise inflates zoom). Later rounds keep the
// player's current view (see cameraActionFor, issue #7).
const GLOBE_CENTER: [number, number] = [0, 20]

/**
 * A small colored dot marker for guess/answer. The dot lives in an inner element
 * so its pop-in animation (#46) doesn't fight the translate transform MapLibre
 * applies to the outer marker element for positioning.
 */
function markerEl(color: string): HTMLDivElement {
  const el = document.createElement('div')
  const dot = document.createElement('div')
  dot.className = 'gg-marker-dot'
  dot.style.cssText = `width:16px;height:16px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.45);`
  el.appendChild(dot)
  return el
}

/**
 * Counts up from 0 to `value` on mount (#46). setState only fires inside the
 * rAF callback, never synchronously in the effect body. Reduced-motion users
 * see the final number immediately.
 */
function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
  useEffect(() => {
    if (prefersReducedMotion()) return
    let raf = 0
    let start: number | null = null
    const step = (now: number) => {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / COUNTUP_MS)
      setShown(Math.round(easeOutCubic(t) * value))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className={className}>{shown}</span>
}

type Phase = 'guessing' | 'revealed' | 'done'

type RoundResult = {
  round: Round
  /** null = the speed-run clock expired with no guess placed. */
  guess: LatLng | null
  distanceKm: number | null
  points: number
  base: number
  multiplier: number
  reaction: string
  /** Country the guess landed in (null = ocean/uncovered); shown on misses (#2). */
  guessCountry: string | null
  /** Country containing the answer, from the same dataset so names compare cleanly. */
  answerCountry: string | null
  /** Geometry of the answer's country, highlighted on the globe on reveal (#6). */
  answerRegion: CountryGeometry | null
}

/** Serializable per-round result persisted to the browser for the daily lock. */
type SavedRound = {
  name: string
  base: number
  multiplier: number
  points: number
  /** null = timed out with no guess. */
  distanceKm: number | null
}
type SavedDaily = {
  dateKey: string
  total: number
  rounds: SavedRound[]
  /** Timed runs: total play time, so replays and shares keep the real time (#31). */
  elapsedMs?: number
}

function loadSaved(lockKey: string, legacyKey?: string): SavedDaily | null {
  if (typeof window === 'undefined' || !lockKey) return null
  try {
    const raw =
      window.localStorage.getItem(lockKey) ??
      (legacyKey ? window.localStorage.getItem(legacyKey) : null)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedDaily
    return Array.isArray(parsed.rounds) ? parsed : null
  } catch {
    return null
  }
}

function saveLocked(data: SavedDaily, lockKey: string): void {
  if (typeof window === 'undefined' || !lockKey) return
  try {
    window.localStorage.setItem(lockKey, JSON.stringify(data))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

const toSavedRound = (r: RoundResult): SavedRound => ({
  name: r.round.name,
  base: r.base,
  multiplier: r.multiplier,
  points: r.points,
  distanceKm: r.distanceKm,
})

export default function GlobeGame({
  run,
  opponentBases,
}: {
  run: GameRun
  /** Versus (#5): challenger's per-round base scores parsed from the URL. */
  opponentBases?: number[] | null
}) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('guessing')
  const [guess, setGuess] = useState<LatLng | null>(null)
  const [results, setResults] = useState<RoundResult[]>([])
  const [ready, setReady] = useState(false)
  // Daily lock: result loaded from / saved to the browser, and whether it was a prior day's play.
  const [saved, setSaved] = useState<SavedDaily | null>(null)
  const [playedEarlier, setPlayedEarlier] = useState(false)
  const [copied, setCopied] = useState(false)
  // Speed run (#9): ms left on the current round's clock, and total play time.
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  // Timed runs hold on an explicit "Start run" gate so the clock never starts
  // on page load while tiles are still streaming in (#24).
  const [started, setStarted] = useState(() => initialStarted(!!run.timed))
  // Polite live region narrating placements and reveals for screen readers (#30).
  const [announcement, setAnnouncement] = useState('')

  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markersRef = useRef<MlMarker[]>([])
  // Handle for the reveal line's grow animation, so it can be cancelled when the
  // round advances or the component unmounts (#46).
  const lineRafRef = useRef<number | null>(null)
  const clickRef = useRef<(p: { lng: number; lat: number }) => void>(() => {})
  const expireRef = useRef<() => void>(() => {})
  const roundStartRef = useRef<number>(0)

  // On mount, if this lockable run was already played in this browser
  // (daily or speed run, #21), jump straight to the saved results. Otherwise
  // restore any in-flight progress so a refresh resumes — not restarts — the
  // day's attempt (#26).
  useEffect(() => {
    if (!run.lockKey) return
    const prior = loadSaved(
      run.lockKey,
      run.mode === 'daily' ? legacyDailyLockKey(run.dateKey) : undefined,
    )
    if (prior) {
      setSaved(prior)
      setPlayedEarlier(true)
      setPhase('done')
      return
    }
    const progress = loadProgress(run.lockKey, run.dateKey, run.rounds.length)
    if (!progress || (progress.rounds.length === 0 && progress.armedIndex === null)) return
    const plan = resumePlan(progress, !!run.timed, run.rounds.length)
    const restored: RoundResult[] = progress.rounds.map((s, i) => ({
      round: run.rounds[i],
      guess: null,
      distanceKm: s.distanceKm,
      points: s.points,
      base: s.base,
      multiplier: s.multiplier,
      reaction: pickReaction(s.base),
      guessCountry: null,
      answerCountry: null,
      answerRegion: null,
    }))
    // A timed round whose clock was running at unload is forfeited — a refresh
    // must not grant a fresh clock for a place the player already saw.
    if (plan.forfeitArmed) {
      const armed = run.rounds[progress.rounds.length]
      restored.push({
        round: armed,
        guess: null,
        distanceKm: null,
        points: 0,
        base: 0,
        multiplier: DIFFICULTY_MULTIPLIER[armed.difficulty],
        reaction: '⏰ The clock was running when the page went away.',
        guessCountry: null,
        answerCountry: null,
        answerRegion: null,
      })
    }
    setResults(restored)
    setElapsedMs(progress.elapsedMs)
    if (plan.finished) {
      setPhase('done')
    } else {
      setIndex(plan.resumeIndex)
    }
  }, [run.lockKey, run.mode, run.dateKey, run.timed, run.rounds])

  const round = run.rounds[index]
  const answer: LatLng | null = useMemo(
    () => (round ? { lat: round.lat, lng: round.lng } : null),
    [round],
  )

  const handleGlobeClick = useCallback(
    ({ lat, lng }: { lat: number; lng: number }) => {
      if (phase !== 'guessing') return
      // Behind the start gate the round hasn't begun — ignore globe taps (#24).
      if (showStartGate(!!run.timed, started)) return
      setGuess({ lat, lng })
    },
    [phase, run.timed, started],
  )
  // Keep the map's click handler pointing at the latest closure (avoids stale phase).
  useEffect(() => {
    clickRef.current = handleGlobeClick
  }, [handleGlobeClick])

  // Keyboard placement (#30): Enter drops the guess at the view center and
  // narrates where it landed. Same ref pattern as clickRef.
  const kbPlaceRef = useRef<(p: LatLng) => void>(() => {})
  useEffect(() => {
    kbPlaceRef.current = (p: LatLng) => {
      if (phase !== 'guessing' || showStartGate(!!run.timed, started)) return
      setGuess(p)
      void countryAt(p).then((country) => setAnnouncement(describePlacement(country)))
    }
  }, [phase, run.timed, started])

  // Initialize the MapLibre globe once. Dynamic import keeps WebGL/window off SSR.
  useEffect(() => {
    if (!wrapRef.current) return
    let map: MlMap | null = null
    let cancelled = false
    import('maplibre-gl').then(({ Map }) => {
      if (cancelled || !wrapRef.current) return
      // Fill most of the short viewport side with the globe (#34).
      const startView = {
        center: GLOBE_CENTER,
        zoom: initialGlobeZoom(wrapRef.current.clientWidth, wrapRef.current.clientHeight),
      }
      const mapDetail: MapDetail = run.mapDetail ?? 'plain'
      map = new Map({
        container: wrapRef.current,
        style: buildMapStyle(mapDetail),
        center: startView.center,
        zoom: startView.zoom,
        attributionControl: { compact: true },
        maxPitch: 0,
        dragRotate: false,
      })
      mapRef.current = map
      ;(window as unknown as Record<string, unknown>).__mc_map = map
      map.on('style.load', () => {
        map?.setProjection({ type: 'globe' })
        // Re-apply after the projection switch so the start view is a full globe.
        map?.jumpTo(startView)
      })
      map.on('load', () => {
        setReady(true)
        // Start the attribution collapsed to its ⓘ toggle — expanded it covers
        // the Submit button on phones (#25).
        collapseAttribution(wrapRef.current)
        // Medium difficulty (#47): draw country outlines from the offline
        // dataset — borders without the Esri name labels.
        if (mapDetail === 'borders') {
          loadBordersGeoJSON().then((data) => {
            const m = mapRef.current
            if (!m || m.getSource(BORDERS_SOURCE)) return
            m.addSource(BORDERS_SOURCE, { type: 'geojson', data })
            m.addLayer({
              id: BORDERS_SOURCE,
              type: 'line',
              source: BORDERS_SOURCE,
              paint: {
                'line-color': 'rgba(255,255,255,0.6)',
                'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 3, 0.8, 6, 1.4],
              },
            })
          })
        }
      })
      map.on('click', (e) => clickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat }))
      // Keyboard play (#30): MapLibre's canvas is focusable with built-in
      // arrow/zoom navigation; Enter places the guess at the view center.
      const canvas = map.getCanvas()
      canvas.setAttribute('aria-describedby', 'gg-kb-help')
      canvas.addEventListener('keydown', (e) => {
        if (!isPlaceGuessKey(e.key) || !mapRef.current) return
        e.preventDefault()
        const c = mapRef.current.getCenter()
        kbPlaceRef.current({ lat: c.lat, lng: c.lng })
      })
    })
    const el = wrapRef.current
    const ro = new ResizeObserver(() => mapRef.current?.resize())
    ro.observe(el)
    return () => {
      cancelled = true
      ro.disconnect()
      map?.remove()
      mapRef.current = null
    }
  }, [run.mapDetail])

  // Draw guess/answer markers + the connecting line, and frame the camera.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    const add = (p: LatLng, color: string) => {
      import('maplibre-gl').then(({ Marker }) => {
        if (!mapRef.current) return
        const mk = new Marker({ element: markerEl(color), anchor: 'center' })
          .setLngLat([p.lng, p.lat])
          .addTo(map)
        markersRef.current.push(mk)
      })
    }
    if (guess) add(guess, GUESS_COLOR)
    if (phase === 'revealed' && answer) add(answer, ANSWER_COLOR)

    // Answer's country region: shown while revealed so the player sees how close
    // or far they were from the right area (#6); cleared for the next round.
    const regionGeom =
      phase === 'revealed' ? (results[results.length - 1]?.answerRegion ?? null) : null
    const regionData = {
      type: 'FeatureCollection' as const,
      features: regionGeom
        ? [{ type: 'Feature' as const, properties: {}, geometry: regionGeom }]
        : [],
    }
    const regionSrc = map.getSource(REGION_SOURCE) as
      | { setData?: (d: unknown) => void }
      | undefined
    if (regionSrc?.setData) {
      regionSrc.setData(regionData)
    } else {
      map.addSource(REGION_SOURCE, { type: 'geojson', data: regionData })
      map.addLayer({
        id: `${REGION_SOURCE}-fill`,
        type: 'fill',
        source: REGION_SOURCE,
        paint: { 'fill-color': ANSWER_COLOR, 'fill-opacity': 0.15 },
      })
      map.addLayer({
        id: `${REGION_SOURCE}-outline`,
        type: 'line',
        source: REGION_SOURCE,
        paint: { 'line-color': ANSWER_COLOR, 'line-width': 1.5, 'line-opacity': 0.8 },
      })
    }

    // The guess→answer line grows along the great circle on reveal (#46). A
    // stray animation from the previous round is cancelled first.
    if (lineRafRef.current !== null) {
      cancelAnimationFrame(lineRafRef.current)
      lineRafRef.current = null
    }
    const showLine = phase === 'revealed' && guess && answer
    const applyLine = (coords: [number, number][]) => {
      const data = {
        type: 'FeatureCollection' as const,
        features:
          coords.length >= 2
            ? [
                {
                  type: 'Feature' as const,
                  properties: {},
                  geometry: { type: 'LineString' as const, coordinates: coords },
                },
              ]
            : [],
      }
      const src = map.getSource(LINE_SOURCE) as { setData?: (d: unknown) => void } | undefined
      if (src?.setData) {
        src.setData(data)
      } else {
        map.addSource(LINE_SOURCE, { type: 'geojson', data })
        map.addLayer({
          id: LINE_SOURCE,
          type: 'line',
          source: LINE_SOURCE,
          paint: { 'line-color': GUESS_COLOR, 'line-width': 2, 'line-dasharray': [2, 1.5] },
        })
      }
    }
    if (showLine && guess && answer) {
      if (prefersReducedMotion()) {
        applyLine(greatCirclePath(guess, answer))
      } else {
        applyLine([]) // ensure the layer exists, then grow into it
        let start: number | null = null
        const tick = (now: number) => {
          if (start === null) start = now
          const t = Math.min(1, (now - start) / LINE_ANIM_MS)
          applyLine(partialGreatCirclePath(guess, answer, easeOutCubic(t)))
          lineRafRef.current = t < 1 ? requestAnimationFrame(tick) : null
        }
        lineRafRef.current = requestAnimationFrame(tick)
      }
    } else {
      applyLine([])
    }

    // Camera: frame the reveal pair, otherwise stay put — new rounds keep the
    // player's current view instead of zooming back out to the full globe (#7).
    if (cameraActionFor(phase, guess, answer) === 'fit-pair' && guess && answer) {
      map.fitBounds(pairBounds(guess, answer), {
        padding: 120,
        maxZoom: 5,
        // Honor prefers-reduced-motion: jump instead of flying (#30).
        duration: revealDuration(prefersReducedMotion()),
      })
    }

    // Stop the line animation if the round advances (or we unmount) mid-draw.
    return () => {
      if (lineRafRef.current !== null) {
        cancelAnimationFrame(lineRafRef.current)
        lineRafRef.current = null
      }
    }
  }, [ready, guess, phase, answer, results])

  const submitGuess = useCallback(async () => {
    if (!guess || !round || !answer || phase !== 'guessing') return
    if (run.timed && roundStartRef.current) {
      setElapsedMs((e) => e + (Date.now() - roundStartRef.current))
    }
    const s = scoreRound(guess, answer, round.difficulty)
    // Both looked up in the same offline dataset so the names compare cleanly.
    const [guessCountry, answerFeature] = await Promise.all([
      countryAt(guess),
      countryFeatureAt(answer),
    ])
    const answerCountry = answerFeature?.properties.name ?? null
    const answerRegion = answerFeature?.geometry ?? null
    setResults((prev) => [
      ...prev,
      {
        round,
        guess,
        distanceKm: s.distanceKm,
        points: s.points,
        base: s.base,
        multiplier: s.multiplier,
        reaction: pickReaction(s.base),
        guessCountry,
        answerCountry,
        answerRegion,
      },
    ])
    setAnnouncement(describeReveal(round.name, s.base, s.points, s.distanceKm))
    setPhase('revealed')
  }, [guess, round, answer, phase, run.timed])

  // Speed-run clock hit zero with no guess placed: score the round as a zero.
  const timeoutRound = useCallback(async () => {
    if (!round || !answer || phase !== 'guessing') return
    if (roundStartRef.current) {
      setElapsedMs((e) => e + (Date.now() - roundStartRef.current))
    }
    const answerFeature = await countryFeatureAt(answer)
    setResults((prev) => [
      ...prev,
      {
        round,
        guess: null,
        distanceKm: null,
        points: 0,
        base: 0,
        multiplier: DIFFICULTY_MULTIPLIER[round.difficulty],
        reaction: '⏰ Time ran out before you pulled the trigger.',
        guessCountry: null,
        answerCountry: answerFeature?.properties.name ?? null,
        answerRegion: answerFeature?.geometry ?? null,
      },
    ])
    setAnnouncement(describeReveal(round.name, 0, 0, null))
    setPhase('revealed')
  }, [round, answer, phase])

  // Keep the expiry handler pointing at the latest closures (same pattern as clickRef).
  useEffect(() => {
    expireRef.current = () => {
      if (expiryAction(!!guess) === 'submit') void submitGuess()
      else void timeoutRound()
    }
  }, [guess, submitGuess, timeoutRound])

  // Arm the countdown at each timed round's start; tick every 100ms; act on
  // expiry. Never arms before the player passes the start gate (#24).
  useEffect(() => {
    if (!run.timed || !started || phase !== 'guessing' || !ready || !round) return
    roundStartRef.current = Date.now()
    // Record the armed round: if the page goes away mid-clock, restore scores
    // it zero instead of granting a fresh clock for a seen place (#26).
    if (run.lockKey) {
      saveProgress(run.lockKey, {
        dateKey: run.dateKey,
        rounds: results.map(toSavedRound),
        elapsedMs,
        armedIndex: index,
      })
    }
    const deadline = Date.now() + SPEED_ROUND_SECONDS * 1000
    setRemainingMs(SPEED_ROUND_SECONDS * 1000)
    const id = window.setInterval(() => {
      const left = deadline - Date.now()
      if (left <= 0) {
        window.clearInterval(id)
        setRemainingMs(0)
        expireRef.current()
      } else {
        setRemainingMs(left)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [run.timed, run.lockKey, run.dateKey, started, phase, ready, round, index, results, elapsedMs])

  const next = useCallback(() => {
    if (index + 1 >= run.rounds.length) {
      setPhase('done')
      return
    }
    setIndex((i) => i + 1)
    setGuess(null)
    setPhase('guessing')
  }, [index, run.rounds.length])

  const restart = useCallback(() => {
    setIndex(0)
    setGuess(null)
    setResults([])
    setElapsedMs(0)
    setRemainingMs(null)
    setStarted(initialStarted(!!run.timed))
    setPhase('guessing')
  }, [run.timed])

  // Persist in-flight progress after each completed round, so a refresh
  // resumes the run instead of restarting the seed (#26).
  useEffect(() => {
    if (!run.lockKey || phase === 'done' || playedEarlier || saved) return
    if (results.length === 0) return
    saveProgress(run.lockKey, {
      dateKey: run.dateKey,
      rounds: results.map(toSavedRound),
      elapsedMs,
      armedIndex: null,
    })
  }, [run.lockKey, run.dateKey, phase, playedEarlier, saved, results, elapsedMs])

  // Persist a freshly-completed lockable run (daily / speed) to the browser.
  useEffect(() => {
    if (phase !== 'done' || !run.lockKey || playedEarlier || saved) return
    if (results.length !== run.rounds.length) return
    const data: SavedDaily = {
      dateKey: run.dateKey,
      total: results.reduce((sum, r) => sum + r.points, 0),
      rounds: results.map(toSavedRound),
      ...(run.timed ? { elapsedMs } : {}),
    }
    saveLocked(data, run.lockKey)
    clearProgress(run.lockKey)
    setSaved(data)
  }, [phase, run.lockKey, run.dateKey, run.timed, run.rounds.length, playedEarlier, saved, results, elapsedMs])

  const total = results.reduce((sum, r) => sum + r.points, 0)
  const lastResult = results[results.length - 1]

  // Versus challenge (#27): the challenged player sees the score to beat from
  // round 1, plus the opponent's pace through the same number of rounds.
  const challengeTotal =
    opponentBases ? totalFromBases(opponentBases, run.rounds) : null
  const opponentPace =
    opponentBases ? opponentRunningTotal(opponentBases, run.rounds, results.length) : null

  const maxPossible = run.rounds.reduce(
    (s, r) => s + 100 * DIFFICULTY_MULTIPLIER[r.difficulty],
    0,
  )
  // Final total + a one-line verdict, computed once per (stable) score so it
  // doesn't reshuffle on every results-screen re-render (e.g. the Share button).
  const finalTotal = saved ? saved.total : total
  const verdict = useMemo(
    () => pickVerdict(maxPossible ? Math.round((finalTotal / maxPossible) * 100) : 0),
    [finalTotal, maxPossible],
  )

  // Streaks & stats (#32): aggregated from this browser's saved results for
  // the dated modes. `saved` in the deps recomputes after today's run is
  // written, so the fresh game counts itself.
  const statsMode: 'daily' | 'speed' | null =
    run.mode === 'daily' ? 'daily' : run.timed && run.lockKey ? 'speed' : null
  const stats: DailyStats | null = useMemo(
    () => (phase === 'done' && statsMode ? loadStats(statsMode, run.dateKey) : null),
    [phase, statsMode, run.dateKey, saved], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (phase === 'done') {
    // Render from saved data when present (prior play), else from the live run.
    const summary: SavedRound[] = saved ? saved.rounds : results.map(toSavedRound)
    const isDaily = run.mode === 'daily'
    // Every mode shares (#31): dated heading for daily/speed, titled for the
    // rest; speed includes the run time (from the save on locked replays).
    const timedMs = run.timed ? (saved?.elapsedMs ?? elapsedMs) : 0
    const shareText = formatRunShare(
      shareHeading(runKind(run), run.title, run.dateKey),
      summary.map((s) => s.base),
      finalTotal,
      shareUrlFromLocation(),
      run.timed && timedMs > 0 ? formatDuration(timedMs) : null,
      stats ? streakText(stats.currentStreak) : null,
    )

    const onShare = async () => {
      // Native share sheet where it's the norm (touch devices); clipboard elsewhere.
      const coarse =
        typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
      if (sharePlan(typeof navigator.share === 'function', coarse) === 'native') {
        try {
          await navigator.share({ text: shareText })
          return
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return
          /* fall through to the clipboard */
        }
      }
      try {
        await navigator.clipboard.writeText(shareText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        setCopied(false)
      }
    }

    // Versus (#5): compare against the challenger's linked scores and offer a
    // challenge link carrying this run's seed + our bases.
    const isVersus = !!run.versusSeed
    const theirTotal =
      isVersus && opponentBases ? totalFromBases(opponentBases, run.rounds) : null
    const outcome = theirTotal !== null ? versusOutcome(finalTotal, theirTotal) : null
    const onChallenge = async () => {
      if (!run.versusSeed) return
      const url = challengeUrl(
        window.location.origin,
        run.versusSeed,
        summary.map((s) => s.base),
      )
      try {
        await navigator.clipboard.writeText(formatChallengeShare(finalTotal, url))
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        setCopied(false)
      }
    }

    return (
      <div className="gg-done">
        <h1>
          {playedEarlier
            ? isVersus
              ? 'Your result for this challenge'
              : "Today's result"
            : 'Final score'}
        </h1>
        <p className="gg-total">
          <CountUp value={finalTotal} />
          <span className="gg-outof"> / {maxPossible}</span>
        </p>
        <p className="gg-verdict">{verdict}</p>
        {run.timed && timedMs > 0 && (
          <p className="gg-time-total">Total time: {formatDuration(timedMs)}</p>
        )}
        {outcome && (
          <p className={`gg-versus-banner gg-versus-${outcome.result}`}>{outcome.message}</p>
        )}
        {/* Wordle-style stats strip for the dated modes (#32). */}
        {stats && stats.played > 0 && (
          <div className="gg-stats">
            <span className="gg-stat">
              <strong>{stats.currentStreak}</strong> streak 🔥
            </span>
            <span className="gg-stat">
              <strong>{stats.maxStreak}</strong> best streak
            </span>
            <span className="gg-stat">
              <strong>{stats.played}</strong> played
            </span>
            <span className="gg-stat">
              <strong>{stats.best}</strong> best
            </span>
            <span className="gg-stat">
              <strong>{stats.average}</strong> avg
            </span>
          </div>
        )}
        <ul className="gg-summary">
          {summary.map((r, i) => (
            <li key={i} className="gg-summary-item" style={{ '--i': i } as CSSProperties}>
              <div className="gg-summary-row">
                <span className="gg-city">{r.name}</span>
                <span className="gg-dist">
                  {r.distanceKm === null ? '—' : `${Math.round(r.distanceKm).toLocaleString()} km`}
                </span>
                <span className="gg-base">
                  {r.base}/100 ×{r.multiplier}
                </span>
                <span className="gg-pts">+{r.points}</span>
                {opponentBases && run.rounds[i] && (
                  <span className="gg-opp">
                    them: +{pointsFromBase(opponentBases[i], run.rounds[i])}
                  </span>
                )}
              </div>
              {run.rounds[i]?.fact && (
                <p className="gg-summary-fact">{run.rounds[i].fact}</p>
              )}
            </li>
          ))}
        </ul>

        {isVersus && (
          <div className="gg-share">
            <button className="gg-btn gg-btn-primary" onClick={onChallenge}>
              {copied ? 'Copied!' : outcome ? 'Rechallenge' : 'Challenge a friend'}
            </button>
            <p className="gg-comeback">
              Send the link — they play the exact same five places.
            </p>
          </div>
        )}
        {!isVersus && (
          <div className="gg-share">
            <pre className="gg-share-text">{shareText}</pre>
            <button className="gg-btn gg-btn-primary" onClick={onShare}>
              {copied ? 'Copied!' : 'Share result'}
            </button>
            {isDaily && <p className="gg-comeback">Come back tomorrow for a new daily.</p>}
          </div>
        )}
        {/* Locked runs (daily, speed) never replay; versus rechallenges instead (#21). */}
        {!isDaily && !isVersus && !run.lockKey && (
          <button className="gg-btn gg-btn-primary" onClick={restart}>
            Play again
          </button>
        )}
        {run.timed && run.lockKey && (
          <>
            <p className="gg-comeback">Come back tomorrow for a new speed run.</p>
            <Link className="gg-btn gg-btn-primary gg-btn-anchor" href="/speed/practice">
              Practice run (unranked)
            </Link>
          </>
        )}
        <nav className="gg-nav">
          <Link className="gg-nav-link" href="/">
            Main menu
          </Link>
          {otherGameLinks(runKind(run)).map((l) => (
            <Link key={l.href} className="gg-nav-link" href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    )
  }

  return (
    <div className="gg-root">
      <div className="gg-globe" ref={wrapRef}>
        {!ready && <div className="gg-loading">Loading globe…</div>}
        {/* Crosshair marking where Enter will place the guess; visible while
            the map has keyboard focus (#30). */}
        <div className="gg-crosshair" aria-hidden="true" />
      </div>
      <p id="gg-kb-help" className="gg-sr-only">
        {KEYBOARD_HELP}
      </p>
      <div className="gg-sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <div className="gg-hud">
        <div>
          <div className="gg-top">
            <span className="gg-run-title">{run.title}</span>
            <span className="gg-progress">
              Round {index + 1} / {run.rounds.length} ·{' '}
              {challengeTotal !== null ? `You ${total} · Them ${opponentPace}` : `Score ${total}`}
            </span>
          </div>
          {/* Challenge context (#27): the score to beat, on screen from round 1. */}
          {challengeTotal !== null && (
            <div className="gg-challenge-banner">{challengeBannerText(challengeTotal)}</div>
          )}
        </div>

        {/* Start gate (#24): the clock — and the round's place name — hold until
            the player is ready. Round 1 must never burn while tiles load. */}
        {phase === 'guessing' && round && showStartGate(!!run.timed, started) && (
          <div className="gg-panel">
            <div className="gg-prompt">
              {run.rounds.length} places · {SPEED_ROUND_SECONDS}s each
            </div>
            <div className="gg-hint">
              The clock starts when you do. Ready?
            </div>
            <button
              className="gg-btn gg-btn-primary"
              disabled={!ready}
              onClick={() => setStarted(true)}
            >
              {ready ? 'Start run' : 'Loading globe…'}
            </button>
            {/* Ranked run gate offers the unranked trainer (#33). */}
            {run.lockKey && (
              <p className="gg-gate-alt">
                One attempt today counts —{' '}
                <Link href="/speed/practice">or warm up with a practice run</Link>
              </p>
            )}
          </div>
        )}

        {phase === 'guessing' && round && !showStartGate(!!run.timed, started) && (
          <div className="gg-panel">
            {run.timed && remainingMs !== null && (
              <div className={`gg-timer${remainingMs < 5000 ? ' gg-timer-low' : ''}`}>
                {Math.ceil(remainingMs / 1000)}s
              </div>
            )}
            {round.clue ? (
              <>
                <div className="gg-prompt">
                  Where did this happen?
                  <span className={`gg-diff gg-diff-${round.difficulty}`}>
                    {round.difficulty} ×{DIFFICULTY_MULTIPLIER[round.difficulty]}
                  </span>
                </div>
                <p className="gg-clue">{round.clue}</p>
              </>
            ) : (
              <div className="gg-prompt">
                Find:{' '}
                <strong>{round.country ? `${round.name}, ${round.country}` : round.name}</strong>
                <span className={`gg-diff gg-diff-${round.difficulty}`}>
                  {round.difficulty} ×{DIFFICULTY_MULTIPLIER[round.difficulty]}
                </span>
              </div>
            )}
            <div className="gg-hint">
              {guess
                ? 'Tap again to adjust, then submit.'
                : round.clue
                  ? 'Tap the globe where you think this took place.'
                  : 'Tap the globe where you think it is.'}
            </div>
            <button className="gg-btn gg-btn-primary" disabled={!guess} onClick={submitGuess}>
              Submit guess
            </button>
          </div>
        )}

        {phase === 'revealed' && lastResult && (
          <div className="gg-panel">
            <div className="gg-result">
              <span className="gg-result-city">{lastResult.round.name}</span>
              <span className="gg-result-score">
                <span className="gg-result-base">{lastResult.base} / 100</span>
                <span className="gg-result-mult">×{lastResult.multiplier}</span>
                <span className="gg-result-arrow">→</span>
                <span className="gg-result-pts">+{lastResult.points}</span>
              </span>
            </div>
            <div className="gg-result-dist">
              {lastResult.distanceKm === null
                ? 'No guess placed in time.'
                : `${Math.round(lastResult.distanceKm).toLocaleString()} km away`}
            </div>
            {lastResult.guess !== null &&
              (() => {
                const miss = describeMiss(
                  lastResult.guessCountry,
                  lastResult.answerCountry,
                  lastResult.base,
                )
                return miss ? <p className="gg-miss-country">{miss}</p> : null
              })()}
            {/* Round-by-round tension (#27): what the challenger took here. */}
            {opponentBases && round && (
              <p className="gg-opp-round">
                They scored +{pointsFromBase(opponentBases[index], round)} here · {total} to{' '}
                {opponentPace} overall
              </p>
            )}
            <p className="gg-reaction">{lastResult.reaction}</p>
            {lastResult.round.fact && <p className="gg-fact">{lastResult.round.fact}</p>}
            <button className="gg-btn gg-btn-primary" onClick={next}>
              {index + 1 >= run.rounds.length ? 'See results' : 'Next round'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
