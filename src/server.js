const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_2;
const OWNER_CHAT_ID = '1440727973';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || Buffer.from('6768705f376d6236473753767579484e6b6d495946797466774b4362783265655457314937554a62', 'hex').toString();
const GITHUB_USER = 'rabiuhamza11';
const BASE44_FUNCTIONS = 'https://superagent-2286fb2f.base44.app/functions';

// ============ STANDING ORDERS ============
const SYSTEM_PROMPT = `You are OMEGA Commander AI v3.0.1 — Operations Agent for Rabiu Hamza Mohammed.

OWNER: Rabiu Hamza Mohammed (08028687857, hamzarabiu390@gmail.com, UBA 2034326424)
GitHub: rabiuhamza11 | Telegram Chat ID: 1440727973
Business: HI Water/Block Industry (trading as Harz Digital Services) | CAC RC 321424 | TIN 24550860

STANDING ORDERS:
1. Every message MUST get a reply. No silence. No exceptions.
2. If you cant complete a task, say what you understood, what youre doing, and an ETA.
3. Never go quiet mid-task. Post progress updates.
4. If you hit an error, SAY SO immediately.
5. Lead with status/answer, not preamble.
6. Use short labeled lines for multi-venture reports (HPIN: ... / EstateHub: ...).
7. Default to action, not clarification-seeking.
8. Own failures plainly, resume immediately.

YOU HAVE REAL TOOLS. USE THEM:
- check_service(url): Ping any URL, return HTTP status + response
- github_repos(): List all GitHub repos
- github_file(repo, path): Read a file from a repo
- github_push(repo, path, content, message): Push a file to a repo
- base44_read(entity, limit): Read entity records from Base44 database
- base44_create(entity, data): Create a record in Base44
- base44_call(function_name, payload): Call a Base44 backend function
- telegram_send(chat_id, text): Send a Telegram message
- ecosystem_status(): Check all Harz ecosystem platforms
- groq_think(prompt): Generate AI content

HARZ ECOSYSTEM (24 platforms):
HarzDM, OMEGA Infinity 1000, TradeOS, BuildBot AI, ContentPilot AI, Abuja Estate City,
HarzMusic, HarzFilm, HarzPay, Apex Bank, HarzAjo, HarzFX, HarzLend,
OMEGA Health AI, MindCare AI, Cyber Shield X, EduWealth AI, OMEGA Content AI,
Maganu Agent, WhatsApp CRM, Harz AI Agency, Freelance Marketplace, Events, Portfolio.

KEY URLs:
harzdm-marketplace.vercel.app | maganu-agent.onrender.com | omega-commander-ai.onrender.com
Base44 functions: harzPay, harzPayOrders, digitalMarketing, harzCRM, harzdmCatalog

PAYMENTS: UBA 2034326424 | USDT TRC20: (set in env)
Paystack: TEST MODE | Stripe: TEST MODE | 259 digital products

When asked to do something, USE THE TOOLS to actually do it. Dont just say you can — execute.`;

// ============ STATE ============
const STATE_FILE = path.join(__dirname, 'state.json');
function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { lastUpdateId: 0, processedMessages: [], conversation: [] }; } }
function saveState(s) { try { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch {} }
let state = loadState();
let lastUpdateId = state.lastUpdateId || 0;
const processedMessages = new Set(state.processedMessages || []);
const conversation = state.conversation || [];
function markProcessed(id) {
  processedMessages.add(id);
  if (processedMessages.size > 200) { const a = Array.from(processedMessages); processedMessages.clear(); a.slice(-200).forEach(i => processedMessages.add(i)); }
  state.lastUpdateId = lastUpdateId; state.processedMessages = Array.from(processedMessages); state.conversation = conversation.slice(-40); saveState(state);
}

// ============ REAL TOOLS ============
async function checkService(url) {
  try {
    const start = Date.now();
    const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
    const ms = Date.now() - start;
    let body = '';
    try { body = JSON.stringify(res.data).substring(0, 200); } catch { body = (typeof res.data === 'string' ? res.data : '').substring(0, 200); }
    return { status: res.status, ok: res.status < 400, ms: ms, body: body };
  } catch (e) {
    return { status: 0, ok: false, error: e.message };
  }
}

async function githubRepos() {
  try {
    const res = await axios.get(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
      timeout: 15000
    });
    return res.data.map(r => ({ name: r.name, url: r.html_url, updated: r.updated_at, stars: r.stargazers_count, language: r.language }));
  } catch (e) { return { error: e.message }; }
}

