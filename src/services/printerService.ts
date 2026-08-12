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
 * Builds a standalone HTML string (inline styles only — no Tailwind classes,
 * since this string is handed off to the native print pipeline, not rendered
 * in the app's own DOM/stylesheet context) for the 58mm thermal coupon.
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
 * Isolated function to trigger thermal paper receipt printing.
 *
 * IMPORTANT: window.print() does NOT work inside the Android WebView used by
 * Cordova/VoltBuilder builds — it is a no-op there (it only works in a real
 * browser tab). Inside the packaged APK we use `cordova-plugin-printer`,
 * which opens Android's native Print Framework dialog. This is a TEMPORARY
 * bridge for testing: it shows the system print dialog (with "Save as PDF"
 * and any registered print service as options), it is NOT a silent/immediate
 * print straight to the Gertec SK210's embedded printer. True kiosk-mode
 * silent printing to the embedded printer requires Gertec's native SDK
 * (AIDL) wrapped in a custom Cordova plugin — see project notes.
 */
export function imprimirCupom(venda: Venda): void {
  const couponData = formatarDadosCupom(venda);
  const html = buildReceiptHtml(couponData);

  const win = window as any;
  const cordovaPrinter = win.cordova?.plugins?.printer;

  if (cordovaPrinter) {
    // Running inside the packaged APK with the printer plugin available
    cordovaPrinter.print(
      html,
      {
        name: 'Cupom-2G2M',
        duplex: 'none',
        landscape: false,
        graystyle: false,
      },
      (printed: boolean) => {
        console.log('[printer] diálogo de impressão finalizado. Impresso?', printed);
      }
    );
  } else {
    // Fallback for testing in a regular browser (dev mode) — relies on the
    // @media print CSS rules in index.css and the hidden #receipt-print-area
    // markup rendered by <ThermalReceipt />.
    setTimeout(() => {
      window.print();
    }, 100);
  }
}

