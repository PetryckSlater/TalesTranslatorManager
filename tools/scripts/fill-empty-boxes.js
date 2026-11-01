const fs = require('fs');
const path = require('path');
const config = require('../config');
const { translateText } = require('./translate');

async function fillEmptyBoxes() {
  console.log('=====================================================');
  console.log('    Preenchendo Caixas Vazias (Traduzindo do Chinês)');
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

  // Localiza os itens onde o inglês veio vazio mas o chinês tem texto
  const emptyBoxes = pending.filter(x => (!x.en || !x.en.trim()) && (x.ch && x.ch.trim()));
  console.log(`Encontrados ${emptyBoxes.length} itens com chinês original sem inglês oficial.`);
  console.log('Iniciando tradução direta do chinês para o português...\n');

  let successCount = 0;
  const processedKeys = new Set();
  const now = new Date().toISOString();

  for (let i = 0; i < emptyBoxes.length; i++) {
    const item = emptyBoxes[i];
    process.stdout.write(`[${i + 1}/${emptyBoxes.length}] ${item.file} (${item.identifier})... `);

    try {
      const pt = await translateText(item.ch, glossary, 'pt');

      if (item.file === 'LocalText') {
        database.localText[item.key] = {
          id: item.id,
          key: item.key,
          pt: pt,
          ch: item.ch,
          en: pt, // Preenche também como fallback
          author: 'IA (Direto do Chinês)',
          updatedAt: now
        };
        processedKeys.add(`LocalText_${item.key}`);
      } else {
        database.roleLog[item.id] = {
          id: item.id,
          keyID: item.keyID,
          pt: pt,
          ch: item.ch,
          en: pt,
          author: 'IA (Direto do Chinês)',
          updatedAt: now
        };
        processedKeys.add(`RoleLogLocal_${item.id}`);
      }

      successCount++;
      console.log('OK');
    } catch (e) {
      console.log(`Erro: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 120));
  }

  // Remove os processados de pending.json
  const remainingPending = pending.filter(x => !processedKeys.has(`${x.file}_${x.identifier}`));

  fs.writeFileSync(config.databaseFile, JSON.stringify(database, null, 2), 'utf8');
  fs.writeFileSync(config.pendingFile, JSON.stringify(remainingPending, null, 2), 'utf8');

  console.log(`\nSucesso! ${successCount} caixas vazias foram traduzidas e preenchidas.`);
  console.log('Recompilando mod...');

  delete require.cache[require.resolve('./build')];
  require('./build');
}

fillEmptyBoxes();
