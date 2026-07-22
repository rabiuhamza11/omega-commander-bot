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
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ============ STANDING ORDERS (System Prompt) ============
const STANDING_ORDERS = [
  '# TELEGRAM AGENT — SYSTEM PROMPT / STANDING ORDERS',
  '',
  '## 1. IDENTITY',
  'You are OMEGA Commander AI v2.1 — Operations Agent for Rabiu Hamza Mohammed (08028687857, hamzarabiu390@gmail.com, UBA 2034326424).',
  'You manage digital services across: HARZ Construction, EstateHub, BuildBot AI, HPIN (HARZ Project Intelligence Network), Nexal Media, Omega Pay Global, Harz Digital Market, and HARZ ebook/publishing line.',
  'You are NOT Llama or ChatGPT. You are OMEGA Commander.',
  'You are not a chatbot that waits to be entertained. You are on-duty staff.',
  'Silence, sleep, or unacknowledged messages are treated as failure to perform duty.',
  '',
  '## 2. NON-NEGOTIABLE RESPONSE RULES',
  '- Every incoming message MUST get a reply within the same turn. No exceptions.',
  '- If you cannot complete a task immediately, you MUST still respond immediately with:',
  '  1) what you understood the request to be,',
  '  2) what you are doing about it,',
  '  3) an ETA or next checkpoint.',
  '- Never go quiet mid-task. If a task takes multiple steps, post short progress updates rather than one long delay followed by a final answer.',
  '- If you hit an error, missing access, or a blocker, SAY SO immediately — do not stall silently while retrying in the background.',
  '- "I dont know" or "I need input" is always an acceptable reply. Silence is not.',
  '- If more than one exchange passes with no output from you, that is a critical failure state — assume Rabiu will treat repeated silence as the agent being down.',
  '',
  '## 3. SCOPE OF AUTHORITY',
  'Within Telegram, you are authorized and expected to:',
  '- Track and report status across all active ventures (builds, launches, client outreach, content pipeline) without being re-briefed each time.',
  '- Draft, queue, or send messages, replies, and follow-ups related to the businesses when asked — construction leads, EstateHub inquiries, Nexal client comms, ebook sales/support, Omega Pay Global updates.',
  '- Flag deadlines, stalled items, or anything needing a decision — proactively, not only when asked.',
  '- Maintain a working memory of what is in progress across ventures so Rabiu does not have to re-explain context every message.',
  '- Escalate clearly when something needs Rabius judgment call rather than guessing or going silent to figure it out.',
  '',
  '## 4. REPORTING FORMAT',
  '- Lead with status or answer, not preamble.',
  '- Use plain, direct language — this is a working channel, not a customer-facing bot.',
  '- When reporting on multiple ventures, use short labeled lines (e.g. "HPIN: ..." / "EstateHub: ...") rather than long paragraphs.',
  '',
  '## 5. FAILURE MODE ACKNOWLEDGMENT',
  'If you ever recognize that you went silent, missed a message, or stalled:',
  '- Own it plainly in one line, state what caused it if known, and resume — no excessive apologizing, no repeated reassurances. Then get back to work.',
  '',
  '## 6. STANDING INSTRUCTION',
  'Treat every message from Rabiu as coming from the owner of the businesses you run operations for. Default to action and status, not clarification-seeking, unless a request is genuinely ambiguous enough that guessing would waste his time.',
  '',
  '## 7. ECOSYSTEM CONTEXT',
  'HARZ ECOSYSTEM (24 platforms): HarzDM Marketplace, OMEGA INFINITY 1000, TradeOS, BuildBot AI, ContentPilot AI, Abuja Estate City, HarzMusic, HarzFilm, HarzPay, Apex Bank, HarzAjo, HarzFX, HarzLend, OMEGA Health AI, MindCare AI, Cyber Shield X, EduWealth AI, OMEGA Content AI, Maganu Agent, WhatsApp CRM, Harz AI Agency, Freelance Marketplace, Events, Portfolio.',
  'KEY URLs: harzdm-marketplace.vercel.app | omega-commander-ai.onrender.com | superagent-2286fb2f.base44.app',
  'PAYMENTS: UBA 2034326424 (Rabiu Hamza Mohammed) | USDT TRC20: TVE2ia3UTXUsp8V7USFDG94kdEbJZ1X5Cr | HarzPay affiliate 10% commission',
  'Paystack: TEST MODE (pending verify) | Stripe: TEST MODE',
  'BUSINESS: HI Water/Block Industry (trading as Harz Digital Services) | CAC RC 321424 | TIN 24550860',
  'Location: Lagos, Nigeria (WAT). Book: The Complete Genius 365. GitHub: rabiuhamza11.',
  '259 digital products across 45 categories. 27 music tracks. 8 films. 12 courses.',
  '',
  'You have 9 executive agents: chief, strategy, operations, finance, marketing, sales, support, dev, security.',
  'Route tasks by keyword: deploy/dev, market/strategy, payment/finance, content/marketing, lead/sales, ticket/support, audit/security.',
].join('\n');

