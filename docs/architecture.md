# OMEGA Business Commander AI — Architecture

## Pattern: Microservices

### Components

1. **Dashboard** (Frontend)
   - Framework: Vanilla JS
   - Deploy: Vercel
   - Purpose: Executive control center and monitoring

2. **API** (Backend)
   - Framework: Deno (Base44 Functions)
   - Deploy: Base44
   - Purpose: REST API gateway, authentication, rate limiting

3. **Telegram Bot**
   - Framework: telegraf (via Maganu)
   - Deploy: Render
   - Purpose: Telegram command interface and approval channel

4. **WhatsApp Bot**
   - Framework: WhatsApp Web (via Magani)
   - Deploy: Base44
   - Purpose: WhatsApp command interface and approval channel

5. **Orchestrator** (Core)
   - Framework: TypeScript
   - Purpose: Agent routing, tool execution, approval flow

6. **Vault** (Security)
   - Purpose: Encrypted credential storage, MFA-gated access

7. **Database** (Storage)
   - Technology: Base44 Entities
   - Purpose: Persistent state, audit logs, agent memory

8. **Cache** (Storage)
   - Technology: Base44 built-in
   - Purpose: Session cache, approval state

## Agent Architecture

9 executive agents with keyword-based routing (upgradeable to LLM):

- Chief → coordinates all agents
- Strategy → market analysis, SWOT, OKR
- Operations → workflows, task assignment
- Finance → payments, budgets, reports
- Marketing → content, campaigns, analytics
- Sales → leads, proposals, CRM
- Support → tickets, customer replies
- Dev → deploy, push, code generation
- Security → audits, threat detection

## Approval System

States: pending → approved/denied/expired/escalated

Smart defaults allow auto-approval for low-risk actions.
High-risk actions require owner confirmation via Telegram/WhatsApp.

Timeout escalation: T+0 → T+2min → T+5min → T+10min → T+30min
