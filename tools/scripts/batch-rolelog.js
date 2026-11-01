const fs = require('fs');
const path = require('path');
const config = require('../config');
const { translateText } = require('./translate');

async function batchRoleLog(targetCount = 1000) {
  console.log('=====================================================');
  console.log(`    Traduzindo Lote de ${targetCount} Textos de RoleLogLocal`);
  console.log('=====================================================\n');

  if (!fs.existsSync(config.pendingFile)) {
    console.log('Nenhum arquivo pending.json encontrado.');
    return;
  }

  const pending = JSON.parse(fs.readFileSync(config.pendingFile, 'utf8'));
  const database = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));
  const glossary = fs.existsSync(config.glossaryFile)
    ? JSON.parse(fs.readFileSync(config.glossaryFile, 'utf8'))
    : { terms: [] };

  const roleItems = pending.filter(x => x.file === 'RoleLogLocal');
  const countToProcess = Math.min(targetCount, roleItems.length);
  const itemsToProcess = roleItems.slice(0, countToProcess);

  console.log(`Total pendente em RoleLogLocal: ${roleItems.length}`);
  console.log(`Processando os próximos ${itemsToProcess.length} diálogos...\n`);

  let successCount = 0;
  const processedIds = new Set();
  const now = new Date().toISOString();

  function saveCheckpoint() {
    const updatedPending = pending.filter(x => !(x.file === 'RoleLogLocal' && processedIds.has(x.identifier)));
    fs.writeFileSync(config.databaseFile, JSON.stringify(database, null, 2), 'utf8');
    fs.writeFileSync(config.pendingFile, JSON.stringify(updatedPending, null, 2), 'utf8');
  }

  // 4 workers paralelos para processar com fluidez
  const CONCURRENCY = 4;
  let index = 0;

  async function worker() {
    while (index < itemsToProcess.length) {
      const currentIdx = index++;
      const item = itemsToProcess[currentIdx];
      const source = (item.en && item.en.trim()) ? item.en : item.ch;

      if (!source || !source.trim()) {
        database.roleLog[item.id] = {
          id: item.id,
          keyID: item.keyID,
          pt: '',
          ch: item.ch || '',
          en: item.en || '',
          author: 'Sistema (Vazio)',
          updatedAt: now
        };
        processedIds.add(item.identifier);
        successCount++;
        continue;
      }

      try {
        const pt = await translateText(source, glossary, 'pt');
        database.roleLog[item.id] = {
          id: item.id,
          keyID: item.keyID,
          pt: pt,
          ch: item.ch,
          en: item.en,
          author: 'IA + Take Over (Diálogos)',
          updatedAt: now
        };
        processedIds.add(item.identifier);
        successCount++;

        if (successCount % 25 === 0 || successCount === itemsToProcess.length) {
          console.log(`[${successCount}/${itemsToProcess.length}] Diálogo (ID: ${item.id}, ${item.keyID}) -> OK`);
        }

        if (successCount % 50 === 0) {
          saveCheckpoint();
        }
      } catch (err) {
        console.warn(`[Aviso] Falha no item ${item.id}: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, 60));
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  // Salvar estado final
  saveCheckpoint();

  console.log(`\n=====================================================`);
  console.log(`🎉 LOTE DE ${successCount} DIÁLOGOS CONCLUÍDO!`);
  console.log(`=====================================================\n`);

  console.log('Compilando mod atualizado...');
  delete require.cache[require.resolve('./build')];
  require('./build');
}

const countArg = parseInt(process.argv[2], 10) || 1000;
batchRoleLog(countArg);
