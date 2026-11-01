const fs = require('fs');
const path = require('path');
const config = require('../config');

function normalizeText(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/\\r\\n/g, '\n').replace(/\\\\r\\\\n/g, '\n').replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim();
}

function runSync() {
  console.log('=====================================================');
  console.log('    Tales of Immortal - Sync & Diff Engine');
  console.log('=====================================================\n');

  if (!fs.existsSync(config.gameSourceDir)) {
    console.error(`ERRO: Diretório de origem não encontrado: ${config.gameSourceDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }

  // 1. Carregar ou Inicializar Banco de Dados de Traduções
  let database = {
    localText: {},   // indexado por key
    roleLog: {},     // indexado por id
    battleSkill: {}  // indexado por id
  };

  if (fs.existsSync(config.databaseFile)) {
    console.log('Carregando banco de dados existente...');
    try {
      database = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));
    } catch (e) {
      console.warn('Aviso: Falha ao ler database.json existente, reconstruindo a partir dos arquivos do mod.');
    }
  }

  // Se o banco estiver vazio, importa do ModProject existente
  const dbLocalCount = Object.keys(database.localText || {}).length;
  const dbRoleCount = Object.keys(database.roleLog || {}).length;

  if (dbLocalCount === 0 || dbRoleCount === 0) {
    console.log('Inicializando banco a partir da sua versão traduzida atual (ModProject_VMCUi0)...');
    
    const modLocalPath = path.join(config.modExcelDir, 'LocalText.json');
    if (fs.existsSync(modLocalPath)) {
      const modLocal = JSON.parse(fs.readFileSync(modLocalPath, 'utf8'));
      modLocal.forEach(item => {
        if (item.key && item.en) {
          database.localText[item.key] = {
            id: item.id,
            key: item.key,
            pt: item.en,
            ch: item.ch || '',
            tc: item.tc || ''
          };
        }
      });
      console.log(`  Importados ${Object.keys(database.localText).length} textos de LocalText.json.`);
    }

    const modRolePath = path.join(config.modExcelDir, 'RoleLogLocal.json');
    if (fs.existsSync(modRolePath)) {
      const modRole = JSON.parse(fs.readFileSync(modRolePath, 'utf8'));
      modRole.forEach(item => {
        if (item.id && item.en) {
          database.roleLog[item.id] = {
            id: item.id,
            keyID: item.keyID,
            pt: item.en,
            ch: item.ch || '',
            tc: item.tc || ''
          };
        }
      });
      console.log(`  Importados ${Object.keys(database.roleLog).length} registros de RoleLogLocal.json.`);
    }

    const modBattlePath = path.join(config.modExcelDir, 'BattleSkillPrefixName.json');
    if (fs.existsSync(modBattlePath)) {
      const modBattle = JSON.parse(fs.readFileSync(modBattlePath, 'utf8'));
      modBattle.forEach(item => {
        if (item.id && item.en) {
          database.battleSkill[item.id] = {
            id: item.id,
            pt: item.en,
            text: item.text || ''
          };
        }
      });
      console.log(`  Importados ${Object.keys(database.battleSkill).length} prefixos de BattleSkillPrefixName.json.`);
    }
  }

  // 2. Carregar os Novos Arquivos em Inglês (Game Update)
  console.log('\nLendo arquivos da nova versão oficial (TalesEnglishVersion)...');
  const engLocalPath = path.join(config.gameSourceDir, 'LocalText.json');
  const engRolePath = path.join(config.gameSourceDir, 'RoleLogLocal.json');

  const engLocal = JSON.parse(fs.readFileSync(engLocalPath, 'utf8'));
  const engRole = JSON.parse(fs.readFileSync(engRolePath, 'utf8'));

  console.log(`  LocalText oficial: ${engLocal.length} linhas.`);
  console.log(`  RoleLogLocal oficial: ${engRole.length} linhas.`);

  const pending = [];
  const modified = [];

  let localPreserved = 0;
  let localModified = 0;
  let localPending = 0;

  // 3. Processar LocalText (Mapeamento OBRIGATÓRIO por 'key')
  for (const item of engLocal) {
    const existing = database.localText[item.key];
    if (!existing || !existing.pt) {
      localPending++;
      pending.push({
        file: 'LocalText',
        identifier: item.key,
        id: item.id,
        key: item.key,
        ch: item.ch || '',
        en: item.en || ''
      });
    } else {
      // Verifica se o chinês original mudou na atualização
      const origNorm = normalizeText(existing.ch);
      const newNorm = normalizeText(item.ch);
      if (origNorm && newNorm && origNorm !== newNorm) {
        localModified++;
        modified.push({
          file: 'LocalText',
          identifier: item.key,
          id: item.id,
          key: item.key,
          oldCh: existing.ch,
          newCh: item.ch,
          newEn: item.en,
          currentPt: existing.pt
        });
      } else {
        localPreserved++;
      }
    }
  }

  // 4. Processar RoleLogLocal (Mapeamento por 'id')
  let rolePreserved = 0;
  let roleModified = 0;
  let rolePending = 0;

  for (const item of engRole) {
    const existing = database.roleLog[item.id];
    if (!existing || !existing.pt) {
      rolePending++;
      pending.push({
        file: 'RoleLogLocal',
        identifier: item.id,
        id: item.id,
        keyID: item.keyID,
        ch: item.ch || '',
        en: item.en || ''
      });
    } else {
      const origNorm = normalizeText(existing.ch);
      const newNorm = normalizeText(item.ch);
      if (origNorm && newNorm && origNorm !== newNorm) {
        roleModified++;
        modified.push({
          file: 'RoleLogLocal',
          identifier: item.id,
          id: item.id,
          keyID: item.keyID,
          oldCh: existing.ch,
          newCh: item.ch,
          newEn: item.en,
          currentPt: existing.pt
        });
      } else {
        rolePreserved++;
      }
    }
  }

  // 5. Salvar Relatórios e Banco Atualizado
  fs.writeFileSync(config.databaseFile, JSON.stringify(database, null, 2), 'utf8');
  fs.writeFileSync(config.pendingFile, JSON.stringify(pending, null, 2), 'utf8');
  fs.writeFileSync(config.modifiedFile, JSON.stringify(modified, null, 2), 'utf8');

  // 6. Resumo Final
  const totalEntries = engLocal.length + engRole.length;
  const totalPreserved = localPreserved + rolePreserved;
  const totalModified = localModified + roleModified;
  const totalPending = localPending + rolePending;
  const pctTranslated = ((totalPreserved / totalEntries) * 100).toFixed(1);

  console.log('\n=====================================================');
  console.log('                 RESULTADO DO SYNC');
  console.log('=====================================================');
  console.log(`Total de Linhas Oficiais:      ${totalEntries.toLocaleString('pt-BR')}`);
  console.log(`Linhas Traduzidas e Intactas:  ${totalPreserved.toLocaleString('pt-BR')} (${pctTranslated}%)`);
  console.log(`Linhas Modificadas p/ Revisar: ${totalModified.toLocaleString('pt-BR')}`);
  console.log(`Linhas Novas para Traduzir:    ${totalPending.toLocaleString('pt-BR')}`);
  console.log('-----------------------------------------------------');
  console.log(`LocalText.json:    ${localPreserved} intactos | ${localModified} alterados | ${localPending} novos`);
  console.log(`RoleLogLocal.json: ${rolePreserved} intactos | ${roleModified} alterados | ${rolePending} novos`);
  console.log('-----------------------------------------------------');
  console.log(`Salvo em:`);
  console.log(`  - Banco mestre: ${config.databaseFile}`);
  console.log(`  - Pendentes:    ${config.pendingFile} (${pending.length} itens)`);
  console.log(`  - Modificados:  ${config.modifiedFile} (${modified.length} itens)`);
  console.log('=====================================================\n');
}

runSync();
