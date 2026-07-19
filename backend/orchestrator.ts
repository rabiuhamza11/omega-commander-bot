import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SMART_DEFAULTS: Record<string, string> = {
  'vercel.deploy:preview': 'auto-approve',
  'email.send:<10': 'auto-approve',
  'vercel.deploy:production': 'require-approval',
  'github.push:main': 'require-approval',
  'payment.send': 'require-approval',
  'secret.access': 'require-approval',
  'content.create': 'auto-approve',
  'ticket.resolve': 'auto-approve',
  'analytics.view': 'auto-approve',
  'report.generate': 'auto-approve',
};

const AGENT_ROUTES: Record<string, any> = {
  chief: { role: 'chief', capabilities: ['overall coordination', 'strategy execution'], tools: ['orchestrator', 'agent.route', 'approval.create'], requires_approval: false },
  strategy: { role: 'strategy', capabilities: ['business planning', 'market analysis'], tools: ['market.analyze', 'swot.generate', 'okr.create'], requires_approval: true },
  operations: { role: 'operations', capabilities: ['workflow management', 'process optimization'], tools: ['workflow.create', 'task.assign'], requires_approval: true },
  finance: { role: 'finance', capabilities: ['transaction monitoring', 'reporting', 'budget planning'], tools: ['payment.monitor', 'report.generate', 'budget.plan'], requires_approval: true },
  marketing: { role: 'marketing', capabilities: ['content creation', 'campaign management', 'analytics'], tools: ['content.create', 'campaign.launch', 'analytics.view'], requires_approval: true },
  sales: { role: 'sales', capabilities: ['lead generation', 'proposal writing', 'CRM'], tools: ['lead.generate', 'proposal.write', 'crm.update'], requires_approval: true },
  support: { role: 'support', capabilities: ['customer communication', 'ticket resolution'], tools: ['ticket.resolve', 'customer.reply', 'faq.search'], requires_approval: false },
  dev: { role: 'dev', capabilities: ['code generation', 'deployment', 'monitoring'], tools: ['vercel.deploy', 'github.push', 'code.generate'], requires_approval: true },
  security: { role: 'security', capabilities: ['threat detection', 'compliance', 'access control'], tools: ['security.audit', 'secret.scan', 'threat.detect'], requires_approval: true },
};

