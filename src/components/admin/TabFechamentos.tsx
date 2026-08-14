import React, { useState, useEffect } from 'react';
import { Venda, ConfiguracoesSistema } from '../../types';
import { getAllVendas, getConfiguracoes } from '../../db/indexedDB';
import { 
  gerarRelatorioFechamento, 
  enviarFechamentoEmail, 
  FechamentoReport, 
  SendEmailResult 
} from '../../services/emailService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Mail, 
  Send, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Utensils 
} from 'lucide-react';

export const TabFechamentos: React.FC = () => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [config, setConfig] = useState<ConfiguracoesSistema | null>(null);
  const [loading, setLoading] = useState(false);

  // Selected Reference Date
  const [dataRefInput, setDataRefInput] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Preview reports
  const [reportDiario, setReportDiario] = useState<FechamentoReport | null>(null);
  const [reportMensal, setReportMensal] = useState<FechamentoReport | null>(null);

  // Status Feedback
  const [sendResult, setSendResult] = useState<SendEmailResult | null>(null);

  useEffect(() => {
    loadData();
  }, [dataRefInput]);

  const loadData = async () => {
    try {
      const [vList, cfg] = await Promise.all([
        getAllVendas(),
        getConfiguracoes(),
      ]);
      setVendas(vList);
      setConfig(cfg);

      const refDate = dataRefInput ? new Date(`${dataRefInput}T12:00:00`) : new Date();

      setReportDiario(gerarRelatorioFechamento(vList, 'DIARIO', refDate));
      setReportMensal(gerarRelatorioFechamento(vList, 'MENSAL', refDate));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnviarEmail = async (report: FechamentoReport | null) => {
    if (!report || !config) return;

    setLoading(true);
    setSendResult(null);

    const result = await enviarFechamentoEmail(report, config);
    setSendResult(result);
    setLoading(false);
  };

  // Export to PDF (jsPDF) — mesmo padrão visual usado em Recuperação/Vendas
  const handleGerarPdf = (report: FechamentoReport | null) => {
    if (!report) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(185, 28, 28);
    doc.text('2G2M GESTÃO DE REFEITÓRIOS', 14, 16);

    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(report.tipo === 'DIARIO' ? 'Fechamento Diário de Vendas' : 'Fechamento Mensal de Vendas', 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Período de Referência: ${report.periodoRotulo}`, 14, 27);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 31);

    doc.setLineWidth(0.5);
    doc.setDrawColor(229, 231, 235);
    doc.line(14, 34, 196, 34);

    doc.setFillColor(243, 244, 246);
    doc.rect(14, 37, 182, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text(`Total de Acessos: ${report.totalVendasCount}`, 18, 44);
    doc.text(`Total Bruto (Base): R$ ${report.totalBrutoBase.toFixed(2).replace('.', ',')}`, 18, 50);
    doc.setTextColor(220, 38, 38);
    doc.text(`Cobrado dos Alunos: R$ ${report.totalCobradoAlunos.toFixed(2).replace('.', ',')}`, 100, 44);
    doc.setTextColor(16, 185, 129);
    doc.text(`Subsídio Concedido: R$ ${report.totalSubsidioDescontos.toFixed(2).replace('.', ',')}`, 100, 50);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text('Resumo por Serviço', 14, 68);

    const tableData = report.porServico.map((s) => [
      s.servicoNome,
      `${s.quantidade}x`,
      `R$ ${s.totalCobrado.toFixed(2).replace('.', ',')}`,
      `R$ ${s.totalSubsidio.toFixed(2).replace('.', ',')}`,
    ]);

    autoTable(doc, {
      startY: 71,
      head: [['Serviço', 'Qtd.', 'Total Cobrado Alunos', 'Total Subsídio']],
      body: tableData.length > 0 ? tableData : [['Nenhum acesso registrado no período.', '-', '-', '-']],
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        2: { fontStyle: 'bold', textColor: [220, 38, 38] },
        3: { fontStyle: 'bold', textColor: [16, 185, 129] },
      },
    });

    const tipoLabel = report.tipo === 'DIARIO' ? 'Diario' : 'Mensal';
    doc.save(`Fechamento_${tipoLabel}_2G2M_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-red-600" />
            <span>Fechamentos de Vendas (E-mail via Backend)</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Gere e envie relatórios consolidados de fechamento diário e mensal por e-mail
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
          <Calendar className="w-4 h-4 text-red-600" />
          <span>Data de Referência:</span>
          <input
            type="date"
            value={dataRefInput}
            onChange={(e) => setDataRefInput(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Config Notification Notice if keys are missing */}
      {config && !config.backendEmailUrl && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-900 font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>
              <strong>Envio de E-mail Desativado:</strong> A URL do backend de e-mail (Nodemailer) não foi configurada. Acesse o menu <strong>Configurações</strong> para informar a URL do backend e a chave de API.
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono bg-red-200 text-red-900 px-2 py-1 rounded font-bold">Configuração Incompleta</span>
        </div>
      )}

      {/* Feedback Banner */}
      {sendResult && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-3 border shadow-sm ${
            sendResult.sucesso
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {sendResult.sucesso ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div className="font-bold">{sendResult.mensagem}</div>
            {sendResult.detalhes && (
              <div className="text-[10px] font-mono opacity-80 max-h-24 overflow-y-auto">
                {JSON.stringify(sendResult.detalhes, null, 2)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid with 2 Closure Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARD 1: FECHAMENTO DIÁRIO */}
        {reportDiario && (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-black uppercase">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Fechamento Diário</span>
                </span>
                <span className="text-sm font-black text-gray-900">{reportDiario.periodoRotulo}</span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Qtd. de Vendas</span>
                  <span className="text-xl font-black text-gray-900">{reportDiario.totalVendasCount} acessos</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Cobrado Alunos</span>
                  <span className="text-xl font-black text-red-600">R$ {reportDiario.totalCobradoAlunos.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>

              {/* Service Breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold text-gray-700 uppercase block">Resumo por Serviço:</span>
                {reportDiario.porServico.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Nenhum acesso registrado no dia.</p>
                ) : (
                  <div className="space-y-1.5">
                    {reportDiario.porServico.map(s => (
                      <div key={s.servicoNome} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded-lg">
                        <span className="font-bold text-gray-800">{s.servicoNome} ({s.quantidade}x)</span>
                        <span className="font-mono font-bold text-gray-900">R$ {s.totalCobrado.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleGerarPdf(reportDiario)}
                className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3.5 px-4 rounded-xl transition-all text-xs shrink-0"
                title="Gerar PDF do fechamento diário"
              >
                <FileText className="w-4 h-4 text-red-600" />
                <span>PDF</span>
              </button>
              <button
                onClick={() => handleEnviarEmail(reportDiario)}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black py-3.5 rounded-xl shadow transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-xs cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Enviar Fechamento Diário por E-mail</span>
              </button>
            </div>
          </div>
        )}

        {/* CARD 2: FECHAMENTO MENSAL */}
        {reportMensal && (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-900 text-white rounded-full text-xs font-black uppercase">
                  <Calendar className="w-3.5 h-3.5 text-red-400" />
                  <span>Fechamento Mensal</span>
                </span>
                <span className="text-sm font-black text-gray-900">{reportMensal.periodoRotulo}</span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Qtd. de Vendas</span>
                  <span className="text-xl font-black text-gray-900">{reportMensal.totalVendasCount} acessos</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Cobrado Alunos</span>
                  <span className="text-xl font-black text-red-600">R$ {reportMensal.totalCobradoAlunos.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>

              {/* Service Breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold text-gray-700 uppercase block">Resumo por Serviço:</span>
                {reportMensal.porServico.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Nenhum acesso registrado no mês.</p>
                ) : (
                  <div className="space-y-1.5">
                    {reportMensal.porServico.map(s => (
                      <div key={s.servicoNome} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded-lg">
                        <span className="font-bold text-gray-800">{s.servicoNome} ({s.quantidade}x)</span>
                        <span className="font-mono font-bold text-gray-900">R$ {s.totalCobrado.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleGerarPdf(reportMensal)}
                className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3.5 px-4 rounded-xl transition-all text-xs shrink-0"
                title="Gerar PDF do fechamento mensal"
              >
                <FileText className="w-4 h-4 text-red-600" />
                <span>PDF</span>
              </button>
              <button
                onClick={() => handleEnviarEmail(reportMensal)}
                disabled={loading}
                className="flex-1 bg-gray-900 hover:bg-gray-800 active:bg-black text-white font-black py-3.5 rounded-xl shadow transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-xs cursor-pointer"
              >
                <Send className="w-4 h-4 text-red-500" />
                <span>Enviar Fechamento Mensal por E-mail</span>
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
