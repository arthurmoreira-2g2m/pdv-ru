import { Venda } from '../types';

export interface CouponData {
  dataHoraFormatada: string;
  servicoNome: string;
  alunoNome: string;
  alunoCurso: string;
  alunoMatricula: string;
  statusLinha: string;
  isTotalGratis: boolean;
  percentualCobrado: number;
  valorCobrado: number;
}

/**
 * Formats a sale into the thermal receipt data model
 */
export function formatarDadosCupom(venda: Venda): CouponData {
  const dateObj = new Date(venda.dataHora);
  const dataHoraFormatada = dateObj.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const percentualDesconto = venda.percentualDesconto || 0;
  const percentualCobrado = Math.max(0, 100 - percentualDesconto);
  const valorCobrado = venda.valorCobradoAluno || 0;
  const isTotalGratis = percentualDesconto === 100 || valorCobrado === 0;

  let statusLinha = '';
  if (isTotalGratis) {
    statusLinha = 'ACESSO';
  } else {
    // Ex: COBRAR R$ 10,00
    statusLinha = `COBRAR R$ ${valorCobrado.toFixed(2).replace('.', ',')}`;
  }

  return {
    dataHoraFormatada,
    servicoNome: venda.servicoNome,
    alunoNome: venda.alunoNome,
    alunoCurso: venda.alunoCurso,
    alunoMatricula: venda.alunoMatricula,
    statusLinha,
    isTotalGratis,
    percentualCobrado,
    valorCobrado,
  };
}

/**
 * ARQUITETURA DE IMPRESSÃO TÉRMICA REAL (GERTEC SK210 TOTEM):
 * 
 * A impressora térmica embutida no Totem Gertec SK210 é acessada exclusivamente via SDK Oficial da Gertec.
 * O SDK oficial deve ser obtido no Portal do Desenvolvedor Gertec (https://developer.gertec.com.br).
 * 
 * Ao empacotar o app Android no VoltBuilder / Cordova com o plugin nativo Gertec instalado,
 * o plugin expõe a interface global em 'window.GertecPrinter' (ou 'window.gertecPrinter').
 * 
 * Prioridade de Execução:
 * 1. Se 'window.GertecPrinter' existir (no Totem físico), executa a impressão direta, nativa e silenciosa (Kiosk Mode).
 * 2. Se não existir (ambiente Web / Desenvolvimento / Teste em browser), executa o fallback via window.print() / iframe térmico (50mm/58mm).
 * 
 * Nota de Implementação do Plugin Nativo:
 * As chamadas abaixo utilizam uma estrutura de cupom de 58mm. Os nomes de métodos nativos exatos
 * (ex: printText, printHeader, cutPaper) deverão ser ajustados conforme a documentação do SDK oficial assim que baixado.
 */
export function imprimirCupom(venda: Venda): void {
  const couponData = formatarDadosCupom(venda);

  // 1. Tenta impressão nativa no Totem Gertec SK210
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const gertecPlugin = win.GertecPrinter || win.gertecPrinter || win.cordova?.plugins?.gertecPrinter;

  if (gertecPlugin) {
    try {
      console.log('[2G2M Gertec SK210] Enviando cupom para impressora térmica nativa Gertec...', couponData);
      
      // Exemplo de sequência de comandos do SDK Gertec (ajustar conforme documentação do SDK)
      if (typeof gertecPlugin.imprimirCupom === 'function') {
        gertecPlugin.imprimirCupom(couponData);
        return;
      } else if (typeof gertecPlugin.printFormattedText === 'function') {
        const text = `
*** 2G2M REFEITÓRIO ***
Data: ${couponData.dataHoraFormatada}
--------------------------------
SERVIÇO: ${couponData.servicoNome.toUpperCase()}
ALUNO: ${couponData.alunoNome.toUpperCase()}
CURSO: ${couponData.alunoCurso.toUpperCase()}
MATRÍCULA: ${couponData.alunoMatricula}
--------------------------------
[ALIGN CENTER][FONT BIG]${couponData.statusLinha}
--------------------------------
Obrigado! Bom apetite. 🍽️
\n\n\n`;
        gertecPlugin.printFormattedText(text);
        if (typeof gertecPlugin.cutPaper === 'function') {
          gertecPlugin.cutPaper();
        }
        return;
      }
    } catch (err) {
      console.warn('[2G2M Gertec SK210] Falha ao acionar impressora nativa Gertec, acionando fallback web:', err);
    }
  }

  // 2. Camada intermediária de teste: cordova-plugin-printer (diálogo nativo
  //    do Android). Isso serve para verificar se a impressora do SK210 está
  //    exposta como um Print Service padrão do Android. Se não estiver, essa
  //    camada só vai mostrar opções genéricas como "Salvar como PDF" — o que
  //    já responde a pergunta sem precisar de mais nada.
  const cordovaPrinter = win.cordova?.plugins?.printer;
  if (cordovaPrinter) {
    try {
      console.log('[2G2M] Gertec SDK indisponível — testando via diálogo nativo do Android (cordova-plugin-printer)...');
      const htmlCupom = buildReceiptHtml(couponData);
      cordovaPrinter.print(
        htmlCupom,
        { name: 'Cupom-2G2M', duplex: 'none', landscape: false, graystyle: false },
        (printed: boolean) => {
          console.log('[2G2M] Diálogo de impressão nativo finalizado. Impresso?', printed);
        }
      );
      return;
    } catch (err) {
      console.warn('[2G2M] Falha ao acionar cordova-plugin-printer, caindo para fallback window.print:', err);
    }
  }

  // 3. Fallback via navegador / WebView puro (Chrome --kiosk-printing ou iframe)
  //    ATENÇÃO: window.print() não funciona dentro do WebView padrão do
  //    Cordova/Android — só serve para teste em navegador de desenvolvimento.
  setTimeout(() => {
    try {
      if (typeof window !== 'undefined' && window.print) {
        window.print();
      } else {
        imprimirCupomViaIframe(couponData);
      }
    } catch (e) {
      console.warn('Standard window.print failed, using iframe fallback:', e);
      imprimirCupomViaIframe(couponData);
    }
  }, 100);
}

