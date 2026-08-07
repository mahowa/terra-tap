import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import AuthPanel from '@/components/AuthPanel'

/**
 * Issue #65: creating an account failed with "The following field is invalid:
 * email" — and the address in the error wasn't the one the player typed. Both
 * halves are covered here: what the panel *sends* comes from the form itself
 * (so a browser-filled value can't diverge from a stale React mirror), and what
 * it *shows* is the server's real reason.
 */

const jsonResponse = (status: number, body: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

const duplicateEmail = {
  errors: [
    {
      name: 'ValidationError',
      data: {
        collection: 'users',
        errors: [
          { message: 'A user with the given email is already registered.', path: 'email' },
        ],
      },
      message: 'The following field is invalid: email',
    },
  ],
}

let fetchMock: ReturnType<typeof vi.fn>

/** The panel reloads the page on success; jsdom can't, so stub it out. */
const stubReload = () => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  })
}

const field = (label: RegExp): HTMLInputElement => screen.getByLabelText(label) as HTMLInputElement

/** Type into a field the way a player does — React sees every keystroke. */
const type = (label: RegExp, value: string) => fireEvent.change(field(label), { target: { value } })

/**
 * Fill a field the way a browser's saved-credential autofill does: the DOM
 * value changes with no React change event behind it.
 */
const autofill = (label: RegExp, value: string) => {
  field(label).value = value
}

const submitForm = () => {
  const form = document.querySelector('form.ac-form') as HTMLFormElement
  fireEvent.submit(form)
}

const bodyOf = (call: unknown[]): Record<string, string> =>
  JSON.parse((call[1] as RequestInit).body as string)

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse(200, {}))
  vi.stubGlobal('fetch', fetchMock)
  stubReload()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const openSignup = () => fireEvent.click(screen.getByRole('tab', { name: /create account/i }))

describe('AuthPanel sign-up (#65)', () => {
  it('sends the address that is actually in the form, not a stale mirror', async () => {
    render(React.createElement(AuthPanel))
    openSignup()
    type(/email/i, 'typed@example.com')
    type(/password/i, 'longenough')
    // The browser then fills its saved credentials over the top.
    autofill(/email/i, 'saved@example.com')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(bodyOf(fetchMock.mock.calls[0]).email).toBe('saved@example.com')
  })

  it('signs up with a purely autofilled form (no React change events at all)', async () => {
    render(React.createElement(AuthPanel))
    openSignup()
    autofill(/email/i, 'player@example.com')
    autofill(/password/i, 'longenough')
    autofill(/display name/i, 'howa')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/users')
    expect(init.method).toBe('POST')
    expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({
      email: 'player@example.com',
      password: 'longenough',
      displayName: 'howa',
    })
  })

  it('normalizes the address so the follow-up login matches it', async () => {
    render(React.createElement(AuthPanel))
    openSignup()
    type(/email/i, '  Player@Example.COM ')
    type(/password/i, 'longenough')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(bodyOf(fetchMock.mock.calls[0]).email).toBe('player@example.com')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/login')
    expect(bodyOf(fetchMock.mock.calls[1]).email).toBe('player@example.com')
  })

  it('shows the server’s real reason when the address is taken', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, duplicateEmail))
    render(React.createElement(AuthPanel))
    openSignup()
    type(/email/i, 'player@example.com')
    type(/password/i, 'longenough')
    submitForm()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/already has an account/i)
    expect(alert.textContent).not.toMatch(/following field is invalid/i)
    // And a one-click way out of it.
    expect(screen.getByRole('button', { name: /sign in instead/i })).toBeTruthy()
    // No login attempt after a failed sign-up.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('switches to sign-in from the taken-address error', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, duplicateEmail))
    render(React.createElement(AuthPanel))
    openSignup()
    type(/email/i, 'player@example.com')
    type(/password/i, 'longenough')
    submitForm()

    fireEvent.click(await screen.findByRole('button', { name: /sign in instead/i }))
    expect(screen.getByRole('tab', { name: /^sign in$/i }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(screen.queryByRole('alert')).toBeNull()
    // The email survives the tab switch, so the player just adds their password.
    expect(field(/email/i).value).toBe('player@example.com')
  })

  it('catches an empty or malformed address before calling the server', async () => {
    render(React.createElement(AuthPanel))
    openSignup()
    type(/password/i, 'longenough')
    submitForm()
    expect((await screen.findByRole('alert')).textContent).toMatch(/enter your email/i)

    type(/email/i, 'howa')
    submitForm()
    expect((await screen.findByRole('alert')).textContent).toMatch(/valid email/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('catches a too-short password before calling the server', async () => {
    render(React.createElement(AuthPanel))
    openSignup()
    type(/email/i, 'player@example.com')
    type(/password/i, 'short')
    submitForm()
    expect((await screen.findByRole('alert')).textContent).toMatch(/8 characters/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// Issue #73: a two-hour session signed players out between sittings, so the
// form carries a "stay signed in" toggle the login route reads.
describe('AuthPanel stay signed in (#73)', () => {
  const remember = () => screen.getByLabelText(/stay signed in/i) as HTMLInputElement

  it('is on by default', () => {
    render(React.createElement(AuthPanel))
    expect(remember().checked).toBe(true)
  })

  it('asks to be remembered when the box is left checked', async () => {
    render(React.createElement(AuthPanel))
    type(/email/i, 'player@example.com')
    type(/password/i, 'longenough')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(bodyOf(fetchMock.mock.calls[0]).remember).toBe(true)
  })

  it('asks for a browser-session sign-in when the box is cleared', async () => {
    render(React.createElement(AuthPanel))
    type(/email/i, 'player@example.com')
    type(/password/i, 'longenough')
    fireEvent.click(remember())
    expect(remember().checked).toBe(false)
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(bodyOf(fetchMock.mock.calls[0]).remember).toBe(false)
  })

  it('carries the choice through the sign-up flow', async () => {
    render(React.createElement(AuthPanel))
    openSignup()
    type(/email/i, 'player@example.com')
    type(/password/i, 'longenough')
    fireEvent.click(remember())
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/login')
    expect(bodyOf(fetchMock.mock.calls[1]).remember).toBe(false)
  })
})

describe('AuthPanel sign-in', () => {
  it('posts straight to login without creating anything', async () => {
    render(React.createElement(AuthPanel))
    type(/email/i, 'player@example.com')
    type(/password/i, 'longenough')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login')
  })

  it('reports bad credentials plainly', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { errors: [{ message: 'Unauthorized' }] }))
    render(React.createElement(AuthPanel))
    type(/email/i, 'player@example.com')
    type(/password/i, 'longenough')
    submitForm()

    expect((await screen.findByRole('alert')).textContent).toMatch(/wrong email or password/i)
  })

  it('tells a fresh account holder to sign in when the auto-login fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { doc: { id: 1 } }))
      .mockResolvedValueOnce(jsonResponse(401, { errors: [{ message: 'Unauthorized' }] }))
    render(React.createElement(AuthPanel))
    openSignup()
    type(/email/i, 'player@example.com')
    type(/password/i, 'longenough')
    submitForm()

    expect((await screen.findByRole('alert')).textContent).toMatch(/account created/i)
  })
})
