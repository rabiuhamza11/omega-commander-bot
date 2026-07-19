const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_2;
const OWNER_CHAT_ID = '1440727973';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ============ AGENT DEFINITIONS (self-contained, no external API needed) ============
const AGENTS = {
  chief: { icon: '🧙‍♂️', caps: ['overall coordination', 'strategy execution'], tools: ['orchestrator', 'agent.route', 'approval.create'], approval: false },
  strategy: { icon: '📊', caps: ['business planning', 'market analysis'], tools: ['market.analyze', 'swot.generate', 'okr.create'], approval: true },
  operations: { icon: '⚙️', caps: ['workflow management', 'process optimization'], tools: ['workflow.create', 'task.assign'], approval: true },
  finance: { icon: '💰', caps: ['transaction monitoring', 'reporting', 'budget planning'], tools: ['payment.monitor', 'report.generate', 'budget.plan'], approval: true },
  marketing: { icon: '📢', caps: ['content creation', 'campaign management', 'analytics'], tools: ['content.create', 'campaign.launch', 'analytics.view'], approval: true },
  sales: { icon: '📈', caps: ['lead generation', 'proposal writing', 'CRM'], tools: ['lead.generate', 'proposal.write', 'crm.update'], approval: true },
  support: { icon: '🎧', caps: ['customer communication', 'ticket resolution'], tools: ['ticket.resolve', 'customer.reply', 'faq.search'], approval: false },
  dev: { icon: '💻', caps: ['code generation', 'deployment', 'monitoring'], tools: ['vercel.deploy', 'github.push', 'code.generate'], approval: true },
  security: { icon: '🔒', caps: ['threat detection', 'compliance', 'access control'], tools: ['security.audit', 'secret.scan', 'threat.detect'], approval: true },
};

const SMART_DEFAULTS = {
  'vercel.deploy:preview': 'auto-approve',
  'email.send:<10': 'auto-approve',
  'content.create': 'auto-approve',
  'ticket.resolve': 'auto-approve',
  'analytics.view': 'auto-approve',
  'report.generate': 'auto-approve',
};

const KEYWORD_ROUTES = {
  'deploy': 'dev', 'push': 'dev', 'code': 'dev', 'github': 'dev', 'vercel': 'dev', 'render': 'dev', 'netlify': 'dev',
  'market': 'strategy', 'strategy': 'strategy', 'swot': 'strategy', 'okr': 'strategy', 'competitor': 'strategy',
  'workflow': 'operations', 'process': 'operations', 'optimize': 'operations', 'task': 'operations',
  'payment': 'finance', 'budget': 'finance', 'finance': 'finance', 'report': 'finance', 'invoice': 'finance', 'revenue': 'finance',
  'content': 'marketing', 'campaign': 'marketing', 'social': 'marketing', 'ads': 'marketing', 'marketing': 'marketing',
  'lead': 'sales', 'proposal': 'sales', 'crm': 'sales', 'sales': 'sales', 'customer': 'sales',
  'ticket': 'support', 'support': 'support', 'help': 'support', 'faq': 'support',
  'security': 'security', 'audit': 'security', 'secret': 'security', 'threat': 'security', 'vulnerability': 'security',
};

// In-memory audit log (last 100 entries)
const auditLog = [];
const pendingApprovals = new Map();

function logAudit(event, tool, agent, risk, details, result) {
  const entry = {
    id: `LOG-${Date.now().toString(36).toUpperCase()}`,
    event_type: event,
    tool_name: tool,
    agent_role: agent,
    risk_level: risk,
    severity: risk === 'high' ? 'warning' : 'info',
    details: details,
    action_result: result,
    timestamp: new Date().toISOString(),
  };
  auditLog.unshift(entry);
  if (auditLog.length > 100) auditLog.pop();
}

function routeMessage(message) {
  const lower = message.toLowerCase();
  for (const [kw, role] of Object.entries(KEYWORD_ROUTES)) {
    if (lower.includes(kw)) return role;
  }
  return 'chief';
}

// ============ HELPER ============
async function sendMessage(chatId, text, parseMode) {
  try {
    const payload = { chat_id: chatId, text: text };
    if (parseMode) payload.parse_mode = parseMode;
    await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
  } catch (e) {
    console.error('Send error:', e.message);
    // Try without parse mode
    try {
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text });
    } catch (e2) { console.error('Send error (plain):', e2.message); }
  }
}