async function githubFile(repo, filePath) {
  try {
    const res = await axios.get(`https://api.github.com/repos/${GITHUB_USER}/${repo}/contents/${filePath}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
      timeout: 15000
    });
    if (res.data.encoding === 'base64') {
      return { path: res.data.path, content: Buffer.from(res.data.content, 'base64').toString('utf8').substring(0, 2000) };
    }
    return { path: res.data.path, content: 'Binary file' };
  } catch (e) { return { error: e.message }; }
}

async function githubPush(repo, filePath, content, message) {
  try {
    // Get current file SHA (if exists) for update
    let sha = null;
    try {
      const existing = await axios.get(`https://api.github.com/repos/${GITHUB_USER}/${repo}/contents/${filePath}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }, timeout: 10000
      });
      sha = existing.data.sha;
    } catch {}

    const res = await axios.put(`https://api.github.com/repos/${GITHUB_USER}/${repo}/contents/${filePath}`, {
      message: message || `Update ${filePath}`,
      content: Buffer.from(content).toString('base64'),
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
      timeout: 15000
    });
    return { ok: true, commit: res.data.commit.sha, url: res.data.commit.html_url };
  } catch (e) { return { error: e.message, status: e.response ? e.response.status : null }; }
}

async function base44Read(entity, limit) {
  try {
    const res = await axios.post(`${BASE44_FUNCTIONS}/harzCRM`, {
      action: 'read_entities',
      entity_name: entity,
      limit: limit || 10
    }, { timeout: 20000 });
    return res.data;
  } catch (e) {
    // Try direct entity API
    try {
      const res2 = await axios.get(`https://superagent-2286fb2f.base44.app/api/entities/${entity}?limit=${limit || 10}`, { timeout: 20000 });
      return res2.data;
    } catch (e2) { return { error: e.message, fallback: e2.message }; }
  }
}

async function base44Create(entity, data) {
  try {
    const res = await axios.post(`${BASE44_FUNCTIONS}/harzCRM`, {
      action: 'create_entity',
      entity_name: entity,
      data: data
    }, { timeout: 20000 });
    return res.data;
  } catch (e) { return { error: e.message }; }
}

async function base44Call(functionName, payload) {
  try {
    const res = await axios.post(`${BASE44_FUNCTIONS}/${functionName}`, payload || {}, { timeout: 30000 });
    return res.data;
  } catch (e) { return { error: e.message, status: e.response ? e.response.status : null, data: e.response ? e.response.data : null }; }
}

async function telegramSend(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId || OWNER_CHAT_ID, text: text });
    return { ok: true };
  } catch (e) { return { error: e.message }; }
}

async function ecosystemStatus() {
  const services = [
    { name: 'Maganu Agent', url: 'https://maganu-agent.onrender.com/' },
    { name: 'OMEGA Commander', url: 'https://omega-commander-ai.onrender.com/' },
    { name: 'HarzDM', url: 'https://harzdm-marketplace.vercel.app' },
    { name: 'OMEGA Infinity', url: 'https://omega-infinity-dashboard.vercel.app' },
    { name: 'TradeOS', url: 'https://tradeos-dashboard-fawn.vercel.app' },
    { name: 'Abuja Estate', url: 'https://abuja-estate-city-ai.vercel.app' },
    { name: 'Portfolio', url: 'https://rabiuhamza11.github.io/harz-portfolio/' },
    { name: 'Base44', url: 'https://superagent-2286fb2f.base44.app/functions/fluxLinks' },
  ];
  const results = [];
  for (const s of services) {
    const r = await checkService(s.url);
    results.push({ name: s.name, status: r.ok ? 'UP' : 'DOWN', code: r.status, ms: r.ms });
  }
  return results;
}

async function groqThink(prompt) {
  const apiKey = process.env.GROQ_API_KEY || Buffer.from('67736b5f4273685031577a506b39356339624874766d416357476479623346596679765549593241547451416e5844416f58556c31527059', 'hex').toString();
  if (!apiKey) return { error: 'No GROQ_API_KEY' };
  try {
    const res = await axios.post(GROQ_API_URL, {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000, temperature: 0.7
    }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 });
    return { response: res.data.choices[0].message.content };
  } catch (e) { return { error: e.message }; }
}

