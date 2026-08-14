import { Venda, ConfiguracoesSistema } from '../types';

export interface FechamentoReport {
  tipo: 'DIARIO' | 'MENSAL';
  periodoRotulo: string; // e.g., "11/08/2026" or "Agosto de 2026"
  dataInicial: string;
  dataFinal: string;
  totalVendasCount: number;
  totalBrutoBase: number;
  totalCobradoAlunos: number;
  totalSubsidioDescontos: number;
  porServico: Array<{
    servicoNome: string;
    quantidade: number;
    totalCobrado: number;
    totalSubsidio: number;
  }>;
  vendasDetalhadas?: Venda[];
}

export interface SendEmailResult {
  sucesso: boolean;
  mensagem: string;
  detalhes?: any;
}

const BRL = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;

/**
 * Template HTML compartilhado — mesma identidade visual do app (cabeçalho
 * vermelho, logo 2G2M, cards de destaque) — usado por todos os e-mails.
 */
function baseEmailTemplate(opts: {
  tituloDocumento: string;
  subtitulo: string;
  periodoRotulo: string;
  cardsResumo: Array<{ label: string; valor: string; cor?: string }>;
  corpo: string;
}): string {
  const cardsHtml = opts.cardsResumo
    .map(
      (c) => `
      <td style="padding:10px;">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;">
          <div style="font-size:10px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${c.label}</div>
          <div style="font-size:20px;font-weight:900;color:${c.cor || '#111827'};">${c.valor}</div>
        </div>
      </td>`
    )
    .join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;">
    <div style="background:#dc2626;padding:20px 24px;">
      <table width="100%"><tr>
        <td>
          <img src="https://2g2m.com.br/imagens/2g2m-logo.png" alt="2G2M" height="32" style="display:block;filter:brightness(0) invert(1);" />
        </td>
        <td align="right" style="color:#ffffff;font-size:11px;font-weight:700;">
          ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}
        </td>
      </tr></table>
    </div>

    <div style="padding:24px;">
      <h1 style="font-size:19px;font-weight:900;color:#111827;margin:0 0 4px 0;">${opts.tituloDocumento}</h1>
      <p style="font-size:12px;color:#6b7280;font-weight:600;margin:0 0 4px 0;">${opts.subtitulo}</p>
      <p style="font-size:12px;color:#6b7280;font-weight:600;margin:0 0 18px 0;">Período: <strong style="color:#111827;">${opts.periodoRotulo}</strong></p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>${cardsHtml}</tr>
      </table>

      ${opts.corpo}

      <p style="font-size:11px;color:#9ca3af;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:12px;">
        2G2M Gestão de Refeitórios · E-mail gerado automaticamente pelo sistema PDV em ${new Date().toLocaleString('pt-BR')}
      </p>
    </div>
  </div>`;
}

function tabelaHtml(headers: string[], rows: string[][], destaqueColIndex?: number): string {
  const headHtml = headers
    .map((h) => `<th style="background:#dc2626;color:#fff;font-size:10px;text-transform:uppercase;padding:8px 10px;text-align:left;">${h}</th>`)
    .join('');
  const bodyHtml = rows.length
    ? rows
        .map(
          (r, ri) =>
            `<tr style="background:${ri % 2 === 0 ? '#ffffff' : '#f9fafb'};">${r
              .map(
                (c, ci) =>
                  `<td style="padding:7px 10px;font-size:11px;color:#1f2937;border-bottom:1px solid #f3f4f6;${
                    ci === destaqueColIndex ? 'font-weight:900;color:#059669;' : ''
                  }">${c}</td>`
              )
              .join('')}</tr>`
        )
        .join('')
    : `<tr><td colspan="${headers.length}" style="padding:14px;text-align:center;color:#9ca3af;font-size:11px;">Nenhum registro no período.</td></tr>`;

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <thead><tr>${headHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>`;
}

/**
 * Calculates a summary report for a given list of sales within a period
 */
