const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_2;
const OWNER_CHAT_ID = '1440727973';
const BASE44_FUNCTION_URL = 'https://6a1e2efdc14fbb292286fb2f.base44.app/functions/omegaCommander';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ============ AGENT DEFINITIONS ============
const AGENTS = [
  { role: 'chief', icon: '🧙‍♂️', caps: ['overall coordination', 'strategy execution'], tools: ['orchestrator', 'agent.route', 'approval.create'], approval: false },
  { role: 'strategy', icon: '📊', caps: ['business planning', 'market analysis'], tools: ['market.analyze', 'swot.generate', 'okr.create'], approval: true },
  { role: 'operations', icon: '⚙️', caps: ['workflow management', 'process optimization'], tools: ['workflow.create', 'task.assign'], approval: true },
  { role: 'finance', icon: '💰', caps: ['transaction monitoring', 'reporting', 'budget planning'], tools: ['payment.monitor', 'report.generate', 'budget.plan'], approval: true },
  { role: 'marketing', icon: '📢', caps: ['content creation', 'campaign management', 'analytics'], tools: ['content.create', 'campaign.launch', 'analytics.view'], approval: true },
  { role: 'sales', icon: '📈', caps: ['lead generation', 'proposal writing', 'CRM'], tools: ['lead.generate', 'proposal.write', 'crm.update'], approval: true },
  { role: 'support', icon: '🎧', caps: ['customer communication', 'ticket resolution'], tools: ['ticket.resolve', 'customer.reply', 'faq.search'], approval: false },
  { role: 'dev', icon: '💻', caps: ['code generation', 'deployment', 'monitoring'], tools: ['vercel.deploy', 'github.push', 'code.generate'], approval: true },
  { role: 'security', icon: '🔒', caps: ['threat detection', 'compliance', 'access control'], tools: ['security.audit', 'secret.scan', 'threat.detect'], approval: true },
];

// ============ HELPER FUNCTIONS ============
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (e) {
    console.error('Send error:', e.message);
  }
}

async function callOmega(action, data = {}) {
  try {
    const res = await axios.post(BASE44_FUNCTION_URL, { action, ...data }, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });
    return res.data;
  } catch (e) {
    return { error: e.message };
  }
}

