#!/usr/bin/env node
/**
 * after_plugin_add hook (Android)
 *
 * O pacote "cordova-plugin-printer" (katzer) não foi atualizado para AndroidX
 * — ele ainda importa "android.support.annotation.*" e "android.support.v4.print.*",
 * que não existem mais em projetos Cordova Android atuais (AndroidX-only).
 * Isso quebra a compilação com "error: package android.support.annotation does not exist".
 *
 * Este hook roda depois que o plugin é instalado e reescreve os imports para
 * os equivalentes AndroidX, direto nos arquivos .java copiados para dentro
 * da plataforma Android.
 */

const fs = require('fs');
const path = require('path');

const REPLACEMENTS = [
  [/android\.support\.annotation\.NonNull/g, 'androidx.annotation.NonNull'],
  [/android\.support\.annotation\.Nullable/g, 'androidx.annotation.Nullable'],
  [/android\.support\.v4\.print\.PrintHelper/g, 'androidx.print.PrintHelper'],
  [/android\.support\.v4\.content\.FileProvider/g, 'androidx.core.content.FileProvider'],
  [/android\.support\.v4\./g, 'androidx.core.'],
];

const PLUGIN_JAVA_DIR = path.join(
  'platforms',
  'android',
  'app',
  'src',
  'main',
  'java',
  'de',
  'appplant',
  'cordova',
  'plugin',
  'printer'
);

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [pattern, replacement] of REPLACEMENTS) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[fix-printer-androidx] Corrigido: ${filePath}`);
  }
}

module.exports = function (context) {
  const projectRoot = context.opts.projectRoot;
  const dir = path.join(projectRoot, PLUGIN_JAVA_DIR);

  if (!fs.existsSync(dir)) {
    console.log('[fix-printer-androidx] Pasta do plugin ainda não existe, nada a corrigir agora.');
    return;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.java'));
  files.forEach((f) => patchFile(path.join(dir, f)));

  // Também garante que a lib androidx.print (que traz PrintHelper) está disponível.
  const buildGradlePath = path.join(projectRoot, 'platforms', 'android', 'app', 'build.gradle');
  if (fs.existsSync(buildGradlePath)) {
    let gradle = fs.readFileSync(buildGradlePath, 'utf8');
    if (!gradle.includes('androidx.print:print')) {
      gradle = gradle.replace(
        /dependencies\s*{/,
        "dependencies {\n    implementation 'androidx.print:print:1.0.0'"
      );
      fs.writeFileSync(buildGradlePath, gradle, 'utf8');
      console.log('[fix-printer-androidx] Adicionada dependência androidx.print ao build.gradle');
    }
  }
};