export function gerarRelatorioFechamento(
  vendas: Venda[],
  tipo: 'DIARIO' | 'MENSAL',
  dataRef: Date = new Date()
): FechamentoReport {
  let vendasFiltradas: Venda[] = [];
  let periodoRotulo = '';

  const validDate = (dataRef && !isNaN(dataRef.getTime())) ? dataRef : new Date();

  if (tipo === 'DIARIO') {
    const targetYMD = validDate.toISOString().split('T')[0];
    periodoRotulo = validDate.toLocaleDateString('pt-BR');
    vendasFiltradas = vendas.filter(v => v && v.dataHora && v.dataHora.startsWith(targetYMD));
  } else {
    // MENSAL
    const year = validDate.getFullYear();
    const month = validDate.getMonth();
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    periodoRotulo = `${monthNames[month]} de ${year}`;
    
    vendasFiltradas = vendas.filter(v => {
      if (!v || !v.dataHora) return false;
      const d = new Date(v.dataHora);
      return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
    });
  }

  // Agrupamento por serviço
  const servicosMap: Record<string, { quantidade: number; totalCobrado: number; totalSubsidio: number }> = {};

  let totalBrutoBase = 0;
  let totalCobradoAlunos = 0;
  let totalSubsidioDescontos = 0;

  for (const v of vendasFiltradas) {
    totalBrutoBase += v.precoBase || 0;
    totalCobradoAlunos += v.valorCobradoAluno || 0;
    totalSubsidioDescontos += v.valorSubsidio || 0;

    if (!servicosMap[v.servicoNome]) {
      servicosMap[v.servicoNome] = { quantidade: 0, totalCobrado: 0, totalSubsidio: 0 };
    }
    servicosMap[v.servicoNome].quantidade += 1;
    servicosMap[v.servicoNome].totalCobrado += v.valorCobradoAluno || 0;
    servicosMap[v.servicoNome].totalSubsidio += v.valorSubsidio || 0;
  }

  const porServico = Object.entries(servicosMap).map(([servicoNome, data]) => ({
    servicoNome,
    quantidade: data.quantidade,
    totalCobrado: data.totalCobrado,
    totalSubsidio: data.totalSubsidio,
  }));

  const dataInicial = vendasFiltradas.length > 0 
    ? new Date(vendasFiltradas[vendasFiltradas.length - 1].dataHora).toLocaleDateString('pt-BR') 
    : periodoRotulo;
  const dataFinal = vendasFiltradas.length > 0 
    ? new Date(vendasFiltradas[0].dataHora).toLocaleDateString('pt-BR') 
    : periodoRotulo;

  return {
    tipo,
    periodoRotulo,
    dataInicial,
    dataFinal,
    totalVendasCount: vendasFiltradas.length,
    totalBrutoBase,
    totalCobradoAlunos,
    totalSubsidioDescontos,
    porServico,
    vendasDetalhadas: vendasFiltradas,
  };
}

/**
 * Sends closure report email via the Nodemailer backend (see /backend).
 * HTML no mesmo padrão visual exibido na tela de Fechamentos.
 */
export async function enviarFechamentoEmail(
  report: FechamentoReport,
  config: ConfiguracoesSistema
): Promise<SendEmailResult> {
  const { backendEmailUrl, backendEmailApiKey, emailDestinatario } = config;
  const destinatario = emailDestinatario || 'financeiro@2g2m.com.br';

  const tabelaServicos = tabelaHtml(
    ['Serviço', 'Qtd.', 'Total Cobrado', 'Subsídio'],
    report.porServico.map((s) => [s.servicoNome.toUpperCase(), `${s.quantidade}x`, BRL(s.totalCobrado), BRL(s.totalSubsidio)]),
    3
  );

  const tabelaVendas = tabelaHtml(
    ['Data/Hora', 'Matrícula', 'Aluno', 'Serviço', 'Plano', 'Cobrado', 'Subsídio'],
    (report.vendasDetalhadas || []).map((v) => [
      new Date(v.dataHora).toLocaleString('pt-BR'),
      v.alunoMatricula,
      v.alunoNome,
      v.servicoNome,
      `${v.planoCodigo} (${v.percentualDesconto}%)`,
      v.percentualDesconto === 100 ? 'GRÁTIS' : BRL(v.valorCobradoAluno),
      BRL(v.valorSubsidio),
    ]),
    6
  );

  const corpo = `
    <h3 style="font-size:13px;font-weight:900;color:#111827;margin:20px 0 8px;">Resumo por Serviço</h3>
    ${tabelaServicos}
    <h3 style="font-size:13px;font-weight:900;color:#111827;margin:20px 0 8px;">Vendas Detalhadas do Período</h3>
    ${tabelaVendas}
  `;

  const html = baseEmailTemplate({
    tituloDocumento: report.tipo === 'DIARIO' ? 'Fechamento Diário de Vendas' : 'Fechamento Mensal de Vendas',
    subtitulo: '2G2M Gestão de Refeitórios',
    periodoRotulo: report.periodoRotulo,
    cardsResumo: [
      { label: 'Total de Acessos', valor: `${report.totalVendasCount}` },
      { label: 'Cobrado dos Alunos', valor: BRL(report.totalCobradoAlunos), cor: '#dc2626' },
      { label: 'Subsídio Concedido', valor: BRL(report.totalSubsidioDescontos), cor: '#059669' },
    ],
    corpo,
  });

  return enviarViaBackend(
    {
      to: destinatario,
      subject: `${report.tipo === 'DIARIO' ? 'Fechamento Diário' : 'Fechamento Mensal'} 2G2M — ${report.periodoRotulo}`,
      html,
    },
    backendEmailUrl,
    backendEmailApiKey
  );
}

