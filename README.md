# 🎨 Frontend - Workflow FATEC

Guia prático para instalar e rodar a interface de usuário (Next.js) localmente.

---

## 📋 Pré-requisitos

* **Node.js** (≥ 20)
* Servidor Backend rodando localmente (por padrão na porta `3333`)

---

## 🛠️ Instalação e Execução

### 1. Preparar Variáveis de Ambiente
Navegue até a pasta do frontend e crie o arquivo `.env` baseado no `.env.example`:

```bash
cd frontend_fatecProjeto
cp .env.example .env
```

#### ⚙️ Configurações de Ambiente (`.env`):
Abra o arquivo `.env` recém-criado e configure o endereço base da sua API Backend:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3333
```

> 📌 **Atenção:** Caso seu backend esteja rodando em outra porta ou host, altere a variável `NEXT_PUBLIC_API_BASE_URL` para refletir o endereço exato do seu backend local.

---

### 2. Instalar Dependências

```bash
npm install
```

---

### 3. Iniciar o Servidor Frontend

```bash
npm run dev
```

A aplicação web estará acessível no seu navegador em `http://localhost:3000` (ou na próxima porta disponível informada no terminal, como `3001`, etc.).

---

## 🔑 Acesso ao Sistema e Testes

Após abrir a aplicação em seu navegador (ex: `http://localhost:3000`), faça login com uma das contas inicializadas pelo script de seed do backend:

### Acesso Administrador / Funcionário:
* **E-mail:** `admin@example.com`
* **Senha:** `wf-fatec2026`

### Acesso Aluno / Usuário Demo:
* **E-mail:** `joao.silva@aluno.fatec.sp.gov.br`
* **Senha:** `Fatec@2026`

> 💡 *Dica:* Para cadastrar ou redefinir usuários de teste, consulte o arquivo `prisma/seed.js` ou gerencie os dados diretamente na interface do Adminer (`http://localhost:8080`).

---

## ⚠️ Troubleshooting (Problemas Comuns)

#### 1. Erro `404 Not Found` ou `ERR_CONNECTION_REFUSED` ao conectar com a API
* **Causa:** O frontend está tentando enviar requisições para a porta incorreta ou o backend está desligado.
* **Solução:** Confirme se o backend está iniciado (`http://localhost:3333/health`). Verifique o arquivo `.env` do frontend, encerre o terminal (`Ctrl + C`) e execute `npm run dev` novamente para recarregar a variável de ambiente.

#### 2. Conflito de Porta (`Port 3000 is already in use`)
* **Causa:** A porta `3000` já está ocupada por outra aplicação.
* **Solução:** O Next.js iniciará automaticamente em uma porta alternativa (como `3001`). Lembre-se de adicionar essa nova URL (`http://localhost:3001`) na variável `CORS_ORIGIN` do backend se necessário.
