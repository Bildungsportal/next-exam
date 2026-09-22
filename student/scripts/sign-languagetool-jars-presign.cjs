const path = require('path');
const { signLanguageToolJarLibsAt } = require('./sign-languagetool-jars.cjs');

const projectRoot = path.join(__dirname, '..');
const libsPath = path.join(projectRoot, 'public', 'LanguageTool', 'libs');
const identity = (process.env.SHAID || process.env.CSC_NAME || '').trim();
const arch = process.env.NXE_EB_MAC_ARCH;

if (!identity) {
  console.error('SHAID or CSC_NAME required for LanguageTool jar pre-sign');
  process.exit(1);
}

signLanguageToolJarLibsAt(libsPath, identity, arch).catch((err) => {
  console.error(err);
  process.exit(1);
});