/**
 * Sends a "Vendas por Período" report email — mesmo conteúdo exibido na
 * tela de Vendas ao filtrar por período.
 */
export interface VendasPeriodoReport {
  periodoRotulo: string;
  vendas: Venda[];
  totalCobradoAlunos: number;
  totalSubsidio: number;
  totalBruto: number;
}

export async function enviarVendasPeriodoEmail(
  report: VendasPeriodoReport,
  config: ConfiguracoesSistema
): Promise<SendEmailResult> {
  const { backendEmailUrl, backendEmailApiKey, emailDestinatario } = config;
  const destinatario = emailDestinatario || 'financeiro@2g2m.com.br';

  const tabelaVendas = tabelaHtml(
    ['Data/Hora', 'Matrícula', 'Aluno/Curso', 'Serviço', 'Plano', 'Cobrado', 'Subsídio'],
    report.vendas.map((v) => [
      new Date(v.dataHora).toLocaleString('pt-BR'),
      v.alunoMatricula,
      `${v.alunoNome} / ${v.alunoCurso}`,
      v.servicoNome.toUpperCase(),
      `${v.planoCodigo} (${v.percentualDesconto}%)`,
      v.percentualDesconto === 100 ? 'GRÁTIS' : BRL(v.valorCobradoAluno),
      BRL(v.valorSubsidio),
    ]),
    6
  );

  const corpo = `
    <h3 style="font-size:13px;font-weight:900;color:#111827;margin:20px 0 8px;">Registro de Vendas do Período</h3>
    ${tabelaVendas}
  `;

  const html = baseEmailTemplate({
    tituloDocumento: 'Registro de Vendas por Período',
    subtitulo: '2G2M Gestão de Refeitórios',
    periodoRotulo: report.periodoRotulo,
    cardsResumo: [
      { label: 'Total de Acessos', valor: `${report.vendas.length}` },
      { label: 'Cobrado dos Alunos', valor: BRL(report.totalCobradoAlunos), cor: '#dc2626' },
      { label: 'Subsídio Concedido', valor: BRL(report.totalSubsidio), cor: '#059669' },
    ],
    corpo,
  });

  return enviarViaBackend(
    {
      to: destinatario,
      subject: `Registro de Vendas 2G2M — ${report.periodoRotulo}`,
      html,
    },
    backendEmailUrl,
    backendEmailApiKey
  );
}

export interface RecuperacaoReport {
  periodoRotulo: string;
  totalAtendimentos: number;
  totalSubsidio: number;
  resumoPlanos: Array<{
    planoCodigo: string;
    percentualDesconto: number;
    quantidade: number;
    valorBaseTotal: number;
    valorSubsidioTotal: number;
  }>;
  resumoServicos: Array<{
    servicoNome: string;
    quantidade: number;
    valorBaseTotal: number;
    valorSubsidioTotal: number;
  }>;
  vendasDetalhadas: Venda[];
}

/**
 * Sends discount recovery report email via the Nodemailer backend.
 * Contém: bloco de recuperação por serviço + bloco detalhado das vendas
 * do período, no mesmo padrão visual da tela de Recuperação.
 */
