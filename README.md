# HelpDesk API (backend)

API do Sistema de Gerenciamento de Chamados com três perfis: **Admin**, **Técnico** e **Cliente**.

**Stack:** Node.js, Express 5, TypeScript, PostgreSQL, Prisma, Zod, JWT, Jest, Docker.

**Deploy:** [https://helpdesk-api-1-mstu.onrender.com](https://helpdesk-api-1-mstu.onrender.com) · Front-end: [https://helpdesk-web-inky.vercel.app](https://helpdesk-web-inky.vercel.app)

## Rodando localmente

Requisitos: Node 20+ e PostgreSQL (ou Docker).

```bash
# 1. Banco de dados (opcional, via Docker)
docker compose up -d db

# 2. Backend
cp .env.example .env
npm install
npx prisma migrate deploy   # ou: npm run prisma:migrate
npm run seed
npm run dev                 # http://localhost:3333
```

Tudo em Docker: `docker compose up --build` (a API sobe na porta 3333; rode o seed com `docker compose exec api npx tsx prisma/seed.ts`).

## Contas criadas pelo seed (senha `123456`)

| Perfil | E-mail | Horário |
|---|---|---|
| Admin | admin@helpdesk.com | - |
| Técnico 1 | tecnico1@helpdesk.com | 08-12 e 14-18 |
| Técnico 2 | tecnico2@helpdesk.com | 10-14 e 16-20 |
| Técnico 3 | tecnico3@helpdesk.com | 12-16 e 18-22 |
| Cliente | cliente@helpdesk.com | - |

Além de 9 serviços de exemplo. Clientes também podem se cadastrar em `/auth/register`.

## Testes

```bash
npm test
```

## Endpoints

Todos exigem `Authorization: Bearer <token>`, exceto login/registro.

| Método | Rota | Quem |
|---|---|---|
| POST | /auth/login, /auth/register | público (registro cria Cliente) |
| GET/PUT/DELETE | /me | todos (DELETE só Cliente; apaga seus chamados) |
| PUT | /me/password | todos |
| POST | /me/avatar (multipart, campo `avatar`, máx. 1MB) | todos |
| GET | /technicians, /technicians/:id/slots?date=YYYY-MM-DD | todos |
| POST/PUT | /technicians, /technicians/:id | Admin |
| GET/PUT/DELETE | /clients, /clients/:id | Admin |
| GET | /services | todos (não-admin só vê ativos) |
| POST/PUT/PATCH | /services, /services/:id, /services/:id/deactivate | Admin |
| GET | /tickets, /tickets/:id | Admin (todos), Técnico (seus), Cliente (seus) |
| POST | /tickets | Cliente |
| PATCH | /tickets/:id/status | Admin, Técnico responsável |
| POST | /tickets/:id/services | Técnico responsável |

## Decisões

- Valores monetários em centavos (inteiro).
- Desativar serviço = soft delete (`active=false`); permanece nos chamados existentes.
- O chamado guarda o preço do serviço no momento da inclusão.
- O cliente escolhe técnico, data e um horário livre; o horário é validado contra a disponibilidade e conflitos.
- Foto de perfil é salva como data URL no banco (o disco do Render é efêmero).
- Senha provisória do técnico marca `mustChangePassword` até ser alterada.

## Deploy no Render

Crie um PostgreSQL e um Web Service (Docker, root `backend`). Variáveis: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (URL do front). O container executa `prisma migrate deploy` ao iniciar. Rode o seed uma vez pelo Shell do Render.
