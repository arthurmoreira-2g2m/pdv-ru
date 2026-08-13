import React, { useState, useEffect } from 'react';
import { Venda } from '../../types';
import { getAllVendas, getConfiguracoes } from '../../db/indexedDB';
import { enviarRecuperacaoEmail } from '../../services/emailService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  FileCheck, 
  Printer, 
  Download, 
  Calendar, 
  DollarSign, 
  FileSpreadsheet,
  Building,
  FileText,
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const TabRecuperacaoDescontos: React.FC = () => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ msg: string; isError: boolean } | null>(null);

  useEffect(() => {
    loadVendas();
  }, []);

  const loadVendas = async () => {
    try {
      const list = await getAllVendas();
      setVendas(list);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter Sales by Date Range
  const vendasFiltradas = vendas.filter((v) => {
    if (!v || !v.dataHora) return false;
    const dataVendaYMD = v.dataHora.split('T')[0];
    if (dataInicio && dataVendaYMD < dataInicio) return false;
    if (dataFim && dataVendaYMD > dataFim) return false;
    return true;
  });

  // Calculate Grouping by Discount Rate
  const agrupamentoPorPlano: Record<
    string,
    {
      planoCodigo: string;
      percentualDesconto: number;
      quantidade: number;
      valorBaseTotal: number;
      valorSubsidioTotal: number;
    }
  > = {};

  let totalGeralSubsidio = 0;
  let totalGeralAtendimentos = 0;
  let totalGeralBruto = 0;

  for (const v of vendasFiltradas) {
    const key = `${v.planoCodigo}_${v.percentualDesconto}`;
    if (!agrupamentoPorPlano[key]) {
      agrupamentoPorPlano[key] = {
        planoCodigo: v.planoCodigo,
        percentualDesconto: v.percentualDesconto || 0,
        quantidade: 0,
        valorBaseTotal: 0,
        valorSubsidioTotal: 0,
      };
    }

    agrupamentoPorPlano[key].quantidade += 1;
    agrupamentoPorPlano[key].valorBaseTotal += v.precoBase || 0;
    agrupamentoPorPlano[key].valorSubsidioTotal += v.valorSubsidio || 0;

    totalGeralSubsidio += v.valorSubsidio || 0;
    totalGeralAtendimentos += 1;
    totalGeralBruto += v.precoBase || 0;
  }

  const listaPlanosSubsidio = Object.values(agrupamentoPorPlano).sort(
    (a, b) => b.percentualDesconto - a.percentualDesconto
  );

  // Print Document
  const handlePrintReport = () => {
    window.print();
  };

  // Generate Client-Side PDF Report (jsPDF)
  const handleGerarPdf = () => {
    const periodoRotulo = dataInicio || dataFim 
      ? `De ${dataInicio || 'Início'} até ${dataFim || 'Atual'}`
      : 'Período Completo Acumulado';

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(185, 28, 28);
    doc.text('2G2M GESTÃO DE REFEITÓRIOS', 14, 16);

    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text('Solicitação de Recuperação de Descontos e Reembolso', 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Período de Referência: ${periodoRotulo}`, 14, 27);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 31);

    doc.setLineWidth(0.5);
    doc.setDrawColor(229, 231, 235);
    doc.line(14, 34, 196, 34);

    // Total Highlight Box
    doc.setFillColor(243, 244, 246);
    doc.rect(14, 37, 182, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(17, 24, 39);
    doc.text('VALOR TOTAL A REEMBOLSAR DO CONTRATANTE:', 18, 44);

    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129);
    doc.text(`R$ ${totalGeralSubsidio.toFixed(2).replace('.', ',')}`, 18, 51);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`(${totalGeralAtendimentos} refeições/acessos atendidos no período)`, 120, 51);

    // Table 1: Plan Summary
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text('1. Consolidado por Faixa de Desconto / Plano', 14, 62);

    const table1Data = listaPlanosSubsidio.map((p) => [
      p.planoCodigo,
      `${p.percentualDesconto}%`,
      `${p.quantidade} acessos`,
      `R$ ${p.valorBaseTotal.toFixed(2).replace('.', ',')}`,
      `R$ ${p.valorSubsidioTotal.toFixed(2).replace('.', ',')}`,
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['Código do Plano', 'Desconto (%)', 'Qtd. Refeições', 'Valor Base Total', 'Valor Reembolso']],
      body: table1Data,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        4: { fontStyle: 'bold', textColor: [16, 185, 129], halign: 'right' },
      },
    });

    // Table 2: Itemized Sales
    const finalY1 = (doc as any).lastAutoTable?.finalY || 100;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text('2. Relação Analítica de Atendimentos', 14, finalY1 + 10);

    const table2Data = vendasFiltradas.map((v) => [
      v.id || '-',
      v.alunoMatricula || '-',
      v.alunoNome || '-',
      v.alunoCurso || '-',
      v.dataHora ? new Date(v.dataHora).toLocaleString('pt-BR') : '-',
      v.servicoNome || '-',
      `${v.planoCodigo} (${v.percentualDesconto}%)`,
      `R$ ${(v.valorSubsidio || 0).toFixed(2).replace('.', ',')}`,
    ]);

    autoTable(doc, {
      startY: finalY1 + 13,
      head: [['ID Venda', 'Matrícula', 'Aluno', 'Curso', 'Data/Hora', 'Serviço', 'Plano', 'Reembolso']],
      body: table2Data,
      theme: 'striped',
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { fontSize: 6 },
        1: { fontStyle: 'bold' },
        7: { fontStyle: 'bold', textColor: [16, 185, 129], halign: 'right' },
      },
    });

    // Signatures Block
    const finalY2 = (doc as any).lastAutoTable?.finalY || 200;
    const signatureY = Math.min(finalY2 + 22, 270);

    doc.setLineWidth(0.3);
    doc.setDrawColor(156, 163, 175);
    doc.line(20, signatureY, 90, signatureY);
    doc.line(110, signatureY, 180, signatureY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('2G2M Gestão de Refeitórios', 55, signatureY + 4, { align: 'center' });
    doc.text('Instituição de Ensino / Contratante', 145, signatureY + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Responsável Financeiro', 55, signatureY + 8, { align: 'center' });
    doc.text('De acordo e Visto de Conformidade', 145, signatureY + 8, { align: 'center' });

    doc.save(`Solicitacao_Recuperacao_Descontos_2G2M_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Send Email via EmailJS
  const handleSendEmail = async () => {
    setEmailStatus(null);
    setIsSendingEmail(true);

    try {
      const config = await getConfiguracoes();
      const periodoRotulo = dataInicio || dataFim 
        ? `De ${dataInicio || 'Início'} até ${dataFim || 'Atual'}`
        : 'Período Completo Acumulado';

      const result = await enviarRecuperacaoEmail(
        {
          periodoRotulo,
          totalAtendimentos: totalGeralAtendimentos,
          totalSubsidio: totalGeralSubsidio,
          resumoPlanos: listaPlanosSubsidio,
          vendasDetalhadas: vendasFiltradas,
        },
        config
      );

      setEmailStatus({
        msg: result.mensagem,
        isError: !result.sucesso,
      });
    } catch (err: any) {
      console.error(err);
      setEmailStatus({
        msg: `Falha ao processar envio de e-mail: ${err?.message || 'Erro desconhecido'}`,
        isError: true,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Export XLSX Document
  const handleExportXlsx = () => {
    const detalhamentoData = vendasFiltradas.map((v) => ({
      'ID Venda': v.id || '',
      'Matrícula Aluno': v.alunoMatricula || '',
      'Nome do Aluno': v.alunoNome || '',
      'Curso': v.alunoCurso || '',
      'Data e Hora': v.dataHora ? new Date(v.dataHora).toLocaleString('pt-BR') : '',
      'Serviço': v.servicoNome || '',
      'Código do Plano': v.planoCodigo || '',
      'Percentual Desconto': `${v.percentualDesconto}%`,
      'Valor Base (R$)': v.precoBase || 0,
      'Valor Cobrado Aluno (R$)': v.valorCobradoAluno || 0,
      'Valor Reembolso Subsídio (R$)': v.valorSubsidio || 0,
    }));

    const resumoData = listaPlanosSubsidio.map((p) => ({
      'Código do Plano': p.planoCodigo,
      'Percentual Desconto (%)': `${p.percentualDesconto}%`,
      'Quantidade Refeições': p.quantidade,
      'Valor Base Acumulado (R$)': p.valorBaseTotal,
      'Total Subsídio Reembolso (R$)': p.valorSubsidioTotal,
    }));

    const workbook = XLSX.utils.book_new();

    const wsDetalhamento = XLSX.utils.json_to_sheet(detalhamentoData);
    XLSX.utils.book_append_sheet(workbook, wsDetalhamento, 'Detalhamento_Vendas');

    const wsResumo = XLSX.utils.json_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(workbook, wsResumo, 'Consolidado_Planos');

    XLSX.writeFile(
      workbook,
      `Solicitacao_Recuperacao_Descontos_2G2M_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Action Buttons */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-red-600" />
            <span>Solicitação de Recuperação de Descontos</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Relatório oficial para cobrança/reembolso junto ao contratante referente aos subsídios concedidos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={handleGerarPdf}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold px-3.5 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95"
          >
            <FileText className="w-4 h-4 text-white" />
            <span>Gerar PDF</span>
          </button>

          <button
            onClick={handleSendEmail}
            disabled={isSendingEmail}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-3.5 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isSendingEmail ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            <span>Enviar por E-mail</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white font-extrabold px-3.5 py-2.5 rounded-xl text-xs transition-all shadow active:scale-95"
          >
            <Printer className="w-4 h-4 text-red-500" />
            <span>Imprimir</span>
          </button>

          <button
            onClick={handleExportXlsx}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2.5 rounded-xl text-xs transition-all shadow active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Email Status Notification Banner */}
      {emailStatus && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
          emailStatus.isError 
            ? 'bg-red-50 text-red-900 border-red-200' 
            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            {emailStatus.isError ? (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span>{emailStatus.msg}</span>
          </div>
          <button
            onClick={() => setEmailStatus(null)}
            className="text-xs underline font-black hover:opacity-80 shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-700">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-red-600" />
          <span>Período de Referência:</span>
        </div>

        <div className="flex items-center gap-2">
          <span>De:</span>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold"
          />
        </div>

        <div className="flex items-center gap-2">
          <span>Até:</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold"
          />
        </div>

        {(dataInicio || dataFim) && (
          <button
            onClick={() => {
              setDataInicio('');
              setDataFim('');
            }}
            className="text-red-600 text-[11px] font-bold underline ml-auto"
          >
            Limpar Filtros de Data
          </button>
        )}
      </div>

      {/* Printable Report Document Card */}
      <div className="bg-white rounded-3xl border-2 border-gray-200 p-8 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
        
        {/* Document Letterhead */}
        <div className="flex items-center justify-between border-b-2 border-gray-900 pb-6">
          <div className="flex items-center space-x-4">
            <img 
              src="https://2g2m.com.br/imagens/2g2m-logo.png" 
              alt="Logo 2G2M" 
              className="h-12 w-auto object-contain"
            />
            <div>
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                2G2M Gestão de Refeitórios
              </h2>
              <p className="text-xs text-gray-600 font-bold uppercase">
                Documento de Cobrança e Reembolso de Descontos
              </p>
            </div>
          </div>

          <div className="text-right text-xs font-mono text-gray-600">
            <div>Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
            <div>Ref: {dataInicio || 'Início'} até {dataFim || 'Atual'}</div>
          </div>
        </div>

        {/* Explanation Banner */}
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-xs text-red-900 font-medium">
          <strong>Lógica de Reembolso do Contratante:</strong> Para cada modalidade de bolsa/desconto autorizada pela instituição, calcula-se a parcela percentual subsididada referente ao valor cheio do serviço (ex: 100% desc = 100% reembolso do valor base; 70% desc = 70% reembolso do valor base).
        </div>

        {/* Highlighted Big Total */}
        <div className="bg-gray-900 text-white rounded-2xl p-6 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-red-600 rounded-xl">
              <Building className="w-8 h-8 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Valor Total a Reembolsar do Contratante
              </span>
              <span className="text-xs text-red-400 font-semibold">
                Soma acumulada de todos os subsídios no período
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-3xl font-black text-emerald-400 block">
              R$ {totalGeralSubsidio.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">
              Total de {totalGeralAtendimentos} refeições atendidas
            </span>
          </div>
        </div>

        {/* Breakdown Table by Plan */}
        <div className="space-y-3">
          <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">
            Consolidado por Faixa de Desconto
          </h4>

          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-extrabold uppercase">
                <tr>
                  <th className="px-4 py-3">Código do Plano</th>
                  <th className="px-4 py-3">Percentual Desconto</th>
                  <th className="px-4 py-3">Qtd. Refeições</th>
                  <th className="px-4 py-3">Valor Base Total</th>
                  <th className="px-4 py-3 text-right">Valor do Reembolso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                {listaPlanosSubsidio.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Nenhum registro de venda para calcular reembolso.
                    </td>
                  </tr>
                ) : (
                  listaPlanosSubsidio.map((item) => (
                    <tr key={item.planoCodigo} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-gray-900">{item.planoCodigo}</td>
                      <td className="px-4 py-3 font-extrabold text-red-600">{item.percentualDesconto}% desc</td>
                      <td className="px-4 py-3 font-bold">{item.quantidade} acessos</td>
                      <td className="px-4 py-3 font-mono">R$ {item.valorBaseTotal.toFixed(2).replace('.', ',')}</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-600 text-sm">
                        R$ {item.valorSubsidioTotal.toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Itemized Sales Table (Contains ID Venda and Matrícula Aluno) */}
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">
              Relação Analítica de Atendimentos para Reembolso
            </h4>
            <span className="text-xs text-gray-500 font-medium">
              {vendasFiltradas.length} lançamentos individuais
            </span>
          </div>

          <div className="border border-gray-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-800 text-white font-extrabold uppercase">
                <tr>
                  <th className="px-3 py-2.5">ID Venda</th>
                  <th className="px-3 py-2.5">Matrícula</th>
                  <th className="px-3 py-2.5">Aluno</th>
                  <th className="px-3 py-2.5">Curso</th>
                  <th className="px-3 py-2.5">Data / Hora</th>
                  <th className="px-3 py-2.5">Serviço</th>
                  <th className="px-3 py-2.5">Plano</th>
                  <th className="px-3 py-2.5 text-right">Subsídio Reembolso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                {vendasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                      Nenhum atendimento individual registrado no período selecionado.
                    </td>
                  </tr>
                ) : (
                  vendasFiltradas.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-[10px] text-gray-500 font-bold">{v.id}</td>
                      <td className="px-3 py-2 font-mono text-[11px] font-black text-gray-900">{v.alunoMatricula}</td>
                      <td className="px-3 py-2 font-bold text-gray-900">{v.alunoNome}</td>
                      <td className="px-3 py-2 text-gray-600">{v.alunoCurso}</td>
                      <td className="px-3 py-2 text-gray-500 text-[11px]">
                        {v.dataHora ? new Date(v.dataHora).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="px-3 py-2 font-bold">{v.servicoNome}</td>
                      <td className="px-3 py-2">
                        <span className="inline-block bg-gray-100 px-2 py-0.5 rounded text-[10px] font-bold text-gray-700">
                          {v.planoCodigo} ({v.percentualDesconto}%)
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-black text-emerald-600 font-mono">
                        R$ {(v.valorSubsidio || 0).toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures for Official Receipt */}
        <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs text-gray-600 font-medium">
          <div className="border-t border-gray-400 pt-2">
            <div>_______________________________________</div>
            <div className="font-bold text-gray-900 mt-1">2G2M Gestão de Refeitórios</div>
            <div>Responsável Financeiro</div>
          </div>

          <div className="border-t border-gray-400 pt-2">
            <div>_______________________________________</div>
            <div className="font-bold text-gray-900 mt-1">Instituição de Ensino / Contratante</div>
            <div>De acordo e Visto de Conformidade</div>
          </div>
        </div>

      </div>

    </div>
  );
};