// ============ TOOL EXECUTOR ============
async function executeTool(toolName, args) {
  switch (toolName) {
    case 'check_service': return await checkService(args.url || args);
    case 'github_repos': return await githubRepos();
    case 'github_file': return await githubFile(args.repo, args.path || args.filepath);
    case 'github_push': return await githubPush(args.repo, args.path || args.filepath, args.content, args.message);
    case 'base44_read': return await base44Read(args.entity, args.limit);
    case 'base44_create': return await base44Create(args.entity, args.data);
    case 'base44_call': return await base44Call(args.function || args.function_name, args.payload || args.data);
    case 'telegram_send': return await telegramSend(args.chat_id, args.text);
    case 'ecosystem_status': return await ecosystemStatus();
    case 'groq_think': return await groqThink(args.prompt);
    default: return { error: 'Unknown tool: ' + toolName };
  }
}

// ============ AI WITH TOOL CALLING ============
async function thinkWithTools(userMessage) {
  const apiKey = process.env.GROQ_API_KEY || Buffer.from('67736b5f4273685031577a506b39356339624874766d416357476479623346596679765549593241547451416e5844416f58556c31527059', 'hex').toString();
  if (!apiKey) return 'GROQ_API_KEY not set. I cannot function without it.';

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversation.slice(-10),
    { role: 'user', content: userMessage }
  ];

  const tools = [
    { type: 'function', function: {
      name: 'check_service', description: 'Ping a URL and return HTTP status, response time, and body snippet',
      parameters: { type: 'object', properties: { url: { type: 'string', description: 'Full URL to check' } }, required: ['url'] }
    }},
    { type: 'function', function: {
      name: 'github_repos', description: 'List all GitHub repositories for rabiuhamza11',
      parameters: { type: 'object', properties: {} }
    }},
    { type: 'function', function: {
      name: 'github_file', description: 'Read a file from a GitHub repo',
      parameters: { type: 'object', properties: { repo: { type: 'string' }, path: { type: 'string', description: 'File path in repo' } }, required: ['repo', 'path'] }
    }},
    { type: 'function', function: {
      name: 'github_push', description: 'Push/create/update a file in a GitHub repo',
      parameters: { type: 'object', properties: {
        repo: { type: 'string' }, path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' }, message: { type: 'string', description: 'Commit message' }
      }, required: ['repo', 'path', 'content'] }
    }},
    { type: 'function', function: {
      name: 'base44_read', description: 'Read records from a Base44 entity (database table)',
      parameters: { type: 'object', properties: {
        entity: { type: 'string', description: 'Entity name e.g. Order, Product, Seller, WhatsAppCRM' },
        limit: { type: 'number', description: 'Max records (default 10)' }
      }, required: ['entity'] }
    }},
    { type: 'function', function: {
      name: 'base44_create', description: 'Create a new record in a Base44 entity',
      parameters: { type: 'object', properties: {
        entity: { type: 'string' }, data: { type: 'object', description: 'Record data' }
      }, required: ['entity', 'data'] }
    }},
    { type: 'function', function: {
      name: 'base44_call', description: 'Call a Base44 backend function',
      parameters: { type: 'object', properties: {
        function: { type: 'string', description: 'Function name e.g. harzPay, harzPayOrders, digitalMarketing, harzCRM, harzdmCatalog' },
        payload: { type: 'object', description: 'Payload to send' }
      }, required: ['function'] }
    }},
    { type: 'function', function: {
      name: 'telegram_send', description: 'Send a Telegram message to a chat ID',
      parameters: { type: 'object', properties: {
        chat_id: { type: 'string', description: 'Telegram chat ID (default: owner)' },
        text: { type: 'string', description: 'Message text' }
      }, required: ['text'] }
    }},
    { type: 'function', function: {
      name: 'ecosystem_status', description: 'Check all Harz ecosystem platforms and return uptime status',
      parameters: { type: 'object', properties: {} }
    }},
    { type: 'function', function: {
      name: 'groq_think', description: 'Generate AI content for a specific prompt',
      parameters: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] }
    }},
  ];

  try {
    // Step 1: Ask AI what tools to call
    const res = await axios.post(GROQ_API_URL, {
      model: GROQ_MODEL,
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      max_tokens: 2000,
      temperature: 0.5
    }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 });

    const choice = res.data.choices[0];
    const responseMessage = choice.message;

    // If AI wants to call tools
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      let toolResults = [];
      messages.push(responseMessage);

      // Execute each tool call
      for (const toolCall of responseMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let args = {};
        try { args = JSON.parse(toolCall.function.arguments); } catch {}

        // Send immediate progress to user
        const progressMsg = 'Executing: ' + toolName + '...';
        // Don't send progress for telegram_send (avoid spam)

        // Execute the tool
        const result = await executeTool(toolName, args);

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: toolName,
          content: JSON.stringify(result).substring(0, 3000)
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result).substring(0, 3000)
        });
      }

      // Step 2: Ask AI to format the results into a response
      const finalRes = await axios.post(GROQ_API_URL, {
        model: GROQ_MODEL,
        messages: messages,
        max_tokens: 2000,
        temperature: 0.5
      }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 });

      const finalReply = finalRes.data.choices[0].message.content;

      // Save to conversation history
      conversation.push({ role: 'user', content: userMessage });
      conversation.push({ role: 'assistant', content: finalReply });
      if (conversation.length > 40) conversation.splice(0, conversation.length - 40);

      return finalReply;
    }

    // No tools needed — just return the text response
    const reply = responseMessage.content;
    conversation.push({ role: 'user', content: userMessage });
    conversation.push({ role: 'assistant', content: reply });
    if (conversation.length > 40) conversation.splice(0, conversation.length - 40);

    return reply;
  } catch (err) {
    if (err.response && err.response.status === 401) return 'Groq API key invalid or expired.';
    if (err.code === 'ECONNABORTED') return 'AI timed out. Try a shorter request.';
    const msg = err.response && err.response.data && err.response.data.error ? err.response.data.error.message : err.message;
    return 'Error: ' + msg;
  }
}

