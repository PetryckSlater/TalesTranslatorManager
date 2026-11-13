const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const config = require('../config');
const { protectTags, restoreTags, applyGlossary, translateText } = require('./translate');

const PORT = 3000;

// Obter IPs locais para facilitar o compartilhamento na rede
function getLocalIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

// Detecção de categoria pelo prefixo da chave ou ID
function detectCategory(item) {
  const key = (item.key || item.keyID || item.identifier || '').toLowerCase();
  if (key.startsWith('drama') || key.startsWith('dialogue')) return { id: 'drama', name: '🎭 Diálogos & História' };
  if (key.startsWith('item') || key.includes('prop') || key.includes('pill') || key.includes('elixir')) return { id: 'item', name: '🧪 Itens & Pílulas' };
  if (key.startsWith('skill') || key.startsWith('battle') || key.includes('wuxue') || key.includes('fate')) return { id: 'skill', name: '⚔️ Habilidades & Combate' };
  if (key.startsWith('ui') || key.startsWith('common') || key.startsWith('shezhi') || key.includes('menu') || key.startsWith('diff') || key.startsWith('setting') || key.startsWith('btn')) return { id: 'ui', name: '🖥️ Interface & Menus' };
  if (key.startsWith('startgametip') || key.startsWith('patch') || key.includes('update')) return { id: 'patch', name: '📜 Notas de Atualização' };
  if (key.startsWith('task') || key.includes('quest') || key.startsWith('school')) return { id: 'quest', name: '📜 Missões & Seitas' };
  return { id: 'other', name: '📦 Outros' };
}

// Extrai tags/placeholders para validação
function extractPlaceholders(text) {
  if (!text) return [];
  const matches = text.match(/<[^>]+>|\{[^}]+\}/g);
  return matches || [];
}

// Valida se a tradução preservou as tags obrigatórias
function validatePlaceholders(origText, transText) {
  const origTags = extractPlaceholders(origText);
  const transTags = extractPlaceholders(transText);

  const missing = [];
  const origCounts = {};
  const transCounts = {};

  origTags.forEach(t => { origCounts[t] = (origCounts[t] || 0) + 1; });
  transTags.forEach(t => { transCounts[t] = (transCounts[t] || 0) + 1; });

  for (const [tag, count] of Object.entries(origCounts)) {
    if (!transCounts[tag] || transCounts[tag] < count) {
      missing.push(tag);
    }
  }

  return {
    valid: missing.length === 0,
    missingTags: missing
  };
}

// Backup automático periódico do banco de dados
function createBackupIfNeeded(database) {
  const backupDir = path.join(config.dataDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 13); // yyyy-mm-ddThh
  const backupFile = path.join(backupDir, `database_${dateStr}.json`);

  if (!fs.existsSync(backupFile)) {
    try {
      fs.writeFileSync(backupFile, JSON.stringify(database, null, 2), 'utf8');
      // Manter apenas os últimos 20 backups
      const files = fs.readdirSync(backupDir).sort();
      if (files.length > 20) {
        files.slice(0, files.length - 20).forEach(f => fs.unlinkSync(path.join(backupDir, f)));
      }
    } catch (e) {
      console.warn('Aviso: Falha ao criar backup:', e.message);
    }
  }
}