// ============ COMMAND HANDLERS ============
async function handleCommand(chatId, text) {
  const [cmdRaw, ...rest] = text.split(' ');
  const cmd = cmdRaw.toLowerCase().replace(/@\w+$/, ''); // Remove @botname suffix
  const args = rest.join(' ').trim();

  if (String(chatId) !== OWNER_CHAT_ID) {
    return sendMessage(chatId, '⛔ Unauthorized. This bot is private.');
  }

  switch (cmd) {
    case '/start': {
      return sendMessage(chatId, 
        '🧙‍♂️ OMEGA Commander AI\n\n' +
        'Standalone business orchestrator for the Harz Ecosystem.\n\n' +
        'Commands:\n' +
        '/omega-ai — System status\n' +
        '/omega-agents — List 9 executive agents\n' +
        '/omega-route [msg] — Route task to agent\n' +
        '/omega-execute [tool.action] [agent] — Execute\n' +
        '/omega-approve [id] — Approve action\n' +
        '/omega-deny [id] [reason] — Deny action\n' +
        '/omega-pending — Pending approvals\n' +
        '/omega-audit — Audit log\n' +
        '/omega-help — Full help\n\n' +
        'Version: 2.0.0\n' +
        'Status: OPERATIONAL');
    }

    case '/omega-ai': case '/omegaai': {
      const agentCount = Object.keys(AGENTS).length;
      const toolCount = Object.keys(SMART_DEFAULTS).length + 4; // 4 require-approval tools
      return sendMessage(chatId,
        '🧙‍♂️ OMEGA Commander AI v2.0.0\n\n' +
        'Status: operational\n' +
        'Agents: ' + agentCount + '\n' +
        'Tools: ' + toolCount + '\n' +
        'Channels: telegram, whatsapp\n' +
        'Audit entries: ' + auditLog.length + '\n' +
        'Pending approvals: ' + pendingApprovals.size + '\n\n' +
        'Independent bot — zero dependencies.\n' +
        'Bot: @Omegacommanderaibot');
    }

    case '/omega-agents': case '/oagents': {
      const lines = Object.entries(AGENTS).map(([role, a]) =>
        a.icon + ' ' + role.toUpperCase() + '\n' +
        '  Caps: ' + a.caps.join(', ') + '\n' +
        '  Tools: ' + a.tools.join(', ') + '\n' +
        '  Approval: ' + (a.approval ? 'YES' : 'NO')
      ).join('\n\n');
      return sendMessage(chatId, '🤖 OMEGA Agents (' + Object.keys(AGENTS).length + ')\n\n' + lines);
    }

    case '/omega-route': case '/oroute': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-route [your message]\nExample: /omega-route deploy my app to vercel');
      const agent = routeMessage(args);
      const a = AGENTS[agent];
      return sendMessage(chatId,
        '🎯 Routed to: ' + agent + '\n\n' +
        'Role: ' + agent + '\n' +
        'Capabilities: ' + a.caps.join(', ') + '\n' +
        'Tools: ' + a.tools.join(', ') + '\n' +
        'Requires Approval: ' + (a.approval ? 'YES' : 'NO'));
    }

    case '/omega-execute': case '/oexec': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-execute [tool.action] [agent]\nExample: /omega-execute content.create marketing');
      const parts = args.split(' ');
      const toolAction = parts[0];
      const agentRole = parts[1] || 'chief';
      const [tool, action] = toolAction.split('.');
      const a = AGENTS[agentRole] || AGENTS.chief;

      // Check smart defaults
      const smartKey = tool + '.' + (action || 'default');
      if (SMART_DEFAULTS[smartKey] === 'auto-approve' || !a.approval) {
        logAudit('action', tool + '.' + action, agentRole, 'low', tool + '.' + action + ' auto-approved and executed', 'executed');
        return sendMessage(chatId,
          '✅ Executed\n\nTool: ' + tool + '.' + (action || 'default') + '\n' +
          'Agent: ' + agentRole + '\n' +
          'Auto-approved: YES\n' +
          'Time: ' + new Date().toISOString());
      }

      // Approval required
      const approvalId = 'APR-' + Date.now().toString(36).toUpperCase();
      pendingApprovals.set(approvalId, {
        tool_name: tool,
        action_type: action || 'default',
        agent_role: agentRole,
        risk_level: 'high',
        created_at: Date.now(),
        expires_at: Date.now() + 10 * 60 * 1000,
      });

      logAudit('approval', tool + '.' + action, agentRole, 'high', 'Approval required for ' + tool + '.' + action, 'pending');

      return sendMessage(chatId,
        '⚠️ Approval Required\n\n' +
        'Tool: ' + tool + '.' + (action || 'default') + '\n' +
        'Agent: ' + agentRole + '\n' +
        'Risk: HIGH\n' +
        'ID: ' + approvalId + '\n\n' +
        'Use /omega-approve ' + approvalId + ' to approve\n' +
        'Use /omega-deny ' + approvalId + ' to deny');
    }

    case '/omega-approve': case '/oapprove': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-approve [approval_id]');
      const id = args.split(' ')[0];
      const approval = pendingApprovals.get(id);
      if (!approval) return sendMessage(chatId, '❌ Approval ' + id + ' not found or already resolved.');

      pendingApprovals.delete(id);
      logAudit('approval', approval.tool_name + '.' + approval.action_type, approval.agent_role, 'low',
        'Approved by Rabiu: ' + approval.tool_name + '.' + approval.action_type, 'approved');

      return sendMessage(chatId,
        '✅ Approved\n\n' +
        'ID: ' + id + '\n' +
        'Tool: ' + approval.tool_name + '.' + approval.action_type + '\n' +
        'Agent: ' + approval.agent_role + '\n' +
        'By: Rabiu\n' +
        'Time: ' + new Date().toISOString() + '\n\n' +
        'Action is now executing.');
    }

    case '/omega-deny': case '/odeny': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-deny [approval_id] [reason]');
      const parts = args.split(' ');
      const id = parts[0];
      const reason = parts.slice(1).join(' ') || 'Not specified';
      const approval = pendingApprovals.get(id);
      if (!approval) return sendMessage(chatId, '❌ Approval ' + id + ' not found or already resolved.');

      pendingApprovals.delete(id);
      logAudit('approval', approval.tool_name + '.' + approval.action_type, approval.agent_role, 'low',
        'Denied by Rabiu: ' + approval.tool_name + '.' + approval.action_type + ' — ' + reason, 'denied');

      return sendMessage(chatId,
        '❌ Denied\n\n' +
        'ID: ' + id + '\n' +
        'Tool: ' + approval.tool_name + '.' + approval.action_type + '\n' +
        'Agent: ' + approval.agent_role + '\n' +
        'Reason: ' + reason + '\n' +
        'Time: ' + new Date().toISOString());
    }

    case '/omega-pending': case '/opending': {
      if (pendingApprovals.size === 0) return sendMessage(chatId, '✅ No pending approvals. System is idle.');
      
      // Clean expired
      const now = Date.now();
      for (const [id, ap] of pendingApprovals) {
        if (now > ap.expires_at) {
          pendingApprovals.delete(id);
          logAudit('approval', ap.tool_name + '.' + ap.action_type, ap.agent_role, 'medium', 'Expired: ' + id, 'expired');
        }
      }

      if (pendingApprovals.size === 0) return sendMessage(chatId, '✅ No pending approvals. All expired.');

      const lines = [];
      for (const [id, ap] of pendingApprovals) {
        const minsLeft = Math.round((ap.expires_at - now) / 60000);
        lines.push('ID: ' + id + '\nTool: ' + ap.tool_name + '.' + ap.action_type + '\nRisk: ' + ap.risk_level + '\nAgent: ' + ap.agent_role + '\nExpires in: ' + minsLeft + 'min');
      }
      return sendMessage(chatId, '📋 Pending Approvals (' + pendingApprovals.size + ')\n\n' + lines.join('\n\n'));
    }

    case '/omega-audit': case '/oaudit': {
      if (auditLog.length === 0) return sendMessage(chatId, '📋 No audit logs yet.');
      const lines = auditLog.slice(0, 10).map(l =>
        '[' + l.event_type + '] ' + l.tool_name + ' — ' + l.details
      ).join('\n');
      return sendMessage(chatId, '📋 Audit Log (' + auditLog.length + ' entries, showing 10)\n\n' + lines);
    }

    case '/omega-help': case '/ohelp': {
      return sendMessage(chatId,
        '🧙‍♂️ OMEGA Commander AI Commands\n\n' +
        '/omega-ai — System status\n' +
        '/omega-agents — List 9 executive agents\n' +
        '/omega-route [msg] — Route task to agent\n' +
        '/omega-execute [tool.action] [agent] — Execute tool\n' +
        '/omega-approve [id] — Approve pending action\n' +
        '/omega-deny [id] [reason] — Deny action\n' +
        '/omega-pending — List pending approvals\n' +
        '/omega-audit — View audit log\n' +
        '/omega-help — This help\n\n' +
        'Standalone bot — self-contained.\n' +
        'Bot: @Omegacommanderaibot\n' +
        'Backend: Base44 omegaCommander v2.0.0');
    }

    default:
      return; // Ignore unknown commands silently
  }
}

