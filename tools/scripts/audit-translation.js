const fs = require('fs');
const path = require('path');
const config = require('../config');

// Regras de substituição de tags corrompidas / traduzidas
const TAG_FIXES = [
  // Espaços internos em tags simples ou compostas (ex: { 0 }, {name | A}, {gender2| X})
  { regex: /\{\s+([0-9]+)\s*\}/g, replace: '{$1}' },
  { regex: /\{([0-9]+)\s+\}/g, replace: '{$1}' },
  { regex: /\{\s+([A-Za-z0-9_#]+)\s*\|\s*([A-Za-z0-9_#]+)\s*\}/g, replace: '{$1|$2}' },
  { regex: /\{([A-Za-z0-9_#]+)\s+\|\s*([A-Za-z0-9_#]+)\s*\}/g, replace: '{$1|$2}' },
  { regex: /\{([A-Za-z0-9_#]+)\s*\|\s+([A-Za-z0-9_#]+)\s*\}/g, replace: '{$1|$2}' },
  { regex: /\{([A-Za-z0-9_#]+)\s*\|\s*([A-Za-z0-9_#]+)\s+\}/g, replace: '{$1|$2}' },
  { regex: /\{\s+([A-Za-z0-9_#]+)\s*\|\s*([A-Za-z0-9_#]+)\s*\|\s*([A-Za-z0-9_#]+)\s*\}/g, replace: '{$1|$2|$3}' },
  { regex: /\{([A-Za-z0-9_#]+)\s+\|\s*([A-Za-z0-9_#]+)\s*\|\s*([A-Za-z0-9_#]+)\s*\}/g, replace: '{$1|$2|$3}' },
  { regex: /\{([A-Za-z0-9_#]+)\s*\|\s+([A-Za-z0-9_#]+)\s*\|\s*([A-Za-z0-9_#]+)\s*\}/g, replace: '{$1|$2|$3}' },
  { regex: /\{([A-Za-z0-9_#]+)\s*\|\s*([A-Za-z0-9_#]+)\s+\|\s*([A-Za-z0-9_#]+)\s*\}/g, replace: '{$1|$2|$3}' },
  { regex: /\{([A-Za-z0-9_#]+)\s*\|\s*([A-Za-z0-9_#]+)\s*\|\s+([A-Za-z0-9_#]+)\s*\}/g, replace: '{$1|$2|$3}' },
  { regex: /\{([A-Za-z0-9_#]+)\s*\|\s*([A-Za-z0-9_#]+)\s*\|\s*([A-Za-z0-9_#]+)\s+\}/g, replace: '{$1|$2|$3}' },
  { regex: /\{\s+#([A-Za-z0-9_]+)\s*\}/g, replace: '{#$1}' },
  { regex: /\{#([A-Za-z0-9_]+)\s+\}/g, replace: '{#$1}' },
  { regex: /\{\s+([A-Za-z0-9_]+)\s*\}/g, replace: '{$1}' },
  { regex: /\{([A-Za-z0-9_]+)\s+\}/g, replace: '{$1}' },

  // Tags traduzidas incorretamente pelo tradutor
  { regex: /\{s[ée]rie\|/gi, replace: '{grade|' },
  { regex: /\{s[ée]rieV\|/gi, replace: '{gradeV|' },
  { regex: /\{grade\s+V\|/gi, replace: '{gradeV|' },
  { regex: /\{grau\|/gi, replace: '{grade|' },
  { regex: /\{grauV\|/gi, replace: '{gradeV|' },
  { regex: /\{posto\|/gi, replace: '{post|' },
  { regex: /\{nome\|/gi, replace: '{name|' },
  { regex: /\{escola\|/gi, replace: '{school|' },
  { regex: /\{chamada\|/gi, replace: '{call|' },
  { regex: /\{n[íi]vel\|/gi, replace: '{level|' },
  { regex: /\{fam[íi]lia\|/gi, replace: '{family|' },
  { regex: /\{rela[çc][ãa]o\|/gi, replace: '{relation|' },

  // Erros específicos de colchete cortado
  { regex: /\{1\s+m[êe]s/gi, replace: '{1} meses' },
  { regex: /\{gender2\}C\}/g, replace: '{gender|C}' },
];

// Termos em chinês residuais
const CJK_REPLACEMENTS = [
  // Datas chinesas em notas de patch (ex: 2021年10月11日22时更新 -> 11/10/2021 às 22h - Atualização)
  { regex: /(\d{4})年(\d{1,2})月(\d{1,2})日(\d{1,2})时更新/g, replace: '$3/$2/$1 às $4h - Atualização' },
  { regex: /(\d{4})年(\d{1,2})月(\d{1,2})日/g, replace: '$3/$2/$1' },

  { regex: /大妖兽es/g, replace: 'Grandes Feras' },
  { regex: /大妖兽/g, replace: 'Grandes Feras' },
  { regex: /不归玄境/g, replace: 'Reino do Não Retorno' },
  { regex: /鬼谷八荒/g, replace: 'Tales of Immortal' },
  { regex: /修复了在某些情况下/g, replace: 'Corrigido: em certos casos,' },
  { regex: /修复了/g, replace: 'Corrigido:' },
  { regex: /优化了部分界面表现/g, replace: 'Otimizado: aparência da interface' },
  { regex: /优化了/g, replace: 'Otimizado:' },
  { regex: /新增了/g, replace: 'Novo:' },
  { regex: /版本更新内容/g, replace: 'Notas da Atualização' },
  { regex: /内部测试版本/g, replace: 'Versão de Testes Internos' },
  { regex: /当前为测试版本/g, replace: 'Atualmente em versão de testes' },
  { regex: /电脑用户名/g, replace: 'Nome de usuário do PC' },
  { regex: /用户名/g, replace: 'Nome de usuário' },
  { regex: /非常感谢各位道友对我们的支持/g, replace: 'Muito obrigado a todos os cultivadores pelo apoio' },
  { regex: /即不会影响正式版本的存档/g, replace: 'não afetará o save da versão oficial' },
  { regex: /请向我们反馈/g, replace: 'por favor nos envie feedback' },
  { regex: /我们会尽快处理并更新/g, replace: 'resolveremos e atualizaremos o mais rápido possível' },
];

// Termos bizarros / erros de tradução automática amadora
const BIZARRE_FIXES = [
  // Chicken Little / ofensas absurdas de tradução antiga
  {
    regex: /De volta para mais, Chicken Little\?\s*Que desperdício de espaço você é\./gi,
    replace: 'Desertor covarde, ainda tem a audácia de aparecer diante de mim? Eu te desprezo.'
  },
  { regex: /Chicken Little/gi, replace: 'Covarde' },
  { regex: /\bdois feios\b/gi, replace: 'Pista II' },
  { regex: /\(opção avançada\)/gi, replace: '(Avançar diálogo)' },
  { regex: /Oito Desperdícios/g, replace: 'Os Oito Ermos' },
  { regex: /oito desperdícios/g, replace: 'os oito ermos' },
  { regex: /oito resíduos/gi, replace: 'os oito ermos' },
  { regex: /Oi seita/g, replace: 'Salvar a seita' },
  { regex: /pele de galinha/gi, replace: 'arrepios' },
];

// Auditoria
function auditDatabase() {
  if (!fs.existsSync(config.databaseFile)) {
    throw new Error('Banco database.json não encontrado!');
  }

  const db = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));
  const issues = {
    corruptedTags: [],
    residualChinese: [],
    bizarreTerms: [],
    unclosedBrackets: [],
    stats: { totalChecked: 0, totalIssues: 0 }
  };

  const cjkRegex = /[\u4e00-\u9fff]/;

  for (const cat of ['localText', 'roleLog']) {
    if (!db[cat]) continue;
    for (const [k, v] of Object.entries(db[cat])) {
      issues.stats.totalChecked++;
      const pt = v.pt || '';
      const ch = v.ch || '';

      if (!pt) continue;

      // 1. Tags quebradas / traduzidas
      for (const fix of TAG_FIXES) {
        fix.regex.lastIndex = 0;
        if (fix.regex.test(pt)) {
          issues.corruptedTags.push({
            category: cat,
            key: k,
            text: pt,
            matchedRule: fix.regex.toString(),
            ch
          });
          break;
        }
      }

      // 2. Colchetes desbalanceados no texto (ignora teclas de teclado { e })
      if (k !== 'keyboard_LeftCurlyBracket' && k !== 'keyboard_RightCurlyBracket') {
        const openCount = (pt.match(/\{/g) || []).length;
        const closeCount = (pt.match(/\}/g) || []).length;
        if (openCount !== closeCount) {
          issues.unclosedBrackets.push({
            category: cat,
            key: k,
            text: pt,
            open: openCount,
            close: closeCount,
            ch
          });
        }
      }

      // 3. Chinês residual (ignora créditos de autores/apoiadores chineses se estiverem em campos de créditos)
      if (cjkRegex.test(pt) && !k.startsWith('author_') && !k.startsWith('credit_')) {
        issues.residualChinese.push({
          category: cat,
          key: k,
          text: pt,
          ch
        });
      }

      // 4. Termos bizarros
      for (const fix of BIZARRE_FIXES) {
        fix.regex.lastIndex = 0;
        if (fix.regex.test(pt)) {
          issues.bizarreTerms.push({
            category: cat,
            key: k,
            text: pt,
            matchedRule: fix.regex.toString(),
            ch
          });
          break;
        }
      }
    }
  }

  issues.stats.totalIssues =
    issues.corruptedTags.length +
    issues.unclosedBrackets.length +
    issues.residualChinese.length +
    issues.bizarreTerms.length;

  return { db, issues };
}

// Executa correção automática de todas as regras mapeadas
function autoFixDatabase() {
  const { db } = auditDatabase();
  let fixCount = 0;
  const fixLog = [];

  for (const cat of ['localText', 'roleLog']) {
    if (!db[cat]) continue;
    for (const [k, v] of Object.entries(db[cat])) {
      let pt = v.pt || '';
      if (!pt) continue;

      let modified = false;
      const original = pt;

      // 1. Aplica correções de tags
      for (const fix of TAG_FIXES) {
        fix.regex.lastIndex = 0;
        if (fix.regex.test(pt)) {
          pt = pt.replace(fix.regex, fix.replace);
          modified = true;
        }
      }

      // 2. Aplica correções de chinês residual
      for (const fix of CJK_REPLACEMENTS) {
        fix.regex.lastIndex = 0;
        if (fix.regex.test(pt)) {
          pt = pt.replace(fix.regex, fix.replace);
          modified = true;
        }
      }

      // 3. Aplica correções de termos bizarros
      for (const fix of BIZARRE_FIXES) {
        fix.regex.lastIndex = 0;
        if (fix.regex.test(pt)) {
          pt = pt.replace(fix.regex, fix.replace);
          modified = true;
        }
      }

      // 4. Correções manuais cirúrgicas adicionais
      if (k === 'taskDesc1108116' && pt.includes('{dungeonPos}')) {
        pt = pt.replace('{dungeonPos}', '{dungeonBoss}');
        modified = true;
      }
      if (k === 'drama_option20153031' && (pt === 'Dois feios' || pt.includes('feios'))) {
        pt = 'Pista II';
        modified = true;
      }

      if (modified && pt !== original) {
        v.pt = pt;
        fixCount++;
        if (fixLog.length < 50) {
          fixLog.push({ category: cat, key: k, before: original, after: pt });
        }
      }
    }
  }

  if (fixCount > 0) {
    fs.writeFileSync(config.databaseFile, JSON.stringify(db, null, 2), 'utf8');
  }

  return { fixCount, fixLog };
}

// Execução via terminal CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const doFix = args.includes('--fix');

  console.log('=====================================================');
  console.log('   Tales of Immortal - Auditor de Qualidade & Tags   ');
  console.log('=====================================================\n');

  if (doFix) {
    console.log('Aplicando correções automáticas no database.json...');
    const { fixCount, fixLog } = autoFixDatabase();
    console.log(`\nSucesso! Foram corrigidas ${fixCount} entradas no banco de dados.`);
    console.log('\nExemplos de correções realizadas:');
    fixLog.slice(0, 10).forEach(f => {
      console.log(`  [${f.category}] ${f.key}:`);
      console.log(`    Antes:  "${f.before.substring(0, 70)}..."`);
      console.log(`    Depois: "${f.after.substring(0, 70)}..."`);
    });
  }

  const { issues } = auditDatabase();

  console.log(`\nLinhas Auditadas:              ${issues.stats.totalChecked.toLocaleString('pt-BR')}`);
  console.log(`Tags Corrompidas / Traduzidas: ${issues.corruptedTags.length}`);
  console.log(`Colchetes Não Fechados:        ${issues.unclosedBrackets.length}`);
  console.log(`Resquícios em Chinês:          ${issues.residualChinese.length}`);
  console.log(`Termos Bizarros Detectados:    ${issues.bizarreTerms.length}`);
  console.log(`Total de Ocorrências:          ${issues.stats.totalIssues}\n`);

  if (!doFix) {
    console.log('Dica: Execute com "--fix" para aplicar as correções automáticas.');
  }
}

module.exports = { auditDatabase, autoFixDatabase };
