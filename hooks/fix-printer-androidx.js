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
  } else {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.java'));
    files.forEach((f) => patchFile(path.join(dir, f)));
  }

  // ---------------------------------------------------------------
  // Garante que o TOPSDK.jar (SDK real Gertec/Topwise) está copiado para
  // platforms/android/app/libs — mesmo se o mecanismo <lib-file> do
  // plugin.xml não copiar corretamente nesta versão do Cordova.
  // ---------------------------------------------------------------
  const gertecPluginLibsDir = path.join(projectRoot, 'plugins', 'cordova-plugin-gertec-printer', 'libs');
  const appLibsDir = path.join(projectRoot, 'platforms', 'android', 'app', 'libs');

  if (fs.existsSync(gertecPluginLibsDir)) {
    if (!fs.existsSync(appLibsDir)) {
      fs.mkdirSync(appLibsDir, { recursive: true });
    }
    const jarFiles = fs.readdirSync(gertecPluginLibsDir).filter((f) => f.endsWith('.jar'));
    jarFiles.forEach((jar) => {
      const src = path.join(gertecPluginLibsDir, jar);
      const dest = path.join(appLibsDir, jar);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        console.log(`[fix-printer-androidx] Copiado ${jar} para app/libs`);
      }
    });
  }

  // Também garante que a lib androidx.print (que traz PrintHelper) está disponível.
  // IMPORTANTE: o build.gradle do Cordova tem MAIS DE UM bloco "dependencies {" —
  // o primeiro é do "buildscript" (só aceita "classpath", não "implementation").
  // Por isso ancoramos num trecho específico do bloco de dependências do APP
  // (a linha "implementation fileTree(...)" que o template do Cordova sempre gera),
  // e não no primeiro "dependencies {" que aparece no arquivo.
  const buildGradlePath = path.join(projectRoot, 'platforms', 'android', 'app', 'build.gradle');
  if (fs.existsSync(buildGradlePath)) {
    let gradle = fs.readFileSync(buildGradlePath, 'utf8');

    if (!gradle.includes('androidx.print:print')) {
      const anchor = /implementation\s+fileTree\(dir:\s*['"]libs['"][^)]*\)/;

      if (anchor.test(gradle)) {
        gradle = gradle.replace(anchor, (match) => `${match}\n    implementation 'androidx.print:print:1.0.0'`);
        fs.writeFileSync(buildGradlePath, gradle, 'utf8');
        console.log('[fix-printer-androidx] Adicionada dependência androidx.print ao build.gradle (âncora fileTree)');
      } else {
        // Fallback: usa o ÚLTIMO "dependencies {" do arquivo (o do buildscript
        // é sempre o primeiro a aparecer, então o último é o do app).
        const matches = [...gradle.matchAll(/dependencies\s*\{/g)];
        if (matches.length > 0) {
          const last = matches[matches.length - 1];
          const insertAt = last.index + last[0].length;
          gradle =
            gradle.slice(0, insertAt) +
            "\n    implementation 'androidx.print:print:1.0.0'" +
            gradle.slice(insertAt);
          fs.writeFileSync(buildGradlePath, gradle, 'utf8');
          console.log('[fix-printer-androidx] Adicionada dependência androidx.print ao build.gradle (fallback: último bloco dependencies)');
        } else {
          console.log('[fix-printer-androidx] AVISO: nenhum bloco dependencies encontrado — dependência androidx.print NÃO foi adicionada.');
        }
      }
    }
  }
};