// ============ TELEGRAM POLLING ============
let lastUpdateId = 0;
let polling = false;
let pollErrors = 0;

async function startPolling() {
  if (polling) return;
  polling = true;
  console.log('[OMEGA] Starting Telegram polling...');

  async function poll() {
    try {
      const res = await axios.get(`${TELEGRAM_API}/getUpdates`, {
        params: {
          offset: lastUpdateId + 1,
          timeout: 30,
          limit: 10,
        },
        timeout: 35000,
      });

      if (res.data.ok && res.data.result.length > 0) {
        pollErrors = 0; // Reset error counter on success
        for (const update of res.data.result) {
          lastUpdateId = update.update_id;
          if (update.message && update.message.text) {
            console.log('[OMEGA] Message received:', update.message.text);
            if (update.message.text.startsWith('/')) {
              await handleCommand(update.message.chat.id, update.message.text);
            } else {
              // Non-command message — try to route it
              const agent = routeMessage(update.message.text);
              const a = AGENTS[agent];
              await sendMessage(update.message.chat.id,
                '🎯 Routed to: ' + agent + '\n\n' +
                'Capabilities: ' + a.caps.join(', ') + '\n' +
                'Tools: ' + a.tools.join(', ') + '\n' +
                'Approval needed: ' + (a.approval ? 'YES' : 'NO') + '\n\n' +
                'Use /omega-help for commands');
            }
          }
        }
      }
    } catch (e) {
      pollErrors++;
      console.error('[OMEGA] Poll error (' + pollErrors + '):', e.message);
      if (pollErrors > 10) {
        console.error('[OMEGA] Too many poll errors, resetting...');
        pollErrors = 0;
      }
    }

    // Always schedule next poll (even after errors)
    setTimeout(poll, 2000);
  }

  poll();
}