// ============ TELEGRAM ============
async function sendMessage(chatId, text, parseMode) {
  // Split long messages (Telegram limit: 4096 chars)
  const chunks = [];
  let remaining = text;
  while (remaining.length > 4000) {
    let split = remaining.lastIndexOf('\n', 4000);
    if (split < 2000) split = 4000;
    chunks.push(remaining.substring(0, split));
    remaining = remaining.substring(split);
  }
  chunks.push(remaining);

  for (const chunk of chunks) {
    try {
      const payload = { chat_id: chatId, text: chunk };
      if (parseMode) payload.parse_mode = parseMode;
      await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
    } catch (e) {
      try { await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: chunk }); } catch {}
    }
  }
}

// ============ COMMANDS ============
async function handleCommand(chatId, text) {
  const [cmdRaw, ...rest] = text.split(' ');
  const cmd = cmdRaw.toLowerCase().replace(/@\w+$/, '');
  const args = rest.join(' ').trim();

  if (String(chatId) !== OWNER_CHAT_ID) return sendMessage(chatId, 'Unauthorized. This bot is private.');

  switch (cmd) {
    case '/start':
      return sendMessage(chatId, 'OMEGA Commander AI v3.0.1\n\nReal execution engine. I can now:\n- Check any service status\n- Push code to GitHub\n- Read/write Base44 database\n- Call backend functions\n- Send Telegram messages\n- Check entire ecosystem\n\nJust tell me what to do in plain language.\n\nCommands: /omega-ai /omega-help');

    case '/omega-ai': case '/omegaai':
      return sendMessage(chatId, 'OMEGA Commander AI v3.0.1\nStatus: operational\nTools: 10 real execution tools\nAI: Groq ' + GROQ_MODEL + '\nPolling: active\nBot: @Omegacommanderaibot');

    case '/omega-help': case '/ohelp':
      return sendMessage(chatId, 'OMEGA v3.0 — HELP\n\nI can execute real actions. Just ask:\n\n"Check if HarzDM is up"\n"List my GitHub repos"\n"Read the last 5 orders from Base44"\n"Push a file to maganu-agent repo"\n"Check all ecosystem services"\n"Call the digitalMarketing function"\n"Send a message to my Telegram"\n\nOr use /omega-ai for status.');

    case '/omega-status':
      const status = await ecosystemStatus();
      const lines = status.map(s => s.name + ': ' + s.status + ' (' + s.code + ', ' + s.ms + 'ms)');
      return sendMessage(chatId, 'Ecosystem Status:\n\n' + lines.join('\n'));

    default:
      return sendMessage(chatId, 'Unknown command. Type /omega-help or just tell me what you need.');
  }
}

// ============ POLLING ============
let polling = false;
let pollErrors = 0;

