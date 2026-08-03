import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Issue #68: the results screen was a fixed, scrollable flex column that
 * centered its content. When the summary is taller than the viewport, centering
 * pushes the first children *above* the scroll origin — scrollTop 0 is already
 * past them — so the "Final score" heading was cut off with no way to scroll up
 * to it. The column now starts at the top and centers with auto margins, which
 * collapse when the content overflows.
 *
 * jsdom doesn't do layout, so the behavior itself is verified in a browser (the
 * heading sat 80px above the card's top edge before the fix, at the padding
 * edge after). What's guarded here is the rule that caused it.
 */

// Comments stripped: they discuss the very declarations asserted against below.
const css = readFileSync(join(process.cwd(), 'src/app/(frontend)/play/play.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declaration block of a rule, by exact selector. */
function block(selector: string): string {
  const at = css.indexOf(`${selector} {`)
  if (at === -1) throw new Error(`no rule for ${selector}`)
  return css.slice(at, css.indexOf('}', at))
}

describe('results screen scrolling (#68)', () => {
  it('scrolls: the card is a scroll container', () => {
    expect(block('.gg-done')).toMatch(/overflow-y:\s*auto/)
  })

  it('never centers the overflowing column, which hides the top of it', () => {
    const rule = block('.gg-done')
    expect(rule).not.toMatch(/justify-content:\s*center/)
    expect(rule).toMatch(/justify-content:\s*flex-start/)
  })

  it('still centers a short result with auto margins that collapse on overflow', () => {
    expect(block('.gg-done > :first-child')).toMatch(/margin-top:\s*auto/)
    expect(block('.gg-done > :last-child')).toMatch(/margin-bottom:\s*auto/)
  })

  it('does not reintroduce the short-viewport-only workaround', () => {
    // The old fix only straightened the column under `max-height: 760px`, so
    // taller viewports with long summaries still clipped the heading.
    expect(css).not.toMatch(/@media[^{]*max-height:\s*760px[^}]*\{\s*\.gg-done/)
  })
})
