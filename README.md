# 🧙‍♂️ OMEGA Business Commander AI

> Autonomous enterprise operating system for multi-business management.

## Architecture

- **Dashboard** — Executive control center (`src/index.html`)
- **API** — REST API gateway on Base44 (`backend/orchestrator.ts`)
- **Telegram Bot** — Command interface via Maganu
- **WhatsApp Bot** — Command interface via Maganu
- **Orchestrator** — Agent routing, tool execution, approval flow
- **Vault** — Encrypted credential storage (Base44 secrets)
- **Database** — Base44 entities (OmegaApproval, OmegaAuditLog, OmegaAgentRegistry)

## 9 Executive AI Agents

| Agent | Role | Approval |
|-------|------|----------|
| 👔 Chief | Overall coordination, strategy execution | No |
| 🎯 Strategy | Business planning, market analysis | Yes |
| ⚙️ Operations | Workflow management, process optimization | Yes |
| 💰 Finance | Transaction monitoring, reporting, budget | Yes |
| 📈 Marketing | Content creation, campaign management | Yes |
| 🤝 Sales | Lead generation, proposal writing, CRM | Yes |
| 🎧 Support | Customer communication, ticket resolution | No |
| 👨‍💻 Dev | Code generation, deployment, monitoring | Yes |
| 🛡️ Security | Threat detection, compliance, access control | Yes |

## Smart Auto-Approve Rules

- `vercel.deploy:preview` → Auto-approve
- `email.send:<10` → Auto-approve
- `content.create` → Auto-approve
- `ticket.resolve` → Auto-approve
- `analytics.view` → Auto-approve
- `report.generate` → Auto-approve

## Approval Timeout Flow

| Time | Action |
|------|--------|
| T+0 | Send to owner (Telegram) |
| T+2min | Reminder on WhatsApp |
| T+5min | Escalate to deputy |
| T+10min | Mark expired |
| T+30min | SMS page if time-sensitive |

## API Endpoints

Base URL: `https://superagent-2286fb2f.base44.app/functions/omegaCommander`

| Action | Method | Description |
|--------|--------|-------------|
| status | POST | System status |
| route | POST | Route message to agent |
| create_approval | POST | Create approval request |
| check_approval | POST | Check approval status |
| approve | POST | Approve action |
| deny | POST | Deny action |
| list_approvals | POST | List pending approvals |
| list_agents | POST | List all agents |
| execute | POST | Execute tool action |
| audit_log | POST | View audit log |

## Tech Stack

- Frontend: Framework-free HTML/CSS/JS
- Backend: Base44 Deno Functions
- Database: Base44 Entities
- Bot: Telegram + WhatsApp via Maganu
- Deploy: Vercel + GitHub

## License

MIT © Harz Digital Services (RC 321424)
