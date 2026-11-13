const fs = require('fs');
const path = require('path');
const config = require('../config');

function runBuild() {
  console.log('=====================================================');
  console.log('    Tales of Immortal - Mod Build & Exporter');
  console.log('=====================================================\n');

  if (!fs.existsSync(config.databaseFile)) {
    console.error('ERRO: Banco de dados de tradução não encontrado! Execute primeiro "node tools/scripts/sync.js".');
    process.exit(1);
  }

  const database = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));

  // Carregar arquivos oficiais de referência
  const engLocalPath = path.join(config.gameSourceDir, 'LocalText.json');
  const engRolePath = path.join(config.gameSourceDir, 'RoleLogLocal.json');

  if (!fs.existsSync(engLocalPath) || !fs.existsSync(engRolePath)) {
    console.error('ERRO: Arquivos de referência em TalesEnglishVersion não encontrados.');
    process.exit(1);
  }

  const engLocal = JSON.parse(fs.readFileSync(engLocalPath, 'utf8'));
  const engRole = JSON.parse(fs.readFileSync(engRolePath, 'utf8'));

  // Pastas de destino:
  // 1. Pública (output/ModExcel) - para o GitHub
  // 2. Privada (ModProject_VMCUi0/...) - exclusiva do criador do mod
  // 3. Debug (ModProject_VMCUi0/debug/Mod_VMCUi0/ModExcel) - para depuração e Steam
  // 4. Workshop local ativa (se o usuário estiver jogando via inscrição Steam)
  const targetDirs = [config.publicOutputDir];
  if (fs.existsSync(path.join(config.rootDir, 'ModProject_VMCUi0'))) {
    targetDirs.push(config.privateModDir);
    const debugExcelDir = path.join(config.rootDir, 'ModProject_VMCUi0', 'debug', 'Mod_VMCUi0', 'ModExcel');
    targetDirs.push(debugExcelDir);
  }

  const workshopDir = 'D:/SteamLibrary/steamapps/workshop/content/1468810/2990310797';
  if (fs.existsSync(workshopDir)) {
    const wsExcel1 = path.join(workshopDir, 'ModProject', 'ModExcel');
    const wsExcel2 = path.join(workshopDir, 'debug', 'Mod_VMCUi0', 'ModExcel');
    targetDirs.push(wsExcel1, wsExcel2);
  }

  targetDirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  console.log('Compilando LocalText.json...');
  let localTranslated = 0;
  let localFallback = 0;

  const outputLocal = engLocal.map(item => {
    const entry = database.localText[item.key];
    const result = { ...item };

    if (entry && entry.pt) {
      result.en = entry.pt;
      localTranslated++;
    } else {
      localFallback++;
      if (!result.en && result.ch) {
        result.en = result.ch;
      }
    }

    if (config.modSettings.stripKorean) {
      delete result.kr;
    }
    if (config.modSettings.stripTraditionalChinese) {
      delete result.tc;
    }

    return result;
  });

  console.log('Compilando RoleLogLocal.json...');
  let roleTranslated = 0;
  let roleFallback = 0;

  const outputRole = engRole.map(item => {
    const entry = database.roleLog[item.id];
    const result = { ...item };

    if (entry && entry.pt) {
      result.en = entry.pt;
      roleTranslated++;
    } else {
      roleFallback++;
      if (!result.en && result.ch) {
        result.en = result.ch;
      }
    }

    if (config.modSettings.stripKorean) {
      delete result.kr;
    }
    if (config.modSettings.stripTraditionalChinese) {
      delete result.tc;
    }

    return result;
  });

  // Salvar arquivos em todos os diretórios alvo (com suporte a minificação de alto desempenho)
  const indent = config.modSettings.minify ? 0 : (config.modSettings.indent || 0);
  const jsonLocal = indent > 0 ? JSON.stringify(outputLocal, null, indent) : JSON.stringify(outputLocal);
  const jsonRole = indent > 0 ? JSON.stringify(outputRole, null, indent) : JSON.stringify(outputRole);

  console.log('\nGravando arquivos compilados...');
  targetDirs.forEach(dir => {
    fs.writeFileSync(path.join(dir, 'LocalText.json'), jsonLocal, 'utf8');
    fs.writeFileSync(path.join(dir, 'RoleLogLocal.json'), jsonRole, 'utf8');
  });

  // Compilar BattleSkillPrefixName se existir no banco
  if (database.battleSkill && Object.keys(database.battleSkill).length > 0) {
    let baseBattle = [];
    const origBattle = path.join(config.privateModDir, 'BattleSkillPrefixName.json');
    if (fs.existsSync(origBattle)) {
      baseBattle = JSON.parse(fs.readFileSync(origBattle, 'utf8'));
    } else {
      baseBattle = Object.values(database.battleSkill).map(x => ({ id: x.id, text: x.text, en: x.pt }));
    }

    const outputBattle = baseBattle.map(item => {
      const entry = database.battleSkill[item.id];
      if (entry && entry.pt) {
        return { ...item, en: entry.pt };
      }
      return item;
    });

    const jsonBattle = indent > 0 ? JSON.stringify(outputBattle, null, indent) : JSON.stringify(outputBattle);
    targetDirs.forEach(dir => {
      fs.writeFileSync(path.join(dir, 'BattleSkillPrefixName.json'), jsonBattle, 'utf8');
    });
    console.log('  BattleSkillPrefixName.json atualizado.');
  }

  // Compilar módulo C# Harmony se disponível
  try {
    const compileCSharp = require('./compile-csharp');
    compileCSharp();
  } catch (err) {
    console.warn('  Aviso: Não foi possível compilar módulo C#: ' + err.message);
  }

  // Estatísticas de tamanho de arquivo
  const outLocalPath = path.join(config.publicOutputDir, 'LocalText.json');
  const outRolePath = path.join(config.publicOutputDir, 'RoleLogLocal.json');
  const origLocalSize = (fs.statSync(engLocalPath).size / (1024 * 1024)).toFixed(2);
  const newLocalSize = (fs.statSync(outLocalPath).size / (1024 * 1024)).toFixed(2);
  const origRoleSize = (fs.statSync(engRolePath).size / (1024 * 1024)).toFixed(2);
  const newRoleSize = (fs.statSync(outRolePath).size / (1024 * 1024)).toFixed(2);

  const totalTranslated = localTranslated + roleTranslated;
  const totalItems = engLocal.length + engRole.length;
  const pct = ((totalTranslated / totalItems) * 100).toFixed(1);

  console.log('\n=====================================================');
  console.log('              COMPILAÇÃO DO MOD CONCLUÍDA');
  console.log('=====================================================');
  console.log(`LocalText.json:    ${localTranslated.toLocaleString('pt-BR')} traduzidas / ${engLocal.length.toLocaleString('pt-BR')} total (${localFallback} em inglês)`);
  console.log(`  Tamanho original: ${origLocalSize} MB -> Mod otimizado: ${newLocalSize} MB (Economia: ${(origLocalSize - newLocalSize).toFixed(1)} MB)`);
  console.log('-----------------------------------------------------');
  console.log(`RoleLogLocal.json: ${roleTranslated.toLocaleString('pt-BR')} traduzidas / ${engRole.length.toLocaleString('pt-BR')} total (${roleFallback} em inglês)`);
  console.log(`  Tamanho original: ${origRoleSize} MB -> Mod otimizado: ${newRoleSize} MB (Economia: ${(origRoleSize - newRoleSize).toFixed(1)} MB)`);
  console.log('-----------------------------------------------------');
  console.log(`Progresso Geral da Tradução: ${pct}% (${totalTranslated.toLocaleString('pt-BR')} / ${totalItems.toLocaleString('pt-BR')})`);
  console.log(`Diretórios atualizados:`);
  targetDirs.forEach(d => console.log(`  - ${d}`));
  console.log('=====================================================\n');
}

module.exports = runBuild;

if (require.main === module) {
  runBuild();
}