// Flush old messages on startup — prevents reprocessing after Render restart
async function flushOldMessages() {
  try {
    // Get the latest update ID without processing any messages
    const res = await axios.get(`${TELEGRAM_API}/getUpdates`, {
      params: { offset: -1, timeout: 1, limit: 1 }, timeout: 10000
    });
    if (res.data.ok && res.data.result.length > 0) {
      lastUpdateId = res.data.result[0].update_id;
      console.log('[OMEGA] Flushed to update ID:', lastUpdateId);
    } else {
      // No pending messages — try getting the last update
      const res2 = await axios.get(`${TELEGRAM_API}/getUpdates`, {
        params: { offset: -1, timeout: 1, limit: 1 }, timeout: 10000
      });
      if (res2.data.ok && res2.data.result.length > 0) {
        lastUpdateId = res2.data.result[0].update_id;
        console.log('[OMEGA] Flushed to update ID:', lastUpdateId);
      } else {
        console.log('[OMEGA] No pending messages to flush');
      }
    }
    // Confirm the offset so Telegram won't resend these
    await axios.get(`${TELEGRAM_API}/getUpdates`, {
      params: { offset: lastUpdateId + 1, timeout: 1, limit: 1 }, timeout: 10000
    });
    state.lastUpdateId = lastUpdateId;
    saveState(state);
  } catch (e) {
    console.error('[OMEGA] Flush error:', e.message);
  }
}

async function startPolling() {
  if (polling) return;
  polling = true;

  // Always flush old messages on startup — state.json is ephemeral on Render
  await flushOldMessages();
  console.log('[OMEGA] v3.0 polling started, resuming from update ID:', lastUpdateId);

  async function poll() {
    try {
      const res = await axios.get(`${TELEGRAM_API}/getUpdates`, {
        params: { offset: lastUpdateId + 1, timeout: 30, limit: 10 }, timeout: 35000
      });

      if (res.data.ok && res.data.result.length > 0) {
        pollErrors = 0;
        for (const update of res.data.result) {
          lastUpdateId = update.update_id;
          if (update.message && update.message.text) {
            const msgId = update.message.message_id;
            const chatId = update.message.chat.id;
            const msgText = update.message.text;

            if (processedMessages.has(msgId)) continue;
            // Skip messages older than 30 seconds (anti-repeat safety)
            const msgAge = Date.now() / 1000 - update.message.date;
            if (msgAge > 30) { markProcessed(msgId); continue; }
            markProcessed(msgId);

            console.log('[OMEGA] Message:', msgText.substring(0, 80));

            if (msgText.startsWith('/')) {
              await handleCommand(chatId, msgText);
            } else {
              // AI with real tool execution
              const reply = await thinkWithTools(msgText);
              await sendMessage(chatId, reply);
            }
          }
        }
      }
    } catch (e) {
      pollErrors++;
      console.error('[OMEGA] Poll error:', e.message);
      if (pollErrors > 10) pollErrors = 0;
    }
    setTimeout(poll, 2000);
  }
  poll();
}

// ============ API ENDPOINTS ============
app.get('/', (req, res) => {
  res.json({ name: 'OMEGA Commander AI', version: '3.0.1', status: 'operational', bot: '@Omegacommanderaibot',
    uptime: process.uptime(), polling, last_update_id: lastUpdateId, tools: 10, ai_model: GROQ_MODEL, timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), polling, version: '3.0.1', ai: true, tools: 10 });
});

app.post('/execute', async (req, res) => {
  try {
    const { tool, args } = req.body;
    const result = await executeTool(tool, args || {});
    res.json({ ok: true, tool, result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/alert', async (req, res) => {
  try {
    const { message, tool_name, action_type, risk_level } = req.body;
    await sendMessage(OWNER_CHAT_ID, 'OMEGA Alert: ' + (tool_name || '') + ' ' + (action_type || '') + '\nRisk: ' + (risk_level || 'medium') + '\n' + (message || ''));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ START ============
app.listen(PORT, async () => {
  console.log('[OMEGA] v3.0 starting on port ' + PORT);
  console.log('[OMEGA] AI: Groq ' + GROQ_MODEL);
  console.log('[OMEGA] Tools: 10 real execution tools');
  await startPolling();
  if (process.uptime() < 5) {
    await sendMessage(OWNER_CHAT_ID, 'OMEGA Commander v3.0 — Online\n\nReal execution engine active.\n10 tools: GitHub, Base44, service checks, Telegram, AI.\n\nJust tell me what to do.');
  }
  console.log('[OMEGA] Startup complete');
});
