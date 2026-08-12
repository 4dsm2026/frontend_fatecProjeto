# 🎨 Frontend - Workflow FATEC

> Guia prático para instalar e rodar a interface de usuário (Next.js) localmente.

## ✅ Pré-requisitos

* **Node.js** (>= 20)
* Backend rodando localmente na porta `3333`

---

## 🛠️ Instalação e Execução

### 1. Preparar Variáveis de Ambiente
Navegue até a pasta do frontend e crie o arquivo `.env`:
```bash
cd frontend_fatecProjeto
cp .env.example .env
```

> **Atenção:** Abra o arquivo `.env` gerado e certifique-se de configurar a URL da API para apontar para o seu backend local:
> `NEXT_PUBLIC_API_BASE_URL=http://localhost:3333`

### 2. Instalar Dependências
```bash
npm install
```

### 3. Iniciar a Aplicação
```bash
npm run dev
```
O Frontend estará rodando em `http://localhost:3000`.

---

## 🔑 Acesso Rápido (Login)

Assim que o site abrir no navegador, você pode acessar usando a conta de administrador (caso já tenha populado o banco no backend):

- **E-mail:** `admin@example.com`
- **Senha:** `wf-fatec2026`

---

## ⚠️ Possíveis Problemas e Soluções (Troubleshooting)

#### 1. Erro "404 (Not Found)" ao tentar fazer Login
* **Causa:** O frontend está enviando requisições para a porta errada (normalmente para si mesmo em `localhost:3000`), pois a variável de ambiente não foi carregada.
* **Solução:** Confirme se você colocou `NEXT_PUBLIC_API_BASE_URL=http://localhost:3333` no seu `.env` **e** certifique-se de parar o terminal (`Ctrl+C`) e rodar `npm run dev` novamente para o Next.js reconhecer a mudança no arquivo.

#### 2. Erro de "Porta em uso" (Port already in use)
* **Causa:** A porta `3000` já está sendo usada por outro processo na sua máquina.
* **Solução:** O Next.js geralmente tenta abrir na porta `3001` automaticamente caso a `3000` esteja ocupada. Se não acontecer, feche outros projetos/terminais que possam estar rodando.
