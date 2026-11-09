const fs = require('fs');
const path = require('path');
const config = require('../config');
const { protectGlossaryAndTags, restoreAll } = require('./translate');
const { translate: bingTranslate } = require('bing-translate-api');

async function testConnection() {
  const testPhrase = 'Hello world, this is a test.';
  try {
    const res = await bingTranslate(testPhrase, null, 'pt');
    if (!res || !res.translation) throw new Error('Resposta vazia');
    console.log(`[Rede] Conexão com Bing Translate OK! Teste: "${testPhrase}" -> "${res.translation}"\n`);
    return true;
  } catch (err) {
    console.error(`[ERRO DE CONEXÃO] Falha ao conectar ao Bing Translate: ${err.message}`);
    process.exit(1);
  }
}

async function callTranslate(text, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await bingTranslate(text, null, 'pt');
      if (res && res.translation) {
        return res.translation;
      }
      throw new Error('Tradução vazia');
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[Aviso] Falha temporária (${err.message}). Retentando tentativa ${attempt + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('Número máximo de tentativas excedido');
}

async function translateSingle(sourceText, glossary) {
  if (!sourceText || !sourceText.trim()) return '';
  const { text: masked, tags } = protectGlossaryAndTags(sourceText, glossary);
  if (/^[\d\s\-_.,;:()]+$/.test(masked.trim())) return sourceText;

  const translated = await callTranslate(masked);
  if (!translated) return sourceText;
  return restoreAll(translated, tags);
}

async function translateBatch(items, glossary) {
  const prepared = items.map(item => protectGlossaryAndTags(item.source, glossary));
  const maskedTexts = prepared.map(p => p.text);
  const delim = '\n@@@\n';
  const joined = maskedTexts.join(delim);

  const full = await callTranslate(joined);
  const split = full.split(/\s*@@@\s*/);

  if (split.length === items.length) {
    return split.map((s, i) => restoreAll(s, prepared[i].tags));
  }

  // Fallback: tradução individual caso o delimitador tenha sido alterado
  console.log(`[Aviso] Delimitador divergente (${split.length} vs ${items.length}). Fallback individual...`);
  const results = [];
  for (const item of items) {
    const pt = await translateSingle(item.source, glossary);
    results.push(pt);
    await new Promise(r => setTimeout(r, 100));
  }
  return results;
}

async function run() {
  console.log('=====================================================');
  console.log('   Tales of Immortal - Tradução Real dos Diálogos DLC');
  console.log('=====================================================\n');

  await testConnection();

  const database = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));
  const glossary = fs.existsSync(config.glossaryFile)
    ? JSON.parse(fs.readFileSync(config.glossaryFile, 'utf8'))
    : { terms: [] };

  // Identificar diálogos em roleLog que precisam de tradução
  const roleLogToFix = [];
  for (const [id, entry] of Object.entries(database.roleLog)) {
    // Se já foi traduzido com sucesso oficial nesta sessão, pular
    if (entry.author === 'IA (Oficial Traduzido)') continue;

    const isIaDialog = entry.author === 'IA + Take Over (Diálogos)';
    const isEmpty = !entry.pt || !entry.pt.trim();
    const isEn = entry.en && entry.pt && entry.pt.trim().toLowerCase() === entry.en.trim().toLowerCase() && /[a-zA-Z]{3,}/.test(entry.en);

    if (isIaDialog || isEmpty || isEn) {
      const source = (entry.en && entry.en.trim()) ? entry.en : entry.ch;
      if (source && source.trim()) {
        roleLogToFix.push({ id, source, ch: entry.ch, en: entry.en });
      }
    }
  }

  const limitArg = parseInt(process.argv[2], 10);
  const itemsToProcess = limitArg ? roleLogToFix.slice(0, limitArg) : roleLogToFix;
  console.log(`Total de diálogos de RoleLogLocal pendentes: ${roleLogToFix.length} (Processando nesta execução: ${itemsToProcess.length})\n`);

  if (itemsToProcess.length === 0) {
    console.log('Nenhum diálogo pendente para traduzir!');
    console.log('Compilando arquivos do mod...');
    const runBuild = require('./build');
    runBuild();
    return;
  }

  const BATCH_SIZE = 15;
  let successCount = 0;
  const now = new Date().toISOString();

  function saveDb() {
    fs.writeFileSync(config.databaseFile, JSON.stringify(database, null, 2), 'utf8');
  }

  for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
    const batch = itemsToProcess.slice(i, i + BATCH_SIZE);
    try {
      const translatedBatch = await translateBatch(batch, glossary);

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const pt = translatedBatch[j];
        database.roleLog[item.id] = {
          ...database.roleLog[item.id],
          id: item.id,
          pt: pt,
          author: 'IA (Oficial Traduzido)',
          updatedAt: now
        };
      }

      successCount += batch.length;
      const pct = ((successCount / itemsToProcess.length) * 100).toFixed(1);
      console.log(`[${successCount}/${itemsToProcess.length}] (${pct}%) Diálogo ${batch[batch.length - 1].id} OK`);

      if (successCount % 150 === 0 || successCount === itemsToProcess.length) {
        saveDb();
        console.log(`💾 Checkpoint salvo (${successCount} itens traduzidos).`);
      }
    } catch (err) {
      console.error(`Erro no lote ${i}-${i + BATCH_SIZE}: ${err.message}. Retentando 1 por 1...`);
      for (const item of batch) {
        try {
          const pt = await translateSingle(item.source, glossary);
          database.roleLog[item.id] = {
            ...database.roleLog[item.id],
            id: item.id,
            pt: pt,
            author: 'IA (Oficial Traduzido)',
            updatedAt: now
          };
          successCount++;
        } catch (e2) {
          console.error(`Falha no item ${item.id}: ${e2.message}`);
        }
        await new Promise(r => setTimeout(r, 100));
      }
      saveDb();
    }

    // Intervalo suave entre lotes (250ms)
    await new Promise(r => setTimeout(r, 250));
  }

  saveDb();
  console.log(`\n=====================================================`);
  console.log(`🎉 CONCLUÍDO! ${successCount} DIÁLOGOS FORAM TRADUZIDOS!`);
  console.log(`=====================================================\n`);

  console.log('Compilando arquivos do mod atualizados...');
  const runBuild = require('./build');
  runBuild();

  console.log('\nVerificando diálogo do print (ID 8250003):');
  const check = database.roleLog['8250003'];
  console.log(JSON.stringify(check, null, 2));
}

run().catch(console.error);
