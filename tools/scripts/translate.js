const fs = require('fs');
const path = require('path');
const config = require('../config');

// Proteção de tags do jogo e termos do glossário com tokens seguros
function protectGlossaryAndTags(text, glossary) {
  if (!text) return { text: '', tags: [] };
  const tags = [];
  
  // 1. Tags e placeholders: <color=...>, </color>, <g>, </g>, {0}, {name|A}, {itemLink...}, etc.
  let protectedText = text.replace(/(<[^>]+>|\{[^}]+\})/g, (match) => {
    const p = `___TAG_${tags.length}___`;
    tags.push({ placeholder: p, replacement: match });
    return p;
  });

  // 2. Proteção e substituição dos termos do glossário (ordenados pelo tamanho para evitar sobreposição)
  if (glossary && Array.isArray(glossary.terms)) {
    const sortedTerms = [...glossary.terms].sort((a, b) => b.en.length - a.en.length);
    for (const term of sortedTerms) {
      if (!term.en) continue;
      // Escapa caracteres especiais de regex
      const escaped = term.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      protectedText = protectedText.replace(regex, () => {
        const p = `___TERM_${tags.length}___`;
        tags.push({ placeholder: p, replacement: term.pt });
        return p;
      });
    }
  }

  return { text: protectedText, tags };
}

function restoreAll(text, tags) {
  if (!text) return '';
  let res = text;
  for (const item of tags) {
    // Substitui globalmente caso a API tenha duplicado algum token
    res = res.split(item.placeholder).join(item.replacement);
  }
  return res;
}

// Tradução de texto individual
async function translateText(sourceText, glossary = null, targetLang = 'pt') {
  if (!sourceText || !sourceText.trim()) return '';

  const { text: masked, tags } = protectGlossaryAndTags(sourceText, glossary);

  // Se o texto for apenas números, símbolos ou tags
  if (/^[\d\s\-_.,;:()]+$/.test(masked.trim())) {
    return sourceText;
  }

  try {
    // sl=auto detecta automaticamente se a origem é Inglês ou Chinês
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(masked)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    let translated = '';
    if (data && data[0]) {
      for (const part of data[0]) {
        if (part[0]) translated += part[0];
      }
    }

    if (!translated) throw new Error('Tradução retornou vazia');
    return restoreAll(translated, tags);
  } catch (err) {
    console.error(`[translateText Falha]: ${err.message}`);
    throw err;
  }
}

// Tradução em lote de itens pendentes
async function batchTranslate(limit = 50, author = 'IA + Take Over') {
  console.log('=====================================================');
  console.log(`    Tales of Immortal - Tradutor Automático de Lote`);
  console.log('=====================================================\n');

  if (!fs.existsSync(config.pendingFile)) {
    console.log('Nenhum arquivo pending.json encontrado. Execute sync.js primeiro.');
    return;
  }

  const pending = JSON.parse(fs.readFileSync(config.pendingFile, 'utf8'));
  const database = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));
  const glossary = fs.existsSync(config.glossaryFile) 
    ? JSON.parse(fs.readFileSync(config.glossaryFile, 'utf8')) 
    : { terms: [] };

  console.log(`Total pendente no momento: ${pending.length}`);
  const itemsToTranslate = pending.slice(0, limit);
  console.log(`Processando lote de ${itemsToTranslate.length} itens...\n`);

  let successCount = 0;
  const remainingPending = [];
  const now = new Date().toISOString();

  for (let i = 0; i < itemsToTranslate.length; i++) {
    const item = itemsToTranslate[i];
    const source = item.en || item.ch;
    
    process.stdout.write(`[${i + 1}/${itemsToTranslate.length}] ${item.file} (${item.identifier})... `);
    
    try {
      const pt = await translateText(source, glossary, 'pt');

      if (item.file === 'LocalText') {
        database.localText[item.key] = {
          id: item.id,
          key: item.key,
          pt: pt,
          ch: item.ch,
          en: item.en,
          author: author,
          updatedAt: now
        };
      } else {
        database.roleLog[item.id] = {
          id: item.id,
          keyID: item.keyID,
          pt: pt,
          ch: item.ch,
          en: item.en,
          author: author,
          updatedAt: now
        };
      }

      successCount++;
      console.log('OK');
    } catch (e) {
      console.log(`Falha: ${e.message}`);
      remainingPending.push(item);
    }

    // Pequeno intervalo para requisições
    await new Promise(r => setTimeout(r, 150));
  }

  const finalPending = remainingPending.concat(pending.slice(limit));

  fs.writeFileSync(config.databaseFile, JSON.stringify(database, null, 2), 'utf8');
  fs.writeFileSync(config.pendingFile, JSON.stringify(finalPending, null, 2), 'utf8');

  console.log(`\nLote concluído! ${successCount} itens traduzidos e adicionados ao banco.`);
  console.log(`Itens pendentes restantes: ${finalPending.length}`);
  console.log(`Execute "node tools/scripts/build.js" para atualizar os arquivos do mod.\n`);
}

module.exports = {
  protectGlossaryAndTags,
  restoreAll,
  translateText,
  batchTranslate
};

if (require.main === module) {
  const limitArg = parseInt(process.argv[2], 10) || 50;
  batchTranslate(limitArg);
}
