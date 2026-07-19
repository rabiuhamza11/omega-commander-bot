# OMEGA Commander AI — Agent Specifications

## Chief Agent
- Role: Overall coordination, strategy execution, cross-agent routing
- Model: groq-llama-4-scout
- Requires Approval: No
- Tools: orchestrator, agent.route, approval.create
- Auto-execute: YES

## Strategy Agent
- Role: Business planning, market analysis, competitor research
- Model: groq-llama-4-scout
- Requires Approval: Yes
- Tools: market.analyze, swot.generate, okr.create

## Operations Agent
- Role: Workflow management, process optimization, task assignment
- Model: groq-llama-3.3-70b
- Requires Approval: Yes
- Tools: workflow.create, task.assign, process.optimize

## Finance Agent
- Role: Transaction monitoring, financial reporting, budget planning
- Model: groq-llama-4-scout
- Requires Approval: Yes
- Tools: payment.monitor, report.generate, budget.plan

## Marketing Agent
- Role: Content creation, campaign management, social media analytics
- Model: groq-llama-4-scout
- Requires Approval: Yes
- Tools: content.create, campaign.launch, analytics.view

## Sales Agent
- Role: Lead generation, proposal writing, CRM management
- Model: groq-llama-3.3-70b
- Requires Approval: Yes
- Tools: lead.generate, proposal.write, crm.update

## Support Agent
- Role: Customer communication, ticket resolution, FAQ handling
- Model: groq-llama-3.1-8b
- Requires Approval: No
- Tools: ticket.resolve, customer.reply, faq.search
- Auto-execute: YES

## Dev Agent
- Role: Code generation, deployment, monitoring
- Model: groq-llama-4-scout
- Requires Approval: Yes
- Tools: vercel.deploy, github.push, code.generate

## Security Agent
- Role: Threat detection, compliance, access control
- Model: groq-llama-3.3-70b
- Requires Approval: Yes
- Tools: security.audit, secret.scan, threat.detect
