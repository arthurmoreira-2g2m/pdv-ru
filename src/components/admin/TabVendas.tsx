import React, { useState, useEffect } from 'react';
import { Venda } from '../../types';
import { getAllVendas, clearAllVendas } from '../../db/indexedDB';
import * as XLSX from 'xlsx';
import { 
  Receipt, 
  Search, 
  Download, 
  Trash2, 
  Calendar, 
  DollarSign, 
  Utensils 
} from 'lucide-react';

export const TabVendas: React.FC = () => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

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

  const vendasFiltradas = vendas.filter((v) => {
    if (!v) return false;
    const searchLower = searchTerm.toLowerCase();
    const alunoNome = v.alunoNome || '';
    const alunoMatricula = v.alunoMatricula || '';
    const servicoNome = v.servicoNome || '';
    const planoCodigo = v.planoCodigo || '';
    const dataHora = v.dataHora || '';

    const matchesSearch =
      alunoNome.toLowerCase().includes(searchLower) ||
      alunoMatricula.toLowerCase().includes(searchLower) ||
      servicoNome.toLowerCase().includes(searchLower) ||
      planoCodigo.toLowerCase().includes(searchLower);

    const dataVendaYMD = dataHora.split('T')[0];
    const matchesDataInicio = !dataInicio || dataVendaYMD >= dataInicio;
    const matchesDataFim = !dataFim || dataVendaYMD <= dataFim;

    return matchesSearch && matchesDataInicio && matchesDataFim;
  });

  // Preset helpers for date filters
  const setPeriodoHoje = () => {
    const hoje = new Date().toISOString().split('T')[0];
    setDataInicio(hoje);
    setDataFim(hoje);
  };

  const setPeriodoSeteDias = () => {
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje);
    seteDiasAtras.setDate(hoje.getDate() - 6);
    setDataInicio(seteDiasAtras.toISOString().split('T')[0]);
    setDataFim(hoje.toISOString().split('T')[0]);
  };

  const setPeriodoEsteMes = () => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    setDataInicio(primeiroDia.toISOString().split('T')[0]);
    setDataFim(ultimoDia.toISOString().split('T')[0]);
  };

  const limparPeriodo = () => {
    setDataInicio('');
    setDataFim('');
  };

  // Calculate totals
  const totalCobradoAlunos = vendasFiltradas.reduce((sum, v) => sum + (v.valorCobradoAluno || 0), 0);
  const totalSubsidio = vendasFiltradas.reduce((sum, v) => sum + (v.valorSubsidio || 0), 0);
  const totalBruto = vendasFiltradas.reduce((sum, v) => sum + (v.precoBase || 0), 0);

  // Export to Excel XLSX
  const handleExportExcel = () => {
    const dataToExport = vendasFiltradas.map((v) => ({
      ID: v.id,
      'Data e Hora': new Date(v.dataHora).toLocaleString('pt-BR'),
      Matrícula: v.alunoMatricula,
      Aluno: v.alunoNome,
      Curso: v.alunoCurso,
      Serviço: v.servicoNome,
      'Preço Base (R$)': v.precoBase,
      'Plano Código': v.planoCodigo,
      'Desconto (%)': `${v.percentualDesconto}%`,
      'Cobrado do Aluno (R$)': v.valorCobradoAluno,
      'Subsídio Reembolso (R$)': v.valorSubsidio,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas_2G2M');
    XLSX.writeFile(workbook, `Registro_Vendas_2G2M_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleClearVendas = async () => {
    if (confirm('Deseja realmente apagar todo o histórico de vendas? Esta ação é permanente.')) {
      await clearAllVendas();
      await loadVendas();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Stats */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-red-600" />
            <span>Registro de Vendas ({vendasFiltradas.length})</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Histórico completo de acessos ao refeitório e transações registradas
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all shadow"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={handleClearVendas}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-red-50 text-red-700 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all border border-gray-200 hover:border-red-200"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            <span>Limpar Histórico</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Total Acessos</span>
          <span className="text-2xl font-black text-gray-900">{vendasFiltradas.length}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Cobrado dos Alunos</span>
          <span className="text-2xl font-black text-red-600">R$ {totalCobradoAlunos.toFixed(2).replace('.', ',')}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Subsídio Concedido (Reembolso)</span>
          <span className="text-2xl font-black text-emerald-600">R$ {totalSubsidio.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>

      {/* Filters & Period Selection */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por aluno, matrícula, serviço ou plano..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-600"
          />
        </div>

        {/* Date Period Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-700">
          <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
            <Calendar className="w-3.5 h-3.5 text-red-600 ml-1 shrink-0" />
            <span className="text-[11px] text-gray-500 font-bold uppercase">De:</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
            />
            <span className="text-[11px] text-gray-500 font-bold uppercase">Até:</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={setPeriodoHoje}
              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[11px] font-bold transition-all"
            >
              Hoje
            </button>
            <button
              onClick={setPeriodoSeteDias}
              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[11px] font-bold transition-all"
            >
              7 dias
            </button>
            <button
              onClick={setPeriodoEsteMes}
              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[11px] font-bold transition-all"
            >
              Este Mês
            </button>
            {(dataInicio || dataFim) && (
              <button
                onClick={limparPeriodo}
                className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-[11px] font-bold transition-all"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sales Log Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Data / Hora</th>
                <th className="px-4 py-3.5">Matrícula</th>
                <th className="px-4 py-3.5">Aluno / Curso</th>
                <th className="px-4 py-3.5">Serviço</th>
                <th className="px-4 py-3.5">Plano / Desconto</th>
                <th className="px-4 py-3.5">Cobrado do Aluno</th>
                <th className="px-4 py-3.5 text-right">Subsídio Reembolso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {vendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma venda registrada no período selecionado.
                  </td>
                </tr>
              ) : (
                vendasFiltradas.map((v) => (
                  <tr key={v.id} className="hover:bg-red-50/20 transition-colors">
                    <td className="px-4 py-3 text-gray-600 font-mono text-[11px]">
                      {new Date(v.dataHora).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{v.alunoMatricula}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{v.alunoNome}</div>
                      <div className="text-[10px] text-gray-500">{v.alunoCurso}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 uppercase">{v.servicoNome}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-bold text-[10px] border border-gray-200">
                        {v.planoCodigo} ({v.percentualDesconto}% desc)
                      </span>
                    </td>
                    <td className="px-4 py-3 font-extrabold text-red-600">
                      {v.percentualDesconto === 100 ? 'GRÁTIS' : `R$ ${v.valorCobradoAluno.toFixed(2).replace('.', ',')}`}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-emerald-600">
                      R$ {v.valorSubsidio.toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