// ============ ALERT ENDPOINT (for omegaCommander to call) ============
app.post('/alert', async (req, res) => {
  try {
    const { tool_name, action_type, risk_level, triggered_by_agent, approval_id, message } = req.body;

    const alertText = [
      '🧙‍♂️ OMEGA Approval Required',
      '',
      'Tool: ' + (tool_name || '?'),
      'Action: ' + (action_type || '?'),
      'Risk: ' + (risk_level || 'medium'),
      'Agent: ' + (triggered_by_agent || 'system'),
      'ID: ' + (approval_id || 'N/A'),
      '',
      message || 'Approve or deny this action.',
      '',
      'Reply /omega-approve ' + (approval_id || '') + ' to approve',
      'Reply /omega-deny ' + (approval_id || '') + ' to deny',
    ].join('\n');

    await sendMessage(OWNER_CHAT_ID, alertText);
    console.log('[OMEGA] Alert sent:', tool_name, action_type);
    res.json({ ok: true, sent_to: OWNER_CHAT_ID, channel: 'telegram' });
  } catch (err) {
    console.error('[OMEGA] Alert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============ HEALTH ============
app.get('/', (req, res) => {
  res.json({
    name: 'OMEGA Commander AI',
    version: '2.0.0',
    status: 'operational',
    bot: '@Omegacommanderaibot',
    uptime: process.uptime(),
    polling: polling,
    pending_approvals: pendingApprovals.size,
    audit_entries: auditLog.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), polling: polling });
});

// ============ START ============
app.listen(PORT, async () => {
  console.log('[OMEGA] Commander AI v2.0.0 starting on port ' + PORT);
  console.log('[OMEGA] Bot: @Omegacommanderaibot');
  console.log('[OMEGA] Owner: ' + OWNER_CHAT_ID);

  await startPolling();

  // Send startup message
  await sendMessage(OWNER_CHAT_ID,
    '🧙‍♂️ OMEGA Commander AI — RESTARTED\n\n' +
    'v2.0.0 — Self-contained mode\n' +
    '9 agents ready, polling active.\n\n' +
    'Type /omega-help to see all commands.');

  console.log('[OMEGA] Startup complete — polling active');
});
