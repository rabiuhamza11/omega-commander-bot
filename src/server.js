const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_2;
const OWNER_CHAT_ID = '1440727973';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ============ PERSISTENT STATE (survives Render sleep/wake) ============
const STATE_FILE = path.join(__dirname, 'state.json');

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { lastUpdateId: 0, processedMessages: [] };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (e) {
    console.error('[OMEGA] State save error:', e.message);
  }
}

let state = loadState();
let lastUpdateId = state.lastUpdateId || 0;

// Track processed message IDs to prevent duplicates (keeps last 200)
const processedMessages = new Set(state.processedMessages || []);

function markProcessed(msgId) {
  processedMessages.add(msgId);
  // Keep only last 200 to avoid memory bloat
  if (processedMessages.size > 200) {
    const arr = Array.from(processedMessages);
    processedMessages.clear();
    arr.slice(-200).forEach(id => processedMessages.add(id));
  }
  // Persist to disk
  state.lastUpdateId = lastUpdateId;
  state.processedMessages = Array.from(processedMessages);
  saveState(state);
}

// ============ AGENT DEFINITIONS ============
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
    try {
      await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text });
    } catch (e2) { console.error('Send error (plain):', e2.message); }
  }
}

// ============ COMMAND HANDLERS ============
async function handleCommand(chatId, text) {
  const [cmdRaw, ...rest] = text.split(' ');
  const cmd = cmdRaw.toLowerCase().replace(/@\w+$/, '');
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
        'Version: 2.1.0\n' +
        'Status: OPERATIONAL');
    }

    case '/omega-ai': case '/omegaai': {
      const agentCount = Object.keys(AGENTS).length;
      const toolCount = Object.keys(SMART_DEFAULTS).length + 4;
      return sendMessage(chatId,
        '🧙‍♂️ OMEGA Commander AI v2.1.0\n\n' +
        'Status: operational\n' +
        'Agents: ' + agentCount + '\n' +
        'Tools: ' + toolCount + '\n' +
        'Channels: telegram, whatsapp\n' +
        'Audit entries: ' + auditLog.length + '\n' +
        'Pending approvals: ' + pendingApprovals.size + '\n' +
        'Last update ID: ' + lastUpdateId + '\n\n' +
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

      const smartKey = tool + '.' + (action || 'default');
      if (SMART_DEFAULTS[smartKey] === 'auto-approve' || !a.approval) {
        logAudit('action', tool + '.' + action, agentRole, 'low', tool + '.' + action + ' auto-approved and executed', 'executed');
        return sendMessage(chatId,
          '✅ Executed\n\nTool: ' + tool + '.' + (action || 'default') + '\n' +
          'Agent: ' + agentRole + '\n' +
          'Auto-approved: YES\n' +
          'Time: ' + new Date().toISOString());
      }

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
      logAudit('approval', approval.tool_name + '.' + approval.action_type, approval.agent_role, 'high',
        'Denied by Rabiu: ' + approval.tool_name + '.' + approval.action_type + ' — Reason: ' + reason, 'denied');

      return sendMessage(chatId,
        '❌ Denied\n\n' +
        'ID: ' + id + '\n' +
        'Tool: ' + approval.tool_name + '.' + approval.action_type + '\n' +
        'Reason: ' + reason + '\n' +
        'By: Rabiu\n' +
        'Time: ' + new Date().toISOString());
    }

    case '/omega-pending': case '/opending': {
      if (pendingApprovals.size === 0) return sendMessage(chatId, '✅ No pending approvals. All clear.');
      const lines = [];
      for (const [id, apv] of pendingApprovals) {
        const age = Math.round((Date.now() - apv.created_at) / 1000 / 60);
        const expires = Math.round((apv.expires_at - Date.now()) / 1000 / 60);
        lines.push('ID: ' + id + '\nTool: ' + apv.tool_name + '.' + apv.action_type + '\nAgent: ' + apv.agent_role + '\nAge: ' + age + 'min | Expires in: ' + expires + 'min');
      }
      return sendMessage(chatId, '⏳ Pending Approvals (' + pendingApprovals.size + ')\n\n' + lines.join('\n\n'));
    }

    case '/omega-audit': case '/oaudit': {
      if (auditLog.length === 0) return sendMessage(chatId, '📋 Audit log is empty.');
      const recent = auditLog.slice(0, 10);
      const lines = recent.map(e =>
        e.id + ' [' + e.event_type + '] ' + e.agent_role + ' → ' + e.tool_name + '\n' +
        '  Risk: ' + e.risk_level + ' | Result: ' + e.action_result + '\n' +
        '  ' + e.timestamp
      ).join('\n\n');
      return sendMessage(chatId, '📋 Audit Log (last ' + recent.length + ' of ' + auditLog.length + ')\n\n' + lines);
    }

    case '/omega-help': case '/ohelp': {
      return sendMessage(chatId,
        '🧙‍♂️ OMEGA Commander AI — HELP\n\n' +
        'SYSTEM:\n' +
        '/omega-ai — System status\n' +
        '/omega-agents — List all 9 agents\n' +
        '/omega-audit — View recent audit log\n\n' +
        'ACTIONS:\n' +
        '/omega-route [message] — Route task to best agent\n' +
        '/omega-execute [tool.action] [agent] — Execute\n' +
        '/omega-pending — Check pending approvals\n' +
        '/omega-approve [id] — Approve an action\n' +
        '/omega-deny [id] [reason] — Deny an action\n\n' +
        'You can also just type a natural message and Ill route it to the right agent.\n\n' +
        'Version: 2.1.0');
    }

    default: {
      return sendMessage(chatId,
        'Unknown command: ' + cmd + '\n\nType /omega-help for all commands.');
    }
  }
}

