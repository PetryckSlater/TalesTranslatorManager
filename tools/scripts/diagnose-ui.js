const fs = require('fs');
const path = require('path');
const config = require('../config');

function diagnoseUI() {
  console.log('=====================================================');
  console.log('    Tales of Immortal - Detector de Textos Longos UI');
  console.log('=====================================================\n');

  if (!fs.existsSync(config.databaseFile)) {
    console.error('database.json não encontrado.');
    return;
  }

  const database = JSON.parse(fs.readFileSync(config.databaseFile, 'utf8'));

  const uiPrefixes = [
    'ui_', 'btn_', 'diff', 'menu_', 'title_', 'tab_', 'panel_',
    'battle_ui', 'rolecreate', 'setting_', 'map_ui'
  ];

  const results = {
    buttonsLong: [],     // Botões com mais de 16 caracteres (risco de sair do botão)
    labelsLong: [],      // Rótulos de 1 linha com mais de 30 caracteres
    boxesMultiline: [],  // Caixas de texto com muitas quebras de linha
    ratioExpanded: []    // Textos que expandiram mais de 3x em relação ao original
  };

  for (const [key, entry] of Object.entries(database.localText)) {
    const pt = entry.pt || '';
    const ch = entry.ch || '';
    const en = entry.en || '';
    if (!pt.trim()) continue;

    const lowerKey = key.toLowerCase();
    const isUIKey = uiPrefixes.some(p => lowerKey.startsWith(p));

    // Botões
    if (lowerKey.includes('btn') || lowerKey.includes('anniu') || lowerKey.startsWith('btn_')) {
      if (pt.length > 16 && !pt.includes('\n')) {
        results.buttonsLong.push({ key, pt, ch, en, len: pt.length });
      }
    }

    // Rótulos e Títulos de UI
    if (isUIKey) {
      if (pt.length > 28 && !pt.includes('\n') && !lowerKey.includes('desc') && !lowerKey.includes('tip') && !lowerKey.includes('info')) {
        results.labelsLong.push({ key, pt, ch, en, len: pt.length });
      }

      // Caixas com muitas linhas
      const lineCount = (pt.match(/\n/g) || []).length + 1;
      if (lineCount >= 4 && (lowerKey.includes('title') || lowerKey.includes('punish') || lowerKey.includes('attr'))) {
        results.boxesMultiline.push({ key, pt, ch, en, lines: lineCount });
      }

      // Proporção de expansão vs chinês
      if (ch.length > 0 && pt.length > 20) {
        const ratio = (pt.length / ch.length).toFixed(1);
        if (ratio >= 4.0) {
          results.ratioExpanded.push({ key, pt, ch, en, ratio, ptLen: pt.length, chLen: ch.length });
        }
      }
    }
  }

  console.log(`[Diagnóstico de Interface]`);
  console.log(`- Botões com texto longo (>16 caracteres): ${results.buttonsLong.length}`);
  console.log(`- Rótulos/Títulos de 1 linha longos (>28 caracteres): ${results.labelsLong.length}`);
  console.log(`- Caixas com excesso de linhas (>=4 linhas): ${results.boxesMultiline.length}`);
  console.log(`- Textos com expansão extrema (>=4x tamanho do chinês): ${results.ratioExpanded.length}\n`);

  if (results.labelsLong.length > 0) {
    console.log('Exemplos de Rótulos Longos (com risco de sobreposição):');
    results.labelsLong.slice(0, 10).forEach(x => {
      console.log(`  [${x.key}] (${x.len} chars): "${x.pt}" (CH: "${x.ch}")`);
    });
  }

  // Gravar relatório completo em tools/data/ui-overflow-report.json
  const reportPath = path.join(config.rootDir, 'tools', 'data', 'ui-overflow-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nRelatório detalhado salvo em: ${reportPath}`);
}

diagnoseUI();
