import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../utils/current-user', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ notificacoesEmail: false, _links: { update: { href: '/users/staff-1', method: 'PATCH' } } }) }))

import Notificacoes from '../app/(dashboard)/admin/notificacoes/page'
import { json, stubApi } from './helpers-api'

beforeEach(() => { localStorage.clear(); localStorage.setItem('accessToken', 'acc') })
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('preferência de e-mail da equipe', () => {
  it('ativa e salva a preferência pelo link do usuário', async () => {
    const api = stubApi({
      'GET /notifications': () => json({ _embedded: { notifications: [] }, _links: {} }),
      'PATCH /users/staff-1': () => json({}),
    })
    render(<Notificacoes />)
    const toggle = screen.getByRole('switch', { name: 'Notificações por e-mail' })
    await waitFor(() => expect(toggle).toBeEnabled())
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    const call = api.fetchMock.mock.calls.find(([url]) => String(url).includes('/users/staff-1'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ notificacoesEmail: true })
  })
})
