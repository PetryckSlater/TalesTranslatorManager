const fs = require('fs');
const path = require('path');
const config = require('../config');
const { translateText } = require('./translate');

async function resolveModified() {
  console.log('=====================================================');
  console.log('   Atualizando as 260 Linhas Modificadas pelos Devs');
  console.log('=====================================================\n');

  if (!fs.existsSync(config.modifiedFile)) {
    console.log('Nenhum arquivo modified.json encontrado.');
    return;
  }

  const modified = JSON.parse(fs.readFileSync(config.modifiedFile, 'utf8'));
  const database = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));
  const glossary = fs.existsSync(config.glossaryFile)
    ? JSON.parse(fs.readFileSync(config.glossaryFile, 'utf8'))
    : { terms: [] };

  console.log(`Processando ${modified.length} itens modificados...\n`);
  let successCount = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < modified.length; i++) {
    const item = modified[i];
    const source = item.newEn || item.newCh;
    process.stdout.write(`[${i + 1}/${modified.length}] ${item.file} (${item.identifier})... `);

    try {
      const pt = await translateText(source, glossary, 'pt');

      if (item.file === 'LocalText') {
        database.localText[item.key] = {
          id: item.id,
          key: item.key,
          pt: pt,
          ch: item.newCh,
          en: item.newEn,
          author: 'IA + Take Over (Update)',
          updatedAt: now
        };
      } else {
        database.roleLog[item.id] = {
          id: item.id,
          keyID: item.keyID,
          pt: pt,
          ch: item.newCh,
          en: item.newEn,
          author: 'IA + Take Over (Update)',
          updatedAt: now
        };
      }

      successCount++;
      console.log('OK');
    } catch (e) {
      console.log(`Erro: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 120));
  }

  // Esvazia modified.json pois todas foram atualizadas
  fs.writeFileSync(config.databaseFile, JSON.stringify(database, null, 2), 'utf8');
  fs.writeFileSync(config.modifiedFile, JSON.stringify([], null, 2), 'utf8');

  console.log(`\nConcluído! ${successCount} linhas modificadas foram atualizadas com sucesso no banco de dados!`);
  console.log('Compilando mod com as novas alterações...');
  
  delete require.cache[require.resolve('./build')];
  require('./build');
}

resolveModified();