export async function enviarRecuperacaoEmail(
  report: RecuperacaoReport,
  config: ConfiguracoesSistema,
  emailDestinoCustom?: string
): Promise<SendEmailResult> {
  const { backendEmailUrl, backendEmailApiKey, emailDestinatario } = config;
  const targetEmail = emailDestinoCustom?.trim() || emailDestinatario || 'financeiro@2g2m.com.br';

  const tabelaPlanos = tabelaHtml(
    ['Plano', 'Desconto', 'Qtd.', 'Valor Base', 'Reembolso'],
    report.resumoPlanos.map((p) => [
      p.planoCodigo,
      `${p.percentualDesconto}%`,
      `${p.quantidade}`,
      BRL(p.valorBaseTotal),
      BRL(p.valorSubsidioTotal),
    ]),
    4
  );

  const tabelaServicos = tabelaHtml(
    ['Serviço', 'Qtd. Refeições', 'Valor Base Total', 'Valor do Reembolso'],
    report.resumoServicos.map((s) => [
      s.servicoNome.toUpperCase(),
      `${s.quantidade}`,
      BRL(s.valorBaseTotal),
      BRL(s.valorSubsidioTotal),
    ]),
    3
  );

  const tabelaVendas = tabelaHtml(
    ['Matrícula', 'Aluno', 'Curso', 'Serviço', 'Data/Hora', 'Plano', 'Reembolso'],
    report.vendasDetalhadas.map((v) => [
      v.alunoMatricula,
      v.alunoNome,
      v.alunoCurso,
      v.servicoNome.toUpperCase(),
      new Date(v.dataHora).toLocaleString('pt-BR'),
      `${v.planoCodigo} (${v.percentualDesconto}%)`,
      BRL(v.valorSubsidio),
    ]),
    6
  );

  const corpo = `
    <h3 style="font-size:13px;font-weight:900;color:#111827;margin:20px 0 8px;">Consolidado por Serviço — Valor a Recuperar</h3>
    ${tabelaServicos}
    <h3 style="font-size:13px;font-weight:900;color:#111827;margin:20px 0 8px;">Consolidado por Faixa de Desconto / Plano</h3>
    ${tabelaPlanos}
    <h3 style="font-size:13px;font-weight:900;color:#111827;margin:20px 0 8px;">Relação Detalhada das Vendas do Período</h3>
    ${tabelaVendas}
  `;

  const html = baseEmailTemplate({
    tituloDocumento: 'Solicitação de Recuperação de Descontos',
    subtitulo: 'Reembolso do Contratante referente aos subsídios concedidos',
    periodoRotulo: report.periodoRotulo,
    cardsResumo: [
      { label: 'Total de Atendimentos', valor: `${report.totalAtendimentos}` },
      { label: 'Total a Reembolsar', valor: BRL(report.totalSubsidio), cor: '#059669' },
    ],
    corpo,
  });

  return enviarViaBackend(
    {
      to: targetEmail,
      subject: `Solicitação de Recuperação de Descontos — 2G2M — ${report.periodoRotulo}`,
      html,
    },
    backendEmailUrl,
    backendEmailApiKey
  );
}

/**
 * Função central de envio: chama o backend Node.js/Nodemailer via HTTP.
 * O backend é quem efetivamente fala SMTP — o app (front-end) nunca tem
 * acesso a socket SMTP direto, então essa chamada HTTP é o único caminho
 * possível a partir de dentro do WebView do APK.
 */
async function enviarViaBackend(
  payload: { to: string; subject: string; html: string },
  backendEmailUrl?: string,
  backendEmailApiKey?: string
): Promise<SendEmailResult> {
  if (!backendEmailUrl) {
    return {
      sucesso: false,
      mensagem:
        'Erro: URL do backend de e-mail não configurada. Acesse o menu Configurações do Admin e informe a URL do backend (Nodemailer) e a chave de API.',
    };
  }

  try {
    const response = await fetch(`${backendEmailUrl.replace(/\/$/, '')}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(backendEmailApiKey ? { 'x-api-key': backendEmailApiKey } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.sucesso) {
      return {
        sucesso: true,
        mensagem: data.mensagem || `E-mail enviado com sucesso para ${payload.to}!`,
        detalhes: data.detalhes,
      };
    }

    return {
      sucesso: false,
      mensagem: data.mensagem || `Erro ao enviar e-mail (HTTP ${response.status}).`,
    };
  } catch (error: any) {
    console.error('Erro ao chamar backend de e-mail:', error);
    return {
      sucesso: false,
      mensagem: `Falha de conexão com o backend de e-mail: ${error?.message || 'verifique se o backend está no ar e se o totem tem internet.'}`,
    };
  }
}
