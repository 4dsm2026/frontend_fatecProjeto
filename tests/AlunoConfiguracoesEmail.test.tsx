import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../utils/current-user', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: 'aluno-1', notificacoesInApp: true, notificacoesEmail: false }) }))
vi.mock('../app/(dashboard)/aluno/_components/MobileSidebarTriggerAluno', () => ({ default: () => null }))

import ConfiguracoesAlunoPage from '../app/(dashboard)/aluno/configuracoes/page'
import { stubApi } from './helpers-api'

beforeEach(() => { localStorage.clear(); localStorage.setItem('accessToken', 'acc') })
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('configurações do aluno', () => {
  it('carrega e salva a preferência de e-mail independentemente da plataforma', async () => {
    const api = stubApi({ 'PATCH /users/aluno-1': () => new Response('{}', { status: 200 }) })
    render(<ConfiguracoesAlunoPage />)
    const email = screen.getByRole('switch', { name: 'Notificações por e-mail' })
    expect(email).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(email)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(api.keys()).toContain('PATCH /users/aluno-1'))
    expect(JSON.parse(String(api.fetchMock.mock.calls[0][1]?.body))).toEqual({ notificacoesInApp: true, notificacoesEmail: true })
  })
})