const KEYWORD_ROUTES: Record<string, string> = {
  'deploy': 'dev', 'push': 'dev', 'code': 'dev', 'github': 'dev', 'vercel': 'dev', 'render': 'dev', 'netlify': 'dev',
  'market': 'strategy', 'strategy': 'strategy', 'swot': 'strategy', 'okr': 'strategy', 'competitor': 'strategy',
  'workflow': 'operations', 'process': 'operations', 'optimize': 'operations', 'task': 'operations',
  'payment': 'finance', 'budget': 'finance', 'finance': 'finance', 'report': 'finance', 'invoice': 'finance', 'revenue': 'finance',
  'content': 'marketing', 'campaign': 'marketing', 'social': 'marketing', 'ads': 'marketing', 'marketing': 'marketing',
  'lead': 'sales', 'proposal': 'sales', 'crm': 'sales', 'sales': 'sales', 'customer': 'sales',
  'ticket': 'support', 'support': 'support', 'help': 'support', 'faq': 'support',
  'security': 'security', 'audit': 'security', 'secret': 'security', 'threat': 'security', 'vulnerability': 'security',
};

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, ...data } = body;
    const base44 = createClientFromRequest(req);

    switch (action) {
      case 'status': {
        return Response.json({
          system: 'OMEGA BUSINESS COMMANDER AI',
          version: '1.0.0',
          status: 'operational',
          agents: Object.keys(AGENT_ROUTES).length,
          tools: Object.keys(SMART_DEFAULTS).length,
          timestamp: new Date().toISOString(),
        });
      }

      case 'route': {
        const { message } = data;
        if (!message) return Response.json({ error: 'message required' });
        const lower = message.toLowerCase();
        let agent = 'chief';
        for (const [kw, role] of Object.entries(KEYWORD_ROUTES)) {
          if (lower.includes(kw)) { agent = role; break; }
        }
        const route = AGENT_ROUTES[agent];
        return Response.json({
          routed_to: agent,
          role: route.role,
          capabilities: route.capabilities,
          tools: route.tools,
          requires_approval: route.requires_approval,
        });
      }

      case 'create_approval': {
        const { tool_name, action_type, risk_level, triggered_by_agent, channel } = data;
        if (!tool_name || !action_type) return Response.json({ error: 'tool_name and action_type required' });
        const level = risk_level || 'medium';
        const ch = channel || 'telegram';

        const smartKey = `${tool_name}:${action_type}`;
        if (SMART_DEFAULTS[smartKey] === 'auto-approve') {
          return Response.json({
            status: 'auto-approved',
            tool_name, action_type, risk_level: level,
            reason: 'Smart default: auto-approve rule matched',
            executed: true,
          });
        }

        const approvalId = `APR-${Date.now().toString(36).toUpperCase()}`;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // Save to OmegaApproval entity
        try {
          await base44.entities.OmegaApproval.create({
            tool_name,
            action_type,
            payload: JSON.stringify(data.payload || {}),
            risk_level: level,
            triggered_by_agent: triggered_by_agent || 'system',
            channel: ch,
            status: 'pending',
            expires_at: expiresAt,
          });
        } catch (e) { /* entity save optional */ }

        // Log to audit
        try {
          await base44.entities.OmegaAuditLog.create({
            event_type: 'approval',
            tool_name,
            agent_role: triggered_by_agent || 'system',
            risk_level: level,
            severity: 'info',
            details: `Approval request created for ${tool_name}.${action_type}`,
          });
        } catch (e) { /* audit optional */ }

        return Response.json({
          approval_id: approvalId,
          status: 'pending',
          tool_name, action_type,
          risk_level: level,
          triggered_by_agent: triggered_by_agent || 'system',
          channel: ch,
          expires_at: expiresAt,
          message: `Approval required for ${tool_name}.${action_type} (risk: ${level}). Sent to ${ch}.`,
        });
      }

      case 'check_approval': {
        const { approval_id } = data;
        if (!approval_id) return Response.json({ error: 'approval_id required' });
        return Response.json({
          approval_id,
          status: 'pending',
          message: 'Approval still pending.',
        });
      }

      case 'approve': {
        const { approval_id, approved_by } = data;
        if (!approval_id) return Response.json({ error: 'approval_id required' });

        try {
          await base44.entities.OmegaAuditLog.create({
            event_type: 'approval',
            tool_name: 'approval.system',
            agent_role: 'chief',
            risk_level: 'low',
            severity: 'info',
            details: `Approval ${approval_id} approved by ${approved_by || 'owner'}`,
            action_result: 'approved',
          });
        } catch (e) { /* */ }

        return Response.json({
          approval_id,
          status: 'approved',
          approved_by: approved_by || 'owner',
          approved_at: new Date().toISOString(),
          message: 'Action approved. Executing now.',
        });
      }

      case 'deny': {
        const { approval_id, denied_by, reason } = data;
        if (!approval_id) return Response.json({ error: 'approval_id required' });

        try {
          await base44.entities.OmegaAuditLog.create({
            event_type: 'approval',
            tool_name: 'approval.system',
            agent_role: 'chief',
            risk_level: 'low',
            severity: 'warning',
            details: `Approval ${approval_id} denied by ${denied_by || 'owner'}: ${reason || 'not specified'}`,
            action_result: 'denied',
          });
        } catch (e) { /* */ }

        return Response.json({
          approval_id,
          status: 'denied',
          denied_by: denied_by || 'owner',
          reason: reason || 'Not specified',
          denied_at: new Date().toISOString(),
        });
      }

      case 'list_approvals': {
        const { status } = data;
        try {
          const query = status ? { status } : {};
          const approvals = await base44.entities.OmegaApproval.list({ filter: query, limit: 20 });
          return Response.json({ approvals, count: approvals.length });
        } catch (e) {
          return Response.json({ pending: 0, message: 'No approvals found.' });
        }
      }

      case 'list_agents': {
        try {
          const agents = await base44.entities.OmegaAgentRegistry.list({ limit: 20 });
          return Response.json({ total_agents: agents.length, agents });
        } catch (e) {
          const agents = Object.entries(AGENT_ROUTES).map(([role, route]) => ({
            role,
            capabilities: route.capabilities,
            tools: route.tools,
            requires_approval: route.requires_approval,
            status: 'active',
          }));
          return Response.json({ total_agents: agents.length, agents, source: 'static' });
        }
      }

      case 'execute': {
        const { tool_name, action_type, agent_role } = data;
        if (!tool_name) return Response.json({ error: 'tool_name required' });

        const route = agent_role ? AGENT_ROUTES[agent_role] : null;
        const needsApproval = route ? route.requires_approval : true;

        if (needsApproval) {
          const smartKey = `${tool_name}:${action_type}`;
          if (SMART_DEFAULTS[smartKey] === 'auto-approve') {
            // Log execution
            try {
              await base44.entities.OmegaAuditLog.create({
                event_type: 'action',
                tool_name,
                agent_role: agent_role || 'auto',
                risk_level: 'low',
                severity: 'info',
                details: `${tool_name}.${action_type} auto-approved and executed`,
                action_result: 'executed',
              });
            } catch (e) { /* */ }

            return Response.json({
              status: 'executed',
              tool_name, action_type,
              agent: agent_role || 'auto',
              auto_approved: true,
              timestamp: new Date().toISOString(),
            });
          }

          return Response.json({
            status: 'approval_required',
            tool_name, action_type,
            agent: agent_role || 'unknown',
            message: 'This action requires owner approval. Use create_approval to initiate.',
          });
        }

        // No approval needed
        try {
          await base44.entities.OmegaAuditLog.create({
            event_type: 'action',
            tool_name,
            agent_role: agent_role || 'auto',
            risk_level: 'low',
            severity: 'info',
            details: `${tool_name}.${action_type} executed (no approval required)`,
            action_result: 'executed',
          });
        } catch (e) { /* */ }

        return Response.json({
          status: 'executed',
          tool_name, action_type,
          agent: agent_role || 'auto',
          auto_approved: true,
          timestamp: new Date().toISOString(),
        });
      }

      case 'audit_log': {
        try {
          const logs = await base44.entities.OmegaAuditLog.list({ limit: 50, sort: '-created_date' });
          return Response.json({ logs, count: logs.length });
        } catch (e) {
          return Response.json({ logs: [], message: 'No audit logs yet.' });
        }
      }

      default:
        return Response.json({
          error: 'Unknown action',
          available: ['status', 'route', 'create_approval', 'check_approval', 'approve', 'deny', 'list_approvals', 'list_agents', 'execute', 'audit_log'],
        });
    }
  } catch (err: any) {
    return Response.json({ error: err.message, system: 'OMEGA COMMANDER' });
  }
});