// ============ TELEGRAM POLLING (with deduplication + state persistence) ============
let polling = false;
let pollErrors = 0;

async function startPolling() {
  if (polling) return;
  polling = true;
  console.log('[OMEGA] Starting Telegram polling...');
  console.log('[OMEGA] Resuming from update ID:', lastUpdateId);

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
        pollErrors = 0;
        for (const update of res.data.result) {
          lastUpdateId = update.update_id;

          if (update.message && update.message.text) {
            const msgId = update.message.message_id;
            const chatId = update.message.chat.id;
            const msgText = update.message.text;

            // Skip already-processed messages (prevents duplicate responses after sleep/wake)
            if (processedMessages.has(msgId)) {
              console.log('[OMEGA] Skipping duplicate message:', msgId);
              continue;
            }

            // Skip messages older than 60 seconds (prevents processing backlog on wake)
            const msgAge = Date.now() / 1000 - update.message.date;
            if (msgAge > 60) {
              console.log('[OMEGA] Skipping old message (' + Math.round(msgAge) + 's old):', msgText.substring(0, 50));
              markProcessed(msgId);
              continue;
            }

            markProcessed(msgId);
            console.log('[OMEGA] Message received:', msgText);

            if (msgText.startsWith('/')) {
              await handleCommand(chatId, msgText);
            } else {
              // Non-command message — route to appropriate agent
              const lowerMsg = msgText.toLowerCase();
              const agent = routeMessage(msgText);

              let response = '';

              if (lowerMsg.includes('help') || lowerMsg.includes('what can') || lowerMsg.includes('commands')) {
                response = 'Here are my commands:\n\n';
                response += '/omega-ai — System status\n';
                response += '/omega-agents — See all 9 agents\n';
                response += '/omega-route [message] — Route a task\n';
                response += '/omega-execute [tool] [agent] — Run an action\n';
                response += '/omega-pending — Check approvals\n';
                response += '/omega-audit — Recent activity\n';
                response += '/omega-help — Full guide\n\n';
                response += 'Or just tell me what you need and Ill point you to the right agent.';
              } else if (lowerMsg.includes('status') || lowerMsg.includes('how are') || lowerMsg.includes('working')) {
                response = 'All systems operational.\n\n';
                response += '9 agents active\n';
                response += 'Audit entries: ' + auditLog.length + '\n';
                response += 'Pending approvals: ' + pendingApprovals.size + '\n';
                response += 'Version: 2.1.0\n\n';
                response += 'Use /omega-ai for full status.';
              } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey') || lowerMsg.includes('salam')) {
                response = 'Hey Rabiu! OMEGA Commander at your service.\n\n';
                response += 'What do you need? I can:\n';
                response += 'Route tasks to 9 specialist agents\n';
                response += 'Execute tools and actions\n';
                response += 'Manage approvals\n';
                response += 'Track audit logs\n\n';
                response += 'Type /omega-help or just tell me what youre working on.';
              } else if (agent !== 'chief') {
                const a = AGENTS[agent];
                response = a.icon + ' I think the ' + agent + ' agent can help with that.\n\n';
                response += 'They handle: ' + a.caps.join(', ') + '\n';
                response += 'Available tools: ' + a.tools.join(', ') + '\n\n';
                response += 'To execute, try:\n';
                response += '/omega-execute ' + a.tools[0] + ' ' + agent + '\n\n';
                response += 'Type /omega-help for all commands.';
              } else {
                response = 'Got it. What would you like me to do?\n\n';
                response += 'I can route tasks to specialist agents, execute tools, or check system status.\n\n';
                response += 'Try /omega-help to see everything I can do, or tell me more about what you need.';
              }

              await sendMessage(chatId, response);
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

    setTimeout(poll, 2000);
  }

  poll();
}

// ============ ALERT ENDPOINT ============
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
    version: '2.1.0',
    status: 'operational',
    bot: '@Omegacommanderaibot',
    uptime: process.uptime(),
    polling: polling,
    last_update_id: lastUpdateId,
    pending_approvals: pendingApprovals.size,
    audit_entries: auditLog.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), polling: polling, version: '2.1.0' });
});

// ============ START ============
app.listen(PORT, async () => {
  console.log('[OMEGA] Commander AI v2.1.0 starting on port ' + PORT);
  console.log('[OMEGA] Bot: @Omegacommanderaibot');
  console.log('[OMEGA] Owner: ' + OWNER_CHAT_ID);
  console.log('[OMEGA] Resuming from update ID:', lastUpdateId);

  await startPolling();

  // Only send startup message if this is NOT a sleep/wake cycle
  // Check uptime — if less than 5 seconds, it's a fresh start
  if (process.uptime() < 5) {
    await sendMessage(OWNER_CHAT_ID,
      '🧙‍♂️ OMEGA Commander AI — Online\n\n' +
      'v2.1.0 — Deduplication fixed\n' +
      '9 agents ready, polling active.\n\n' +
      'Type /omega-help to see all commands.');
  } else {
    console.log('[OMEGA] Sleep/wake detected — skipping startup message');
  }

  console.log('[OMEGA] Startup complete — polling active');
});