// Salva atomicamente para evitar corrupção em concorrência
function atomicWriteJson(filePath, data) {
  const tempPath = filePath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function getStats() {
  const db = fs.existsSync(config.databaseFile) ? JSON.parse(fs.readFileSync(config.databaseFile, 'utf8')) : { localText: {}, roleLog: {} };
  const pending = fs.existsSync(config.pendingFile) ? JSON.parse(fs.readFileSync(config.pendingFile, 'utf8')) : [];
  const modified = fs.existsSync(config.modifiedFile) ? JSON.parse(fs.readFileSync(config.modifiedFile, 'utf8')) : [];

  const localCount = Object.keys(db.localText || {}).length;
  const roleCount = Object.keys(db.roleLog || {}).length;

  const engLocalCount = 54991;
  const engRoleCount = 26712;
  const total = engLocalCount + engRoleCount;
  const translated = localCount + roleCount;
  const pct = ((translated / total) * 100).toFixed(1);

  // Leaderboard de colaboradores
  const authors = {};
  for (const item of Object.values(db.localText || {})) {
    if (item.author) authors[item.author] = (authors[item.author] || 0) + 1;
  }
  for (const item of Object.values(db.roleLog || {})) {
    if (item.author) authors[item.author] = (authors[item.author] || 0) + 1;
  }

  const leaderboard = Object.entries(authors)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  let overflowCount = 0;
  const uiPrefixes = ['ui_', 'btn_', 'diff', 'menu_', 'title_', 'tab_', 'panel_', 'battle_ui', 'rolecreate', 'setting_'];
  for (const [key, val] of Object.entries(db.localText || {})) {
    const lk = key.toLowerCase();
    if (uiPrefixes.some(p => lk.startsWith(p)) && val.pt && (val.pt.length > 25 || (lk.includes('btn') && val.pt.length > 15))) {
      overflowCount++;
    }
  }

  let auditCount = 0;
  try {
    const { auditDatabase } = require('./audit-translation');
    const { issues } = auditDatabase();
    auditCount = issues.stats.totalIssues;
  } catch (e) {}

  return {
    total,
    translated,
    percentage: pct,
    localText: {
      translated: localCount,
      total: engLocalCount,
      percentage: ((localCount / engLocalCount) * 100).toFixed(1)
    },
    roleLog: {
      translated: roleCount,
      total: engRoleCount,
      percentage: ((roleCount / engRoleCount) * 100).toFixed(1)
    },
    pendingCount: pending.length,
    modifiedCount: modified.length,
    overflowCount,
    auditCount,
    leaderboard
  };
}

function handleApi(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;
  const query = Object.fromEntries(searchParams.entries());

  // 1. Estatísticas gerais
  if (pathname === '/api/stats' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(getStats()));
    return;
  }

  // 2. Glossário de cultivo
  if (pathname === '/api/glossary' && req.method === 'GET') {
    const glossary = fs.existsSync(config.glossaryFile) 
      ? JSON.parse(fs.readFileSync(config.glossaryFile, 'utf8')) 
      : { terms: [] };
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(glossary));
    return;
  }

  // 3. Listagem de Itens com filtros avançados
  if (pathname === '/api/items' && req.method === 'GET') {
    const type = query.type || 'pending'; // 'pending', 'modified', 'database'
    const file = query.file || 'all';
    const category = query.category || 'all';
    const search = (query.search || '').toLowerCase().trim();
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(10, Math.min(100, parseInt(query.limit, 10) || 25));

    let items = [];

    if (type === 'pending' && fs.existsSync(config.pendingFile)) {
      items = JSON.parse(fs.readFileSync(config.pendingFile, 'utf8'));
    } else if (type === 'modified' && fs.existsSync(config.modifiedFile)) {
      items = JSON.parse(fs.readFileSync(config.modifiedFile, 'utf8'));
    } else if (type === 'database' && fs.existsSync(config.databaseFile)) {
      const db = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));
      for (const [key, val] of Object.entries(db.localText || {})) {
        items.push({ file: 'LocalText', identifier: key, id: val.id, key, ch: val.ch, pt: val.pt, author: val.author, updatedAt: val.updatedAt });
      }
      for (const [id, val] of Object.entries(db.roleLog || {})) {
        items.push({ file: 'RoleLogLocal', identifier: id, id, keyID: val.keyID, ch: val.ch, pt: val.pt, author: val.author, updatedAt: val.updatedAt });
      }
    } else if (type === 'overflow' && fs.existsSync(config.databaseFile)) {
      const db = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));
      const uiPrefixes = ['ui_', 'btn_', 'diff', 'menu_', 'title_', 'tab_', 'panel_', 'battle_ui', 'rolecreate', 'setting_'];
      for (const [key, val] of Object.entries(db.localText || {})) {
        const lk = key.toLowerCase();
        const isUI = uiPrefixes.some(p => lk.startsWith(p));
        const pt = val.pt || '';
        if (isUI && pt.trim() && (pt.length > 25 || (lk.includes('btn') && pt.length > 15))) {
          items.push({ file: 'LocalText', identifier: key, id: val.id, key, ch: val.ch, en: val.en, pt: val.pt, author: val.author, updatedAt: val.updatedAt, len: pt.length });
        }
      }
      items.sort((a, b) => b.len - a.len);
    } else if (type === 'audit' && fs.existsSync(config.databaseFile)) {
      try {
        const { auditDatabase } = require('./audit-translation');
        const { issues } = auditDatabase();
        const allAudit = [
          ...issues.corruptedTags.map(x => ({ ...x, auditType: '🏷️ Tag Corrompida' })),
          ...issues.unclosedBrackets.map(x => ({ ...x, auditType: '⚠️ Colchete Aberto' })),
          ...issues.bizarreTerms.map(x => ({ ...x, auditType: '👾 Termo Bizarro' })),
          ...issues.residualChinese.map(x => ({ ...x, auditType: '🈲 Chinês Residual' }))
        ];
        for (const item of allAudit) {
          items.push({
            file: item.category === 'localText' ? 'LocalText' : 'RoleLogLocal',
            identifier: item.key,
            id: item.key,
            key: item.key,
            ch: item.ch,
            pt: item.text,
            auditType: item.auditType
          });
        }
      } catch (err) {
        console.error('Falha ao auditar itens', err);
      }
    }

    // Filtro por arquivo
    if (file !== 'all') {
      items = items.filter(x => x.file === file);
    }

    // Filtro por categoria
    if (category !== 'all') {
      items = items.filter(x => detectCategory(x).id === category);
    }

    // Filtro de busca textual
    if (search) {
      items = items.filter(x => {
        const idMatch = (x.id || '').toLowerCase().includes(search);
        const keyMatch = (x.key || x.keyID || '').toLowerCase().includes(search);
        const chMatch = (x.ch || x.newCh || '').toLowerCase().includes(search);
        const enMatch = (x.en || x.newEn || '').toLowerCase().includes(search);
        const ptMatch = (x.pt || x.currentPt || '').toLowerCase().includes(search);
        const authorMatch = (x.author || '').toLowerCase().includes(search);
        return idMatch || keyMatch || chMatch || enMatch || ptMatch || authorMatch;
      });
    }

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    
    // Adiciona meta de categoria em cada item retornado
    const pagedItems = items.slice(startIndex, startIndex + limit).map(item => ({
      ...item,
      category: detectCategory(item)
    }));

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      page,
      limit,
      totalPages,
      totalCount,
      items: pagedItems
    }));
    return;
  }

  // 4. Salvar tradução individual com autoria e validação de tags
  if (pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { file, identifier, pt, author, force } = data;

        if (!file || !identifier || pt === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Dados incompletos' }));
          return;
        }

        const db = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));
        createBackupIfNeeded(db);

        // Obter texto original para validação
        let origText = '';
        if (file === 'LocalText') {
          origText = (db.localText[identifier] && db.localText[identifier].en) || '';
        } else {
          origText = (db.roleLog[identifier] && db.roleLog[identifier].en) || '';
        }

        if (!origText && fs.existsSync(config.pendingFile)) {
          const pending = JSON.parse(fs.readFileSync(config.pendingFile, 'utf8'));
          const found = pending.find(x => x.file === file && x.identifier === identifier);
          if (found) origText = found.en || found.ch || '';
        }

        // Validação de placeholders
        const validation = validatePlaceholders(origText, pt);
        if (!validation.valid && !force) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            warning: true,
            message: `Atenção: A tradução parece estar faltando as tags originais: ${validation.missingTags.join(', ')}`,
            missingTags: validation.missingTags
          }));
          return;
        }

        const now = new Date().toISOString();
        const authorName = (author || 'Colaborador').trim();

        if (file === 'LocalText') {
          if (!db.localText[identifier]) db.localText[identifier] = { key: identifier };
          db.localText[identifier].pt = pt;
          db.localText[identifier].author = authorName;
          db.localText[identifier].updatedAt = now;
        } else {
          if (!db.roleLog[identifier]) db.roleLog[identifier] = { id: identifier };
          db.roleLog[identifier].pt = pt;
          db.roleLog[identifier].author = authorName;
          db.roleLog[identifier].updatedAt = now;
        }

        atomicWriteJson(config.databaseFile, db);

        // Atualizar pending.json
        if (fs.existsSync(config.pendingFile)) {
          let pending = JSON.parse(fs.readFileSync(config.pendingFile, 'utf8'));
          const before = pending.length;
          pending = pending.filter(x => !(x.file === file && x.identifier === identifier));
          if (pending.length !== before) {
            atomicWriteJson(config.pendingFile, pending);
          }
        }

        // Atualizar modified.json
        if (fs.existsSync(config.modifiedFile)) {
          let modified = JSON.parse(fs.readFileSync(config.modifiedFile, 'utf8'));
          const before = modified.length;
          modified = modified.filter(x => !(x.file === file && x.identifier === identifier));
          if (modified.length !== before) {
            atomicWriteJson(config.modifiedFile, modified);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, stats: getStats() }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. Tradução assistida instantânea para um único item
  if (pathname === '/api/translate-single' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body);
        if (!text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Texto não fornecido' }));
          return;
        }

        const glossary = fs.existsSync(config.glossaryFile) 
          ? JSON.parse(fs.readFileSync(config.glossaryFile, 'utf8')) 
          : { terms: [] };

        let translated = await translateText(text, 'pt');
        translated = applyGlossary(translated, glossary);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, translated }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 6. Disparar Build diretamente do navegador
  if (pathname === '/api/build' && req.method === 'POST') {
    try {
      delete require.cache[require.resolve('./build')];
      require('./build');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, stats: getStats() }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 7. Auditoria de Qualidade & Tags
  if (pathname === '/api/audit' && req.method === 'GET') {
    try {
      const { auditDatabase } = require('./audit-translation');
      const { issues } = auditDatabase();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(issues));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 8. Autocorreção via Painel Web
  if (pathname === '/api/audit-fix' && req.method === 'POST') {
    try {
      const { autoFixDatabase } = require('./audit-translation');
      const result = autoFixDatabase();
      delete require.cache[require.resolve('./build')];
      require('./build');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, ...result, stats: getStats() }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Tales of Immortal — Painel Colaborativo de Tradução</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #131b2a;
      --card-border: #202d42;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-gold: #fbbf24;
      --accent-green: #22c55e;
      --danger: #ef4444;
      --warning: #f59e0b;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--font); line-height: 1.5; padding-bottom: 80px; }
    
    header { background: #0c1322; border-bottom: 1px solid var(--card-border); padding: 14px 24px; position: sticky; top: 0; z-index: 100; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand h1 { font-size: 1.25rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
    .network-badge { font-size: 0.75rem; padding: 4px 10px; border-radius: 20px; background: rgba(56, 189, 248, 0.1); color: var(--accent); border: 1px solid rgba(56, 189, 248, 0.3); font-family: monospace; }
    
    .author-box { display: flex; align-items: center; gap: 8px; background: #1a2538; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--card-border); }
    .author-box label { font-size: 0.8rem; color: var(--text-muted); }
    .author-input { background: transparent; border: none; color: #fff; font-weight: 600; font-size: 0.85rem; outline: none; width: 120px; }
    
    .btn { background: #1e293b; color: var(--text); border: 1px solid var(--card-border); padding: 7px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
    .btn:hover { background: #334155; border-color: var(--accent); color: #fff; }
    .btn-primary { background: #16a34a; border-color: #22c55e; color: #fff; }
    .btn-primary:hover { background: #22c55e; }
    .btn-magic { background: #6366f1; border-color: #818cf8; color: #fff; }
    .btn-magic:hover { background: #4f46e5; }
    .btn-sm { padding: 4px 8px; font-size: 0.75rem; }
    
    .container { max-width: 1400px; margin: 20px auto; padding: 0 16px; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 14px 18px; position: relative; overflow: hidden; }
    .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
    .stat-value { font-size: 1.6rem; font-weight: 800; color: #fff; margin: 4px 0; }
    .progress-bar { height: 6px; background: #1e293b; border-radius: 3px; overflow: hidden; margin-top: 8px; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #10b981, #38bdf8); border-radius: 3px; transition: width 0.4s; }

    .nav-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--card-border); margin-bottom: 20px; }
    .tab-btn { background: none; border: none; padding: 12px 18px; color: var(--text-muted); font-size: 0.95rem; cursor: pointer; border-bottom: 2px solid transparent; font-weight: 600; transition: color 0.2s; }
    .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
    
    .filters-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; align-items: center; background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid var(--card-border); }
    .search-input { flex: 1; min-width: 260px; background: #1e293b; border: 1px solid var(--card-border); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 0.9rem; }
    .search-input:focus { outline: none; border-color: var(--accent); }
    .select-input { background: #1e293b; border: 1px solid var(--card-border); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 0.9rem; }
    
    .item-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 16px; margin-bottom: 16px; transition: border-color 0.2s, box-shadow 0.2s; }
    .item-card:hover { border-color: #38bdf888; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
    
    .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; font-size: 0.85rem; }
    .badge-file { font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); color: var(--accent); font-weight: 600; }
    .badge-cat { font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: #334155; color: #e2e8f0; }
    .item-id { font-family: monospace; color: var(--accent-gold); background: #1e293b; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
    
    .item-body { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 900px) { .item-body { grid-template-columns: 1fr; } }
    
    .text-box { background: #0b111e; border: 1px solid var(--card-border); border-radius: 8px; padding: 12px; font-size: 0.9rem; display: flex; flex-direction: column; justify-content: space-between; }
    .text-box-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
    .text-zh { font-size: 0.85rem; color: #94a3b8; margin-bottom: 8px; border-bottom: 1px dashed #1e293b; padding-bottom: 6px; font-family: "Noto Sans SC", sans-serif; }
    .text-en { color: #f8fafc; white-space: pre-wrap; word-break: break-word; font-size: 0.95rem; }
    
    .glossary-hints { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .glossary-pill { font-size: 0.7rem; background: rgba(251, 191, 36, 0.15); color: var(--accent-gold); border: 1px solid rgba(251, 191, 36, 0.3); padding: 1px 6px; border-radius: 4px; }

    .editor-box { display: flex; flex-direction: column; justify-content: space-between; }
    .editor-textarea { width: 100%; min-height: 90px; background: #0b111e; border: 1px solid var(--card-border); border-radius: 8px; padding: 12px; color: #fff; font-size: 0.95rem; font-family: inherit; line-height: 1.5; resize: vertical; transition: border-color 0.2s; }
    .editor-textarea:focus { outline: none; border-color: var(--accent); }
    
    .tag-alert { font-size: 0.75rem; color: var(--danger); margin-top: 4px; display: none; }
    
    .item-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
    .meta-author { font-size: 0.75rem; color: var(--text-muted); }
    .status-msg { font-size: 0.8rem; color: var(--accent-green); display: none; font-weight: 600; }
    
    .pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 30px; }
    .loading-spinner { text-align: center; padding: 50px; color: var(--text-muted); }
    
    .leaderboard-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 200; justify-content: center; align-items: center; }
    .leaderboard-content { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>🐉 Tales of Immortal <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">Painel PT-BR</span></h1>
      <span class="network-badge" id="hostIpBadge" title="Envie este IP para seus amigos na rede">Rede: Conectando...</span>
    </div>
    
    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
      <div class="author-box">
        <label>👤 Seu Nome:</label>
        <input type="text" class="author-input" id="authorInput" placeholder="Ex: Take Over" onchange="saveAuthorName()">
      </div>
      <button class="btn" onclick="openLeaderboard()">🏆 Colaboradores</button>
      <button class="btn btn-primary" onclick="buildMod()">⚡ Compilar Mod</button>
    </div>
  </header>

  <div class="container">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Progresso Geral</div>
        <div class="stat-value" id="statOverallPct">--%</div>
        <div class="progress-bar"><div class="progress-fill" id="statOverallBar" style="width: 0%"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">LocalText (UI / Itens)</div>
        <div class="stat-value" id="statLocalPct">--%</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);" id="statLocalDetail">--</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">RoleLog (Diálogos / Quests)</div>
        <div class="stat-value" id="statRolePct">--%</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);" id="statRoleDetail">--</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pendentes / Modificados</div>
        <div class="stat-value" id="statPendingCount">--</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);" id="statModifiedDetail">--</div>
      </div>
    </div>

    <div class="nav-tabs">
      <button class="tab-btn active" onclick="switchTab('pending')">Novos Pendentes (<span id="tabCountPending">0</span>)</button>
      <button class="tab-btn" onclick="switchTab('modified')">Modificados no Jogo (<span id="tabCountModified">0</span>)</button>
      <button class="tab-btn" onclick="switchTab('database')">Banco Completo (Pesquisar)</button>
      <button class="tab-btn" onclick="switchTab('overflow')">📏 Textos Longos / UI (<span id="tabCountOverflow">0</span>)</button>
      <button class="tab-btn" onclick="switchTab('audit')">🔍 Auditoria & Erros (<span id="tabCountAudit">0</span>)</button>
    </div>

    <div class="filters-bar">
      <input type="text" class="search-input" id="searchInput" placeholder="Pesquisar por chave, ID, texto em inglês, chinês ou português..." onkeydown="if(event.key==='Enter') loadItems()">
      
      <select class="select-input" id="categoryFilter" onchange="loadItems()">
        <option value="all">Todas as Categorias</option>
        <option value="drama">🎭 Diálogos & História</option>
        <option value="item">🧪 Itens & Pílulas</option>
        <option value="skill">⚔️ Habilidades & Combate</option>
        <option value="quest">📜 Missões & Seitas</option>
        <option value="ui">🖥️ Interface & Menus</option>
        <option value="patch">📜 Notas de Atualização</option>
        <option value="other">📦 Outros</option>
      </select>

      <select class="select-input" id="fileFilter" onchange="loadItems()">
        <option value="all">Todos os Arquivos</option>
        <option value="LocalText">Apenas LocalText</option>
        <option value="RoleLogLocal">Apenas RoleLogLocal</option>
      </select>

      <button class="btn" onclick="loadItems()">🔍 Filtrar</button>
    </div>

    <div id="itemsContainer">
      <div class="loading-spinner">Carregando textos...</div>
    </div>

    <div class="pagination">
      <button class="btn" id="prevBtn" onclick="changePage(-1)">← Anterior</button>
      <span style="font-size: 0.85rem; color: var(--text-muted);" id="pageInfo">Página 1</span>
      <button class="btn" id="nextBtn" onclick="changePage(1)">Próxima →</button>
    </div>
  </div>

  <!-- Modal Leaderboard -->
  <div class="leaderboard-modal" id="leaderboardModal" onclick="closeLeaderboard(event)">
    <div class="leaderboard-content" onclick="event.stopPropagation()">
      <h2 style="margin-bottom: 16px; font-size: 1.2rem;">🏆 Ranking de Tradutores</h2>
      <div id="leaderboardList" style="margin-bottom: 20px;">Carregando...</div>
      <button class="btn" style="width: 100%; justify-content: center;" onclick="closeLeaderboard()">Fechar</button>
    </div>
  </div>

  <script>
    let currentTab = 'pending';
    let currentPage = 1;
    let totalPages = 1;
    let glossaryTerms = [];

    // Carregar nome do autor do localStorage
    function initAuthor() {
      const saved = localStorage.getItem('tales_author_name') || 'Tradutor';
      document.getElementById('authorInput').value = saved;
    }

    function saveAuthorName() {
      const val = document.getElementById('authorInput').value.trim() || 'Tradutor';
      localStorage.setItem('tales_author_name', val);
    }

    function getAuthorName() {
      return document.getElementById('authorInput').value.trim() || 'Tradutor';
    }

    async function loadGlossary() {
      try {
        const res = await fetch('/api/glossary');
        const data = await res.json();
        glossaryTerms = data.terms || [];
      } catch (e) {
        console.warn('Glossário não carregado');
      }
    }

    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('statOverallPct').innerText = data.percentage + '%';
        document.getElementById('statOverallBar').style.width = data.percentage + '%';
        document.getElementById('statLocalPct').innerText = data.localText.percentage + '%';
        document.getElementById('statLocalDetail').innerText = data.localText.translated.toLocaleString('pt-BR') + ' / ' + data.localText.total.toLocaleString('pt-BR');
        document.getElementById('statRolePct').innerText = data.roleLog.percentage + '%';
        document.getElementById('statRoleDetail').innerText = data.roleLog.translated.toLocaleString('pt-BR') + ' / ' + data.roleLog.total.toLocaleString('pt-BR');
        document.getElementById('statPendingCount').innerText = data.pendingCount.toLocaleString('pt-BR');
        document.getElementById('statModifiedDetail').innerText = data.modifiedCount + ' alterados';
        document.getElementById('tabCountPending').innerText = data.pendingCount;
        document.getElementById('tabCountModified').innerText = data.modifiedCount;
        if (document.getElementById('tabCountOverflow')) {
          document.getElementById('tabCountOverflow').innerText = data.overflowCount || 0;
        }
        if (document.getElementById('tabCountAudit')) {
          document.getElementById('tabCountAudit').innerText = data.auditCount || 0;
        }

        // Renderizar leaderboard
        let lHtml = '<div style="display: flex; flex-direction: column; gap: 8px;">';
        if (data.leaderboard && data.leaderboard.length > 0) {
          data.leaderboard.forEach((user, idx) => {
            lHtml += \`<div style="display: flex; justify-content: space-between; padding: 6px 12px; background: #0b111e; border-radius: 6px;">
              <span>#\${idx + 1} <b>\${escapeHtml(user.name)}</b></span>
              <span style="color: var(--accent-gold); font-weight: 600;">\${user.count.toLocaleString('pt-BR')} textos</span>
            </div>\`;
          });
        } else {
          lHtml += '<div style="color: var(--text-muted); text-align: center;">Nenhuma contribuição registrada ainda. Comece a traduzir!</div>';
        }
        lHtml += '</div>';
        document.getElementById('leaderboardList').innerHTML = lHtml;
      } catch (e) {
        console.error('Falha ao carregar stats', e);
      }
    }

    function switchTab(tab) {
      currentTab = tab;
      currentPage = 1;
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      loadItems();
    }

    // Procura termos do glossário presentes no texto em inglês
    function findGlossaryHints(text) {
      if (!text) return [];
      const hints = [];
      const lower = text.toLowerCase();
      for (const t of glossaryTerms) {
        if (lower.includes(t.en.toLowerCase())) {
          hints.push(t);
        }
      }
      return hints;
    }

    async function loadItems() {
      const container = document.getElementById('itemsContainer');
      container.innerHTML = '<div class="loading-spinner">Carregando textos...</div>';

      const search = document.getElementById('searchInput').value;
      const file = document.getElementById('fileFilter').value;
      const category = document.getElementById('categoryFilter').value;

      try {
        const res = await fetch(\`/api/items?type=\${currentTab}&file=\${file}&category=\${category}&search=\${encodeURIComponent(search)}&page=\${currentPage}&limit=25\`);
        const data = await res.json();

        currentPage = data.page;
        totalPages = data.totalPages;
        document.getElementById('pageInfo').innerText = \`Página \${currentPage} de \${totalPages} (\${data.totalCount.toLocaleString('pt-BR')} itens)\`;
        document.getElementById('prevBtn').disabled = currentPage <= 1;
        document.getElementById('nextBtn').disabled = currentPage >= totalPages;

        if (data.items.length === 0) {
          container.innerHTML = '<div class="loading-spinner" style="padding: 60px;">Nenhum item encontrado nesta categoria. Tudo em dia!</div>';
          return;
        }

        let html = '';
        if (currentTab === 'audit') {
          html += `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <strong style="color: #f87171;">🔍 Auditor de Qualidade & Bizarrices</strong>
              <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #94a3b8;">Detecta tags de variáveis quebradas, caracteres chineses esquecidos e termos de tradução automática amadora.</p>
            </div>
            <button class="btn btn-primary" onclick="runAuditFix()">⚡ Autocorrigir Erros Conhecidos</button>
          </div>`;
        }
        data.items.forEach(item => {
          const id = item.id || '';
          const key = item.key || item.keyID || '';
          const identifier = item.identifier || key || id;
          const origEn = item.en || item.newEn || '';
          const origCh = item.ch || item.newCh || '';
          const currentPt = item.pt || item.currentPt || '';
          const cat = item.category || { name: 'Geral' };
          const effectiveSource = origEn || origCh;
          const isChOnly = !origEn && Boolean(origCh);
          const hints = findGlossaryHints(origEn || '');

          html += \`
            <div class="item-card" id="card-\${item.file}-\${identifier}">
              <div class="item-header">
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <span class="badge-file">\${item.file}</span>
                  <span class="badge-cat">\${cat.name}</span>
                  <span class="item-id">\${key || id}</span>
                  \${key && id ? '<span style="font-size: 0.75rem; color: var(--text-muted);">(ID: ' + id + ')</span>' : ''}
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  \${currentPt && currentPt.length > 25 && cat.id === 'ui' ? \`<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: 600;">📏 \${currentPt.length} chars (Risco de corte)</span>\` : ''}
                  \${item.auditType ? \`<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: 600;">\${item.auditType}</span>\` : ''}
                  \${isChOnly ? '<span style="color: var(--accent-gold); font-weight: 600; font-size: 0.8rem; background: rgba(251,191,36,0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(251,191,36,0.3);">⚠️ Sem inglês oficial (Traduzindo do Chinês)</span>' : ''}
                  \${currentTab === 'modified' ? '<span style="color: var(--accent-gold); font-weight: 600; font-size: 0.8rem;">⚠️ Texto alterado no update</span>' : ''}
                </div>
              </div>

              <div class="item-body">
                <div class="text-box">
                  <div>
                    <div class="text-box-header">
                      <span>Texto Original \${isChOnly ? '(Chinês)' : '(Inglês)'}</span>
                      <button class="btn btn-sm" onclick="copyText('\${escapeHtml(effectiveSource).replace(/'/g, "\\\\'")}')">📋 Copiar Original</button>
                    </div>
                    \${origCh && origEn ? '<div class="text-zh">' + escapeHtml(origCh) + '</div>' : ''}
                    <div class="text-en" id="orig-\${item.file}-\${identifier}" data-source="\${escapeHtml(effectiveSource)}">\${escapeHtml(effectiveSource)}</div>
                  </div>
                  \${hints.length > 0 ? \`
                    <div class="glossary-hints">
                      \${hints.map(h => \`<span class="glossary-pill" title="\${h.notes || ''}">\${h.en} ➔ \${h.pt}</span>\`).join('')}
                    </div>
                  \` : ''}
                </div>

                <div class="editor-box">
                  <div>
                    <div class="text-box-header">
                      <span>Tradução em Português</span>
                      <button class="btn btn-sm btn-magic" onclick="autoSuggest('\${item.file}', '\${identifier}')">✨ Sugerir com IA</button>
                    </div>
                    <textarea class="editor-textarea" id="text-\${item.file}-\${identifier}" oninput="checkTags('\${item.file}', '\${identifier}')" onkeydown="handleKeyDown(event, '\${item.file}', '\${identifier}')">\${escapeHtml(currentPt)}</textarea>
                    <div class="tag-alert" id="alert-\${item.file}-\${identifier}"></div>
                  </div>

                  <div class="item-footer">
                    <span class="meta-author" id="meta-\${item.file}-\${identifier}">
                      \${item.author ? 'Traduzido por ' + escapeHtml(item.author) : 'Pendente'}
                    </span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <span class="status-msg" id="status-\${item.file}-\${identifier}">✓ Salvo!</span>
                      <button class="btn btn-primary" onclick="saveItem('\${item.file}', '\${identifier}')">Salvar (Ctrl+Enter)</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          \`;
        });
        container.innerHTML = html;
      } catch (err) {
        container.innerHTML = '<div class="loading-spinner" style="color: var(--danger);">Erro ao carregar: ' + err.message + '</div>';
      }
    }

    function escapeHtml(text) {
      if (!text) return '';
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function copyText(str) {
      navigator.clipboard.writeText(str);
      alert('Texto copiado para a área de transferência!');
    }

    function checkTags(file, identifier) {
      const origElem = document.getElementById(\`orig-\${file}-\${identifier}\`);
      const textElem = document.getElementById(\`text-\${file}-\${identifier}\`);
      const alertElem = document.getElementById(\`alert-\${file}-\${identifier}\`);
      if (!origElem || !textElem || !alertElem) return;

      const origText = origElem.getAttribute('data-source') || origElem.innerText;
      const transText = textElem.value;

      const matches = origText.match(/<[^>]+>|\{[^}]+\}/g) || [];
      const missing = [];
      matches.forEach(m => {
        if (!transText.includes(m)) missing.push(m);
      });

      if (missing.length > 0) {
        alertElem.style.display = 'block';
        alertElem.innerText = '⚠️ Cuidado: As seguintes tags do jogo não foram encontradas na tradução: ' + missing.join(' ');
      } else {
        alertElem.style.display = 'none';
      }
    }

    async function autoSuggest(file, identifier) {
      const origElem = document.getElementById(\`orig-\${file}-\${identifier}\`);
      const textElem = document.getElementById(\`text-\${file}-\${identifier}\`);
      if (!origElem || !textElem) return;

      const origText = origElem.getAttribute('data-source') || origElem.innerText;
      textElem.placeholder = 'Traduzindo com IA...';

      try {
        const res = await fetch('/api/translate-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: origText })
        });
        const data = await res.json();
        if (data.success && data.translated) {
          textElem.value = data.translated;
          checkTags(file, identifier);
        }
      } catch (e) {
        alert('Falha na sugestão automática.');
      }
    }

    function handleKeyDown(event, file, identifier) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        saveItem(file, identifier);
      }
    }

    async function saveItem(file, identifier, force = false) {
      const textarea = document.getElementById(\`text-\${file}-\${identifier}\`);
      const statusMsg = document.getElementById(\`status-\${file}-\${identifier}\`);
      const metaAuthor = document.getElementById(\`meta-\${file}-\${identifier}\`);
      if (!textarea) return;

      const pt = textarea.value;
      const author = getAuthorName();

      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file, identifier, pt, author, force })
        });
        const data = await res.json();

        if (res.status === 422 && data.warning && !force) {
          if (confirm(data.message + '\\n\\nDeseja salvar mesmo assim?')) {
            return saveItem(file, identifier, true);
          }
          return;
        }

        if (data.success) {
          statusMsg.style.display = 'inline';
          metaAuthor.innerText = 'Traduzido por ' + author + ' (Agora)';
          setTimeout(() => { statusMsg.style.display = 'none'; }, 2000);
          loadStats();
        } else {
          alert('Erro ao salvar: ' + (data.error || 'Desconhecido'));
        }
      } catch (err) {
        alert('Erro ao salvar: ' + err.message);
      }
    }

    async function runAuditFix() {
      if (!confirm('Deseja aplicar as autocorreções automáticas de tags e termos bizarros no banco e recompilar o mod?')) return;
      try {
        const res = await fetch('/api/audit-fix', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert(`Sucesso! Foram corrigidas ${data.fixCount} entradas no banco de dados e o mod foi recompilado.`);
          loadStats();
          loadItems();
        } else {
          alert('Erro: ' + (data.error || 'Falha ao executar correção'));
        }
      } catch (err) {
        alert('Erro de conexão: ' + err.message);
      }
    }

    async function buildMod() {
      if (!confirm('Deseja compilar os arquivos traduzidos agora para a pasta do mod (ModProject_VMCUi0)?')) return;
      try {
        const res = await fetch('/api/build', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert('Mod compilado com sucesso! Arquivos atualizados em ModProject_VMCUi0/ModProject/ModExcel/');
          loadStats();
        } else {
          alert('Erro ao compilar: ' + data.error);
        }
      } catch (e) {
        alert('Falha na comunicação com o servidor.');
      }
    }

    function openLeaderboard() {
      document.getElementById('leaderboardModal').style.display = 'flex';
    }

    function closeLeaderboard() {
      document.getElementById('leaderboardModal').style.display = 'none';
    }

    function changePage(delta) {
      currentPage += delta;
      loadItems();
    }

    // Inicialização
    initAuthor();
    loadGlossary();
    loadStats();
    loadItems();

    // Buscar IP local
    fetch('/api/stats')
      .then(() => {
        document.getElementById('hostIpBadge').innerText = 'Local: ' + window.location.host;
      });
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost:3000'));
  if (parsedUrl.pathname.startsWith('/api/')) {
    handleApi(req, res, parsedUrl);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
  }
});

// Escuta em 0.0.0.0 para aceitar conexões locais e de rede (LAN / VPN / Hamachi / Tailscale)
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIps();
  console.log('=====================================================');
  console.log('   🐉 Tales of Immortal — Painel de Tradução');
  console.log('=====================================================');
  console.log(`  Disponível no seu PC em:   http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`  Disponível na sua rede em: http://${ips[0]}:${PORT}`);
    console.log('  (Envie este link para quem for te ajudar na mesma rede/VPN!)');
  }
  console.log('=====================================================\n');
});
