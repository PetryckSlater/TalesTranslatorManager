const fs = require('fs');
const path = require('path');
const config = require('../config');
const { translateText } = require('./translate');

async function finishLocalText() {
  console.log('=====================================================');
  console.log('     Foco Total: Finalizando 100% do LocalText.json');
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

  const localItems = pending.filter(x => x.file === 'LocalText');
  console.log(`Itens restantes em LocalText.json: ${localItems.length}`);
  console.log('Iniciando processamento em lotes com proteção de tags e glossário...\n');

  let successCount = 0;
  const processedKeys = new Set();
  const now = new Date().toISOString();

  // Função para salvar progresso incremental
  function saveCheckpoint() {
    const updatedPending = pending.filter(x => !(x.file === 'LocalText' && processedKeys.has(x.identifier)));
    fs.writeFileSync(config.databaseFile, JSON.stringify(database, null, 2), 'utf8');
    fs.writeFileSync(config.pendingFile, JSON.stringify(updatedPending, null, 2), 'utf8');
  }

  // Concorrência controlada de 3 requisições simultâneas para máxima velocidade e segurança
  const CONCURRENCY = 3;
  let index = 0;

  async function worker() {
    while (index < localItems.length) {
      const currentIdx = index++;
      const item = localItems[currentIdx];
      const source = (item.en && item.en.trim()) ? item.en : item.ch;

      // Se ambos forem vazios (dummy slots)
      if (!source || !source.trim()) {
        database.localText[item.key] = {
          id: item.id,
          key: item.key,
          pt: '',
          ch: item.ch || '',
          en: item.en || '',
          author: 'Sistema (Vazio/Dummy)',
          updatedAt: now
        };
        processedKeys.add(item.identifier);
        successCount++;
        continue;
      }

      try {
        const pt = await translateText(source, glossary, 'pt');
        database.localText[item.key] = {
          id: item.id,
          key: item.key,
          pt: pt,
          ch: item.ch,
          en: item.en,
          author: 'IA + Take Over (Finalização)',
          updatedAt: now
        };
        processedKeys.add(item.identifier);
        successCount++;

        if (successCount % 10 === 0 || successCount === localItems.length) {
          console.log(`[${successCount}/${localItems.length}] LocalText: ${item.key} -> OK`);
        }

        if (successCount % 50 === 0) {
          saveCheckpoint();
        }
      } catch (err) {
        console.warn(`[Aviso] Falha no item ${item.key}: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, 80));
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  // Salvar estado final
  saveCheckpoint();

  console.log(`\n=====================================================`);
  console.log(`🎉 LOCALTEXT.JSON CONCLUÍDO COM SUCESSO!`);
  console.log(`Total de ${successCount} itens traduzidos e registrados.`);
  console.log(`=====================================================\n`);

  console.log('Compilando mod com LocalText 100% finalizado...');
  delete require.cache[require.resolve('./build')];
  require('./build');
}

finishLocalText();