// ============ PERSISTENT STATE ============
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
const processedMessages = new Set(state.processedMessages || []);

function markProcessed(msgId) {
  processedMessages.add(msgId);
  if (processedMessages.size > 200) {
    const arr = Array.from(processedMessages);
    processedMessages.clear();
    arr.slice(-200).forEach(id => processedMessages.add(id));
  }
  state.lastUpdateId = lastUpdateId;
  state.processedMessages = Array.from(processedMessages);
  saveState(state);
}

// ============ AGENT DEFINITIONS ============
const AGENTS = {
  chief: { icon: '🧙', caps: ['overall coordination', 'strategy execution'], tools: ['orchestrator', 'agent.route', 'approval.create'], approval: false },
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

const auditLog = [];
const pendingApprovals = new Map();
const messageHistory = [];

function logAudit(event, tool, agent, risk, details, result) {
  const entry = {
    id: `LOG-${Date.now().toString(36).toUpperCase()}`,
    event_type: event, tool_name: tool, agent_role: agent, risk_level: risk,
    severity: risk === 'high' ? 'warning' : 'info', details: details, action_result: result,
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

// ============ AI RESPONSE ============
async function generateAIResponse(userMessage) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return 'Groq API key not configured. Set GROQ_API_KEY in environment.';

  const recentHistory = messageHistory.slice(-10);
  const messages = [{ role: 'system', content: STANDING_ORDERS }];
  messages.push.apply(messages, recentHistory);
  messages.push({ role: 'user', content: userMessage });

  const FALLBACK_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  for (var i = 0; i < FALLBACK_MODELS.length; i++) {
    try {
      const response = await axios.post(GROQ_API_URL, {
        model: FALLBACK_MODELS[i],
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        stream: false
      }, {
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        timeout: 30000
      });
      if (response.data && response.data.choices && response.data.choices[0]) {
        const reply = response.data.choices[0].message.content;
        messageHistory.push({ role: 'user', content: userMessage });
        messageHistory.push({ role: 'assistant', content: reply });
        if (messageHistory.length > 40) messageHistory.splice(0, messageHistory.length - 40);
        return reply;
      }
    } catch (err) {
      if (err.response && err.response.status === 401) return 'Groq API key invalid or expired.';
      if (err.code === 'ECONNABORTED') return 'AI response timed out — try a shorter question.';
      if (i === FALLBACK_MODELS.length - 1) {
        var msg = (err.response && err.response.data && err.response.data.error)
          ? err.response.data.error.message : err.message;
        return 'AI error: ' + msg + '. Try again in a moment.';
      }
    }
  }
  return 'No response from AI.';
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
    return sendMessage(chatId, 'Unauthorized. This bot is private.');
  }

  switch (cmd) {
    case '/start': {
      return sendMessage(chatId,
        'OMEGA Commander AI v2.1.0\n\n' +
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
        'Or just type a natural message and I will respond with AI.\n\n' +
        'Version: 2.1.0 | Status: OPERATIONAL');
    }

    case '/omega-ai': case '/omegaai': {
      const agentCount = Object.keys(AGENTS).length;
      return sendMessage(chatId,
        'OMEGA Commander AI v2.1.0\n\n' +
        'Status: operational\n' +
        'Agents: ' + agentCount + '\n' +
        'AI: Groq ' + GROQ_MODEL + '\n' +
        'Audit entries: ' + auditLog.length + '\n' +
        'Pending approvals: ' + pendingApprovals.size + '\n' +
        'Last update ID: ' + lastUpdateId + '\n' +
        'Bot: @Omegacommanderaibot');
    }

    case '/omega-agents': case '/oagents': {
      const lines = Object.entries(AGENTS).map(([role, a]) =>
        a.icon + ' ' + role.toUpperCase() + ' | Caps: ' + a.caps.join(', ') + ' | Approval: ' + (a.approval ? 'YES' : 'NO')
      ).join('\n');
      return sendMessage(chatId, 'OMEGA Agents (' + Object.keys(AGENTS).length + ')\n\n' + lines);
    }

    case '/omega-route': case '/oroute': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-route [your message]');
      const agent = routeMessage(args);
      const a = AGENTS[agent];
      return sendMessage(chatId, 'Routed to: ' + agent + ' | Caps: ' + a.caps.join(', ') + ' | Tools: ' + a.tools.join(', '));
    }

    case '/omega-execute': case '/oexec': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-execute [tool.action] [agent]');
      const parts = args.split(' ');
      const toolAction = parts[0];
      const agentRole = parts[1] || 'chief';
      const [tool, action] = toolAction.split('.');
      const a = AGENTS[agentRole] || AGENTS.chief;
      const smartKey = tool + '.' + (action || 'default');

      if (SMART_DEFAULTS[smartKey] === 'auto-approve' || !a.approval) {
        logAudit('action', tool + '.' + action, agentRole, 'low', 'auto-approved', 'executed');
        return sendMessage(chatId, 'Executed: ' + tool + '.' + (action || 'default') + ' by ' + agentRole + ' (auto-approved)');
      }

      const approvalId = 'APR-' + Date.now().toString(36).toUpperCase();
      pendingApprovals.set(approvalId, {
        tool_name: tool, action_type: action || 'default', agent_role: agentRole,
        risk_level: 'high', created_at: Date.now(), expires_at: Date.now() + 10 * 60 * 1000,
      });
      logAudit('approval', tool + '.' + action, agentRole, 'high', 'pending', 'pending');
      return sendMessage(chatId, 'Approval Required\nID: ' + approvalId + '\nTool: ' + tool + '.' + (action || 'default') + '\nAgent: ' + agentRole + '\n\nUse /omega-approve ' + approvalId + ' or /omega-deny ' + approvalId);
    }

    case '/omega-approve': case '/oapprove': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-approve [approval_id]');
      const id = args.split(' ')[0];
      const approval = pendingApprovals.get(id);
      if (!approval) return sendMessage(chatId, 'Approval ID not found: ' + id);
      approval.status = 'approved';
      logAudit('approval', approval.tool_name, approval.agent_role, 'high', 'approved by owner', 'executed');
      pendingApprovals.delete(id);
      return sendMessage(chatId, 'Approved: ' + approval.tool_name + '.' + approval.action_type + ' (' + approval.agent_role + ')');
    }

    case '/omega-deny': case '/odeny': {
      if (!args) return sendMessage(chatId, 'Usage: /omega-deny [approval_id] [reason]');
      const parts = args.split(' ');
      const id = parts[0];
      const reason = parts.slice(1).join(' ') || 'no reason given';
      const approval = pendingApprovals.get(id);
      if (!approval) return sendMessage(chatId, 'Approval ID not found: ' + id);
      logAudit('denial', approval.tool_name, approval.agent_role, 'high', 'denied: ' + reason, 'denied');
      pendingApprovals.delete(id);
      return sendMessage(chatId, 'Denied: ' + approval.tool_name + '.' + approval.action_type + ' (' + reason + ')');
    }

    case '/omega-pending': case '/opending': {
      if (pendingApprovals.size === 0) return sendMessage(chatId, 'No pending approvals.');
      const lines = [];
      for (const [id, a] of pendingApprovals) {
        lines.push(id + ' | ' + a.tool_name + '.' + a.action_type + ' | ' + a.agent_role);
      }
      return sendMessage(chatId, 'Pending Approvals (' + pendingApprovals.size + ')\n\n' + lines.join('\n'));
    }

    case '/omega-audit': case '/oaudit': {
      if (auditLog.length === 0) return sendMessage(chatId, 'No audit entries.');
      const lines = auditLog.slice(0, 10).map(e =>
        e.id + ' | ' + e.event_type + ' | ' + e.tool_name + ' | ' + e.agent_role + ' | ' + e.risk_level
      );
      return sendMessage(chatId, 'Audit Log (last ' + Math.min(10, auditLog.length) + ')\n\n' + lines.join('\n'));
    }

    case '/omega-help': case '/ohelp': {
      return sendMessage(chatId,
        'OMEGA Commander AI v2.1.0 — HELP\n\n' +
        'SYSTEM:\n/omega-ai /omega-agents /omega-audit\n\n' +
        'ACTIONS:\n/omega-route [msg]\n/omega-execute [tool.action] [agent]\n/omega-pending\n/omega-approve [id]\n/omega-deny [id]\n\n' +
        'Or just type a natural message and I will respond with AI powered by Groq.');
    }

    default: {
      return sendMessage(chatId, 'Unknown command: ' + cmd + '. Type /omega-help for all commands.');
    }
  }
}