// ============ COMMAND HANDLERS ============
async function handleCommand(chatId, text) {
  const [cmdRaw, ...rest] = text.split(' ');
  const cmd = cmdRaw.toLowerCase();
  const args = rest.join(' ').trim();

  // Only respond to owner
  if (String(chatId) !== OWNER_CHAT_ID) {
    return sendMessage(chatId, '⛔ Unauthorized. This bot is private.');
  }

  switch (cmd) {
    case '/start': {
      return sendMessage(chatId, 
        `🧙‍♂️ *OMEGA Commander AI*\n\n` +
        `Standalone business orchestrator for the Harz Ecosystem.\n\n` +
        `*Commands:*\n` +
        `/omega-ai — System status\n` +
        `/omega-agents — List 9 executive agents\n` +
        `/omega-route [msg] — Route task to agent\n` +
        `/omega-execute [tool.action] [agent] — Execute\n` +
        `/omega-approve [id] — Approve action\n` +
        `/omega-deny [id] [reason] — Deny action\n` +
        `/omega-pending — Pending approvals\n` +
        `/omega-audit — Audit log\n` +
        `/omega-help — Full help\n\n` +
        `Version: 1.0.0\n` +
        `Status: ✅ OPERATIONAL`);
    }

    case '/omega-ai': case '/omegaai': {
      const r = await callOmega('status');
      if (r.error) return sendMessage(chatId, '⚠️ ' + r.error);
      return sendMessage(chatId,
        `🧙‍♂️ *OMEGA Commander AI v${r.version || '1.0'}*\n\n` +
        `Status: ${r.status || '?'}\n` +
        `Agents: ${r.agents || 0}\n` +
        `Tools: ${r.tools || 0}\n` +
        `Channels: ${(r.channels || []).join(', ')}\n\n` +
        `Independent bot — zero dependencies.`);
    }

    case '/omega-agents': case '/oagents': {
      const r = await callOmega('list_agents');
      if (r.error) return sendMessage(chatId, '⚠️ ' + r.error);
      const agents = r.agents || [];
      if (!agents.length) return sendMessage(chatId, '⚠️ No agents found.');
      const lines = agents.map(a => 
        `${a.icon || '🤖'} *${a.role}*\n` +
        `  Caps: ${(a.capabilities || []).join(', ')}\n` +
        `  Tools: ${(a.tools || []).join(', ')}\n` +
        `  Approval: ${a.requires_approval ? 'YES ⚠️' : 'NO ✅'}`
      ).join('\n\n');
      return sendMessage(chatId, `🤖 *OMEGA Agents (${r.total_agents})*\n\n${lines}`);
    }

    case '/omega-route': case '/oroute': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-route [your message or task]\nExample: /omega-route deploy my app to vercel');
      const r = await callOmega('route', { message: args });
      if (r.error) return sendMessage(chatId, '⚠️ ' + r.error);
      return sendMessage(chatId,
        `🎯 *Routed to: ${r.routed_to}*\n\n` +
        `Role: ${r.role}\n` +
        `Capabilities: ${(r.capabilities || []).join(', ')}\n` +
        `Tools: ${(r.tools || []).join(', ')}\n` +
        `Requires Approval: ${r.requires_approval ? 'YES ⚠️' : 'NO ✅'}`);
    }

    case '/omega-execute': case '/oexec': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-execute [tool.action] [agent]\nExample: /omega-execute content.create marketing');
      const parts = args.split(' ');
      const toolAction = parts[0];
      const agentRole = parts[1] || '';
      const [tool, action] = toolAction.split('.');
      const r = await callOmega('execute', { tool_name: tool, action_type: action || 'default', agent_role: agentRole });
      if (r.error) return sendMessage(chatId, '⚠️ ' + r.error);
      if (r.status === 'executed') return sendMessage(chatId,
        `✅ *Executed*\n\nTool: ${r.tool_name}.${r.action_type}\nAgent: ${r.agent}\nAuto-approved: ${r.auto_approved ? 'YES' : 'NO'}\nTime: ${r.timestamp || ''}`);
      if (r.status === 'approval_required') return sendMessage(chatId,
        `⚠️ *Approval Required*\n\nTool: ${r.tool_name}.${r.action_type}\nAgent: ${r.agent}\nRisk: ${r.risk_level}\nID: ${r.approval_id}\n\nUse /omega-approve ${r.approval_id} to approve`);
      return sendMessage(chatId, '⚠️ ' + (r.message || 'Unknown response'));
    }

    case '/omega-approve': case '/oapprove': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-approve [approval_id]');
      const r = await callOmega('approve', { approval_id: args.split(' ')[0], approved_by: 'Rabiu' });
      if (r.error) return sendMessage(chatId, '⚠️ ' + r.error);
      return sendMessage(chatId, `✅ *Approved*\n\nID: ${r.approval_id}\nBy: ${r.approved_by}\nTime: ${r.approved_at}\n\n${r.message}`);
    }

    case '/omega-deny': case '/odeny': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-deny [approval_id] [reason]');
      const parts = args.split(' ');
      const id = parts[0];
      const reason = parts.slice(1).join(' ');
      const r = await callOmega('deny', { approval_id: id, denied_by: 'Rabiu', reason });
      if (r.error) return sendMessage(chatId, '⚠️ ' + r.error);
      return sendMessage(chatId, `❌ *Denied*\n\nID: ${r.approval_id}\nBy: ${r.denied_by}\nReason: ${r.reason}\nTime: ${r.denied_at}`);
    }

    case '/omega-pending': case '/opending': {
      const r = await callOmega('list_approvals', {});
      if (r.error) return sendMessage(chatId, '⚠️ ' + r.error);
      const approvals = r.approvals || [];
      if (!approvals.length) return sendMessage(chatId, '✅ No pending approvals. System is idle.');
      const lines = approvals.map(a =>
        `ID: ${a.id || '?'}\nTool: ${a.tool_name || '?'}\nRisk: ${a.risk_level || '?'}\nAgent: ${a.triggered_by_agent || '?'}`
      ).join('\n\n');
      return sendMessage(chatId, `📋 *Pending Approvals (${approvals.length})*\n\n${lines}`);
    }

    case '/omega-audit': case '/oaudit': {
      const r = await callOmega('audit_log');
      if (r.error) return sendMessage(chatId, '⚠️ ' + r.error);
      const logs = r.logs || [];
      if (!logs.length) return sendMessage(chatId, '📋 No audit logs yet.');
      const lines = logs.slice(0, 10).map(l => `[${l.event_type}] ${l.tool_name} — ${l.details}`).join('\n');
      return sendMessage(chatId, `📋 *Audit Log (${r.count})*\n\n${lines}`);
    }

    case '/omega-help': case '/ohelp': {
      return sendMessage(chatId,
        `🧙‍♂️ *OMEGA Commander AI Commands*\n\n` +
        `/omega-ai — System status\n` +
        `/omega-agents — List 9 executive agents\n` +
        `/omega-route [msg] — Route task to agent\n` +
        `/omega-execute [tool.action] [agent] — Execute tool\n` +
        `/omega-approve [id] — Approve pending action\n` +
        `/omega-deny [id] [reason] — Deny action\n` +
        `/omega-pending — List pending approvals\n` +
        `/omega-audit — View audit log\n` +
        `/omega-help — This help\n\n` +
        `Standalone bot — no Maganu dependency.\n` +
        `Backend: Base44 omegaCommander function`);
    }

    default:
      return; // Ignore unknown commands
  }
}

