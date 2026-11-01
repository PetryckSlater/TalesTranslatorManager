const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const PRIVATE_MOD_DIR = path.join(ROOT_DIR, 'ModProject_VMCUi0', 'ModProject', 'ModExcel');
const PUBLIC_OUTPUT_DIR = path.join(ROOT_DIR, 'output', 'ModExcel');

module.exports = {
  // Diretórios principais
  rootDir: ROOT_DIR,
  gameSourceDir: path.join(ROOT_DIR, 'TalesEnglishVersion'),
  
  // Pasta Pública de saída (vai para o GitHub para quem quiser usar os arquivos)
  publicOutputDir: PUBLIC_OUTPUT_DIR,
  
  // Pasta Privada oficial da Oficina Steam (Fica apenas no seu PC, protegida pelo .gitignore)
  privateModDir: PRIVATE_MOD_DIR,
  
  // O compilador salva em ambas se a privada existir no PC local
  modExcelDir: fs.existsSync(path.join(ROOT_DIR, 'ModProject_VMCUi0')) ? PRIVATE_MOD_DIR : PUBLIC_OUTPUT_DIR,
  modCacheFile: path.join(ROOT_DIR, 'ModProject_VMCUi0', 'ModProject', 'ModProject.cache'),
  
  // Diretório de dados e banco de dados de tradução
  dataDir: path.join(__dirname, 'data'),
  databaseFile: path.join(__dirname, 'data', 'database.json'),
  pendingFile: path.join(__dirname, 'data', 'pending.json'),
  modifiedFile: path.join(__dirname, 'data', 'modified.json'),
  glossaryFile: path.join(__dirname, 'glossary.json'),

  // Configurações de otimização do mod
  modSettings: {
    // Remove o coreano ('kr') para manter arquivos leves e diminuir tempo de carregamento
    stripKorean: true,
    // Preserva quebras de linha corretas do jogo (\n e \\n)
    normalizeLineEndings: true,
    // Formatação JSON identada (2 espaços para compatibilidade total com o mod tool)
    indent: 2
  }
};