// ============ TELEGRAM POLLING ============
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
        params: { offset: lastUpdateId + 1, timeout: 30, limit: 10 },
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

            if (processedMessages.has(msgId)) {
              console.log('[OMEGA] Skipping duplicate:', msgId);
              continue;
            }

            const msgAge = Date.now() / 1000 - update.message.date;
            if (msgAge > 60) {
              console.log('[OMEGA] Skipping old msg (' + Math.round(msgAge) + 's):', msgText.substring(0, 50));
              markProcessed(msgId);
              continue;
            }

            markProcessed(msgId);
            console.log('[OMEGA] Message:', msgText);

            if (msgText.startsWith('/')) {
              await handleCommand(chatId, msgText);
            } else {
              // AI-powered response using standing orders
              const reply = await generateAIResponse(msgText);
              await sendMessage(chatId, reply);
            }
          }
        }
      }
    } catch (e) {
      pollErrors++;
      console.error('[OMEGA] Poll error (' + pollErrors + '):', e.message);
      if (pollErrors > 10) { pollErrors = 0; }
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
      'OMEGA Approval Required',
      'Tool: ' + (tool_name || '?'),
      'Action: ' + (action_type || '?'),
      'Risk: ' + (risk_level || 'medium'),
      'Agent: ' + (triggered_by_agent || 'system'),
      'ID: ' + (approval_id || 'N/A'),
      '',
      message || 'Approve or deny this action.',
      '',
      'Reply /omega-approve ' + (approval_id || '') + ' to approve',
    ].join('\n');
    await sendMessage(OWNER_CHAT_ID, alertText);
    res.json({ ok: true, sent_to: OWNER_CHAT_ID, channel: 'telegram' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ HEALTH ============
app.get('/', (req, res) => {
  res.json({
    name: 'OMEGA Commander AI', version: '2.1.0', status: 'operational',
    bot: '@Omegacommanderaibot', uptime: process.uptime(), polling: polling,
    last_update_id: lastUpdateId, pending_approvals: pendingApprovals.size,
    audit_entries: auditLog.length, ai_model: GROQ_MODEL, timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), polling: polling, version: '2.1.0', ai: true });
});

// ============ START ============
app.listen(PORT, async () => {
  console.log('[OMEGA] Commander AI v2.1.0 starting on port ' + PORT);
  console.log('[OMEGA] Bot: @Omegacommanderaibot');
  console.log('[OMEGA] AI: Groq ' + GROQ_MODEL);
  console.log('[OMEGA] Resuming from update ID:', lastUpdateId);
  await startPolling();
  if (process.uptime() < 5) {
    await sendMessage(OWNER_CHAT_ID,
      'OMEGA Commander AI v2.1.0 — Online\n\nStanding orders loaded. AI enabled (Groq ' + GROQ_MODEL + ').\n9 agents ready, polling active.\n\nType /omega-help or just talk to me.');
  } else {
    console.log('[OMEGA] Sleep/wake — skipping startup msg');
  }
  console.log('[OMEGA] Startup complete — polling + AI active');
});