/**
 * Standalone HTML string (inline styles) for the 58mm thermal coupon —
 * used specifically by cordova-plugin-printer, which prints arbitrary HTML
 * handed to it directly rather than the app's live DOM/stylesheet.
 */
function buildReceiptHtml(c: CouponData): string {
  const statusBg = c.isTotalGratis ? '#000' : '#fff';
  const statusColor = c.isTotalGratis ? '#fff' : '#000';
  const statusFontSize = c.isTotalGratis ? '16px' : '13px';
  const statusPadding = c.isTotalGratis ? '10px 0' : '6px 0';

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: 58mm auto; margin: 0mm; }
        body { margin: 0; padding: 0; font-family: 'Courier New', monospace; color: #000; background: #fff; }
        .receipt { width: 50mm; max-width: 50mm; margin: 0 auto; padding: 2mm; text-align: center; }
        .header { font-weight: 900; font-size: 12px; text-transform: uppercase; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
        .data { font-size: 9px; font-weight: 600; margin-bottom: 4px; }
        .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
        .fields { text-align: left; font-size: 8.5px; line-height: 1.3; }
        .fields div { margin-bottom: 2px; }
        .label { font-weight: 700; }
        .status { margin: 6px 0; font-weight: 900; text-transform: uppercase; text-align: center;
                   border: 2px solid #000; letter-spacing: 1px;
                   font-size: ${statusFontSize}; padding: ${statusPadding};
                   background: ${statusBg}; color: ${statusColor}; }
        .footer { font-size: 8px; font-style: italic; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #000; }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">*** 2G2M REFEITÓRIO ***</div>
        <div class="data">Data: ${c.dataHoraFormatada}</div>
        <div class="divider"></div>
        <div class="fields">
          <div><span class="label">SERVIÇO:</span> ${c.servicoNome.toUpperCase()}</div>
          <div><span class="label">ALUNO:</span> ${c.alunoNome.toUpperCase()}</div>
          <div><span class="label">CURSO:</span> ${c.alunoCurso.toUpperCase()}</div>
          <div><span class="label">MATRÍCULA:</span> ${c.alunoMatricula}</div>
        </div>
        <div class="divider"></div>
        <div class="status">${c.statusLinha}</div>
        <div class="footer">Obrigado! Bom apetite.</div>
      </div>
    </body>
  </html>`;
}

/**
 * Direct iframe thermal printing fallback for restricted WebViews / Kiosks
 */
export function imprimirCupomViaIframe(couponData: CouponData): void {
  try {
    let iframe = document.getElementById('thermal-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'thermal-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: 58mm auto; margin: 0mm; }
            body {
              font-family: monospace, sans-serif;
              width: 50mm;
              max-width: 50mm;
              margin: 0 auto;
              padding: 4px;
              text-align: center;
              font-size: 10px;
              color: #000;
              background: #fff;
            }
            .header { font-weight: 900; font-size: 12px; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; text-transform: uppercase; }
            .date { font-size: 9px; margin-bottom: 4px; font-weight: 600; }
            .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
            .fields { text-align: left; font-size: 8.5px; line-height: 1.2; }
            .fields div { margin-bottom: 2px; }
            .bold { font-weight: bold; }
            .status-box {
              margin: 6px 0;
              font-weight: 900;
              text-transform: uppercase;
              text-align: center;
              border: 2px solid #000;
              padding: ${couponData.isTotalGratis ? '8px 4px' : '6px 4px'};
              background-color: ${couponData.isTotalGratis ? '#000' : '#fff'};
              color: ${couponData.isTotalGratis ? '#fff' : '#000'};
              font-size: ${couponData.isTotalGratis ? '14px' : '12px'};
              letter-spacing: 1px;
            }
            .footer { font-size: 8px; font-style: italic; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #000; }
          </style>
        </head>
        <body>
          <div class="header">*** 2G2M REFEITÓRIO ***</div>
          <div class="date">Data: ${couponData.dataHoraFormatada}</div>
          <div class="divider"></div>
          <div class="fields">
            <div><span class="bold">SERVIÇO:</span> <strong>${couponData.servicoNome.toUpperCase()}</strong></div>
            <div><span class="bold">ALUNO:</span> ${couponData.alunoNome.toUpperCase()}</div>
            <div><span class="bold">CURSO:</span> ${couponData.alunoCurso.toUpperCase()}</div>
            <div><span class="bold">MATRÍCULA:</span> <strong>${couponData.alunoMatricula}</strong></div>
          </div>
          <div class="divider"></div>
          <div class="status-box">${couponData.statusLinha}</div>
          <div class="footer">Obrigado! Bom apetite. 🍽️</div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn('Iframe print error:', e);
      }
    }, 150);
  } catch (err) {
    console.error('Erro no iframe print:', err);
  }
}