// ============ TELEGRAM WEBHOOK ============
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      if (text.startsWith('/')) {
        await handleCommand(chatId, text);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.json({ ok: true }); // Always return 200 to Telegram
  }
});

// ============ APPROVAL ALERT ENDPOINT ============
app.post('/alert', async (req, res) => {
  try {
    const { tool_name, action_type, risk_level, triggered_by_agent, approval_id, message } = req.body;

    const alertText = [
      '🧙‍♂️ *OMEGA Approval Required*',
      '',
      `Tool: ${tool_name || '?'}`,
      `Action: ${action_type || '?'}`,
      `Risk: ${risk_level || 'medium'}`,
      `Agent: ${triggered_by_agent || 'system'}`,
      `ID: ${approval_id || 'N/A'}`,
      '',
      message || 'Approve or deny this action.',
      '',
      `Reply /omega-approve ${approval_id || ''} to approve`,
      `Reply /omega-deny ${approval_id || ''} to deny`,
    ].join('\n');

    await sendMessage(OWNER_CHAT_ID, alertText);
    console.log('[OMEGA] Alert sent:', tool_name, action_type);
    res.json({ ok: true, sent_to: OWNER_CHAT_ID, channel: 'telegram' });
  } catch (err) {
    console.error('[OMEGA] Alert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============ HEALTH CHECK ============
app.get('/', (req, res) => {
  res.json({
    name: 'OMEGA Commander AI',
    version: '1.0.0',
    status: 'operational',
    bot: '@Omegacommanderaibot',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ============ POLLING FALLBACK ============
// Use polling instead of webhook for simplicity on Render
let lastUpdateId = 0;
let polling = false;

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
        for (const update of res.data.result) {
          lastUpdateId = update.update_id;
          if (update.message && update.message.text && update.message.text.startsWith('/')) {
            await handleCommand(update.message.chat.id, update.message.text);
          }
        }
      }
    } catch (e) {
      console.error('[OMEGA] Poll error:', e.message);
    }

    setTimeout(poll, 1000);
  }

  poll();
}

// ============ START ============
app.listen(PORT, async () => {
  console.log(`[OMEGA] Commander AI running on port ${PORT}`);
  console.log(`[OMEGA] Bot: @Omegacommanderaibot`);
  console.log(`[OMEGA] Owner: ${OWNER_CHAT_ID}`);

  // Start polling for Telegram messages
  await startPolling();

  // Send startup message to owner
  await sendMessage(OWNER_CHAT_ID,
    '🧙‍♂️ *OMEGA Commander AI — ONLINE*\n\n' +
    'Standalone bot is now live.\n' +
    '9 executive agents ready.\n\n' +
    'Type /omega-help to see all commands.');

  console.log('[OMEGA] Startup complete');
});
