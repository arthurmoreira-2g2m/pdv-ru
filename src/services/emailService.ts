import emailjs from '@emailjs/browser';
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
}

export interface SendEmailResult {
  sucesso: boolean;
  mensagem: string;
  detalhes?: any;
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
  };
}

/**
 * Sends closure report email via EmailJS
 */
export async function enviarFechamentoEmail(
  report: FechamentoReport,
  config: ConfiguracoesSistema
): Promise<SendEmailResult> {
  const { emailjsServiceId, emailjsTemplateId, emailjsPublicKey, emailjsDestinatario } = config;

  // Formatting html table body
  const servicosText = report.porServico
    .map(s => `- ${s.servicoNome}: ${s.quantidade} acessos | Alunos: R$ ${s.totalCobrado.toFixed(2)} | Subpago: R$ ${s.totalSubsidio.toFixed(2)}`)
    .join('\n');

  const payloadParams = {
    to_email: emailjsDestinatario || 'financeiro@2g2m.com.br',
    tipo_fechamento: report.tipo === 'DIARIO' ? 'Fechamento Diário' : 'Fechamento Mensal',
    periodo: report.periodoRotulo,
    qtd_vendas: report.totalVendasCount,
    total_bruto: `R$ ${report.totalBrutoBase.toFixed(2)}`,
    total_cobrado_alunos: `R$ ${report.totalCobradoAlunos.toFixed(2)}`,
    total_subsidio: `R$ ${report.totalSubsidioDescontos.toFixed(2)}`,
    resumo_servicos: servicosText || 'Nenhuma venda registrada no período.',
    data_envio: new Date().toLocaleString('pt-BR'),
  };

  if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey) {
    return {
      sucesso: false,
      mensagem: 'Erro: Configurações do EmailJS ausentes ou incompletas. Acesse o menu Configurações do Admin e preencha o Service ID, Template ID e Public Key para permitir o envio real de e-mails.',
    };
  }

  try {
    const response = await emailjs.send(
      emailjsServiceId,
      emailjsTemplateId,
      payloadParams,
      emailjsPublicKey
    );

    if (response.status === 200) {
      return {
        sucesso: true,
        mensagem: `E-mail de fechamento enviado com sucesso para ${payloadParams.to_email}!`,
        detalhes: {
          status: response.status,
          text: response.text,
          destinatario: payloadParams.to_email,
          tipo: report.tipo,
          periodo: report.periodoRotulo,
          totalVendasCount: report.totalVendasCount,
        },
      };
    } else {
      return {
        sucesso: false,
        mensagem: `Erro ao enviar e-mail: Código de resposta ${response.status} - ${response.text}`,
      };
    }
  } catch (error: any) {
    console.error('EmailJS Error:', error);
    return {
      sucesso: false,
      mensagem: `Falha no envio de e-mail via EmailJS: ${error?.text || error?.message || 'Erro de conexão ou credenciais inválidas.'}`,
    };
  }
}
