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
 * A impressora térmica embutida no Totem Gertec SK210 é controlada pelo
 * SDK Topwise CloudPOS (a Gertec licencia esse SDK internamente — é o
 * mesmo usado por outros fabricantes de totem/POS que compram hardware
 * da Topwise). Os nomes de pacote, classes e métodos abaixo foram
 * confirmados a partir do código-fonte real (aberto) do plugin Flutter
 * "gertec" (github.com/brasizza/gertec), cujo README declara
 * explicitamente ter sido testado num Gertec SK-210 — o mesmo modelo
 * usado neste projeto.
 *
 * O plugin nativo Cordova que implementa essa ponte está em
 * /plugins/cordova-plugin-gertec-printer e expõe `window.GertecPrinter`
 * com os métodos: printText, printQRCode, printBarCode, wrapLine,
 * cutPaper, getPrinterState, startTransaction, finishTransaction.
 *
 * Prioridade de execução:
 * 1. Se `window.GertecPrinter` existir (dentro do APK, no totem físico) →
 *    imprime de forma nativa e silenciosa (kiosk mode).
 * 2. Caso contrário (navegador comum / ambiente de desenvolvimento) →
 *    fallback via `window.print()` / iframe (só serve para visualizar o
 *    layout do cupom, não imprime de fato em nenhum totem).
 *
 * IMPORTANTE: esta integração foi construída a partir de um SDK real e
 * comprovado no mesmo hardware, mas ainda não confirmado com a
 * documentação oficial da Gertec (pendente de cadastro em
 * developer.gertec.com.br). Testar fisicamente no SK210 antes de ir
 * para produção.
 */
export function imprimirCupom(venda: Venda): void {
  const couponData = formatarDadosCupom(venda);
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const gertec = win.GertecPrinter;

  if (gertec && typeof gertec.printReceipt === 'function') {
    imprimirViaGertecReal(gertec, couponData);
    return;
  }

  // Fallback via navegador / WebView puro — apenas para visualizar o
  // layout em ambiente de desenvolvimento. NÃO funciona dentro do APK
  // (window.print() é um no-op no WebView padrão do Cordova/Android).
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
 * Sequência real de comandos enviados ao plugin nativo Gertec/Topwise.
 *
 * Usa `printReceipt` (lote único: todas as linhas de uma vez + UM só
 * printRuiQueue), em vez de uma chamada `printText` por linha. Isso
 * elimina a condição de corrida em que múltiplas filas de impressão
 * concorrentes faziam o corte da guilhotina disparar fora de ordem ou
 * antes do papel estar totalmente impresso.
 *
 * NOTA DE HARDWARE: confirmado que o totem POSSUI guilhotina (corte
 * automático). A folga de papel abaixo (feedLines) foi recalibrada a
 * partir de uma medição física real feita no cupom impresso (marcação a
 * caneta), para o corte não passar em cima da última linha de conteúdo.
 */
function imprimirViaGertecReal(gertec: any, c: CouponData): void {
  const onErr = (err: any) => console.error('[GertecPrinter] Erro na impressão:', err);

  const lines = [
    { text: '2G2M REFEITORIO', align: 1, bold: true, fontSize: 16 },
    { text: c.statusLinha, align: 1, bold: true, fontSize: c.isTotalGratis ? 24 : 16 },
    { text: '--------------------------------', align: 1, fontSize: 8 },
    { text: `Data: ${c.dataHoraFormatada}`, align: 1, fontSize: 8 },
    { text: '--------------------------------', align: 1, fontSize: 8 },
    { text: `SERVICO: ${c.servicoNome.toUpperCase()}`, align: 0, fontSize: 8, bold: true },
    { text: `ALUNO: ${c.alunoNome.toUpperCase()}`, align: 0, fontSize: 8, bold: true },
    { text: `CURSO: ${c.alunoCurso.toUpperCase()}`, align: 0, fontSize: 8, bold: true },
    { text: `MATRICULA: ${c.alunoMatricula}`, align: 0, fontSize: 8, bold: true },
    { text: '--------------------------------', align: 1, fontSize: 8 },
    { text: 'Obrigado! Bom apetite.', align: 1, fontSize: 8 },
  ];

  gertec.printReceipt(
    {
      lines,
      cut: true,
      cutMode: 'full', // guilhotina confirmada no totem
      feedLines: 19,   // recalibrado a partir da medição real no cupom impresso (14 + ~5 de folga extra)
    },
    () => console.log('[GertecPrinter] Cupom impresso com sucesso.'),
    onErr
  );
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
