import React, { useState, useEffect } from 'react';
import { Aluno, PlanoDesconto } from '../../types';
import { 
  getAllAlunos, 
  saveAluno, 
  saveAlunosBulk, 
  deleteAluno, 
  clearAllAlunos,
  getAllPlanos,
  getConfiguracoes
} from '../../db/indexedDB';
import { importarPlanilhaArquivo, importarPlanilhaUrl } from '../../services/importService';
import { 
  Upload, 
  Link as LinkIcon, 
  Trash2, 
  Plus, 
  Search, 
  Check, 
  KeyRound, 
  Users, 
  FileSpreadsheet, 
  AlertTriangle,
  RefreshCw,
  Lock
} from 'lucide-react';

export const TabAlunos: React.FC = () => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [planos, setPlanos] = useState<PlanoDesconto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCurso, setFilterCurso] = useState('TODOS');
  const [filterPlano, setFilterPlano] = useState('TODOS');

  // Import Modal / Summary State
  const [urlInput, setUrlInput] = useState('');
  const [importSummary, setImportSummary] = useState<{
    msg: string;
    isError?: boolean;
    resumoAbas?: { abaNome: string; totalLidos: number; alunosImportados: number }[];
    planosDesconhecidos?: string[];
    alertas?: string[];
    erros?: string[];
  } | null>(null);

  // Clear Database Confirmation Modal State
  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [clearError, setClearError] = useState('');

  // Manual Add Student Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMatricula, setNewMatricula] = useState('');
  const [newNome, setNewNome] = useState('');
  const [newCurso, setNewCurso] = useState('');
  const [newPlano, setNewPlano] = useState('PLANO_REGULAR');
  const [newSenha, setNewSenha] = useState('123456');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [alunosList, planosList] = await Promise.all([
        getAllAlunos(),
        getAllPlanos(),
      ]);
      setAlunos(alunosList);
      setPlanos(planosList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Unique Courses list for filter dropdown
  const cursosDisponiveis = Array.from(new Set(alunos.map(a => (a && a.curso) ? a.curso : 'Geral'))).sort();

  // Filtered Students
  const alunosFiltrados = alunos.filter(a => {
    if (!a) return false;
    const nome = a.nome || '';
    const matricula = a.matricula || '';
    const curso = a.curso || '';
    const plano = a.plano || '';

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      nome.toLowerCase().includes(searchLower) ||
      matricula.toLowerCase().includes(searchLower) ||
      curso.toLowerCase().includes(searchLower);
    
    const matchesCurso = filterCurso === 'TODOS' || curso === filterCurso;
    const matchesPlano = filterPlano === 'TODOS' || plano === filterPlano;

    return matchesSearch && matchesCurso && matchesPlano;
  });

  // Handle File Import (CSV/XLSX)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setImportSummary({ msg: 'Lendo e processando abas da planilha...' });

    const result = await importarPlanilhaArquivo(file);
    if (result.sucesso && result.alunosValidos.length > 0) {
      const count = await saveAlunosBulk(result.alunosValidos);
      setImportSummary({ 
        msg: `Sucesso! ${count} alunos importados/atualizados com sucesso.`, 
        isError: false,
        resumoAbas: result.resumoAbas,
        planosDesconhecidos: result.planosDesconhecidos,
        alertas: result.alertas,
        erros: result.erros,
      });
      await loadData();
    } else {
      setImportSummary({ 
        msg: `Erro na importação: ${result.erros.join('; ') || 'Formato de planilha inválido'}`, 
        isError: true,
        erros: result.erros,
      });
    }
    setLoading(false);
    e.target.value = '';
  };

  // Handle URL Import
  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setLoading(true);
    setImportSummary({ msg: 'Baixando e processando planilha online...' });

    const config = await getConfiguracoes();
    const result = await importarPlanilhaUrl(urlInput.trim(), config.backendEmailUrl, config.backendEmailApiKey);
    if (result.sucesso && result.alunosValidos.length > 0) {
      const count = await saveAlunosBulk(result.alunosValidos);
      setImportSummary({ 
        msg: `Sucesso! ${count} alunos importados da URL online.`, 
        isError: false,
        resumoAbas: result.resumoAbas,
        planosDesconhecidos: result.planosDesconhecidos,
        alertas: result.alertas,
        erros: result.erros,
      });
      setUrlInput('');
      await loadData();
    } else {
      setImportSummary({ 
        msg: `Erro na importação via URL: ${result.erros.join('; ')}`, 
        isError: true,
        erros: result.erros,
      });
    }
    setLoading(false);
  };

  // Handle Request Password Change for a Student
  const handleTogglePasswordRequest = async (aluno: Aluno) => {
    const updated = {
      ...aluno,
      solicitarTrocaSenha: !aluno.solicitarTrocaSenha,
    };
    await saveAluno(updated);
    await loadData();
  };

  // Handle Delete Single Student
  const handleDeleteAluno = async (matricula: string) => {
    if (confirm(`Tem certeza que deseja excluir a matrícula ${matricula}?`)) {
      await deleteAluno(matricula);
      await loadData();
    }
  };

  // Handle Clear Database Execution
  const handleExecuteClearAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setClearError('');

    const config = await getConfiguracoes();
    if (confirmPasswordInput.trim() !== config.adminPasswordHash) {
      setClearError('Senha de confirmação incorreta.');
      return;
    }

    await clearAllAlunos();
    setShowClearModal(false);
    setConfirmPasswordInput('');
    await loadData();
    alert('Base de dados de alunos apagada com sucesso!');
  };

  // Handle Manual Student Add
  const handleAddManualStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatricula.trim() || !newNome.trim()) {
      alert('Matrícula e Nome são obrigatórios.');
      return;
    }

    const novoAluno: Aluno = {
      matricula: newMatricula.trim(),
      nome: newNome.trim(),
      curso: newCurso.trim() || 'Geral',
      plano: newPlano,
      senha: newSenha.trim() || newMatricula.trim().slice(-6) || '202600',
      solicitarTrocaSenha: true,
    };

    await saveAluno(novoAluno);
    setShowAddModal(false);
    setNewMatricula('');
    setNewNome('');
    setNewCurso('');
    await loadData();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Bar / Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-red-600" />
            <span>Cadastro de Alunos ({alunos.length})</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Gerencie os alunos cadastrados e a importação via planilhas CSV/XLSX
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Aluno</span>
          </button>

          <button
            onClick={() => setShowClearModal(true)}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-red-50 text-red-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-gray-200 hover:border-red-200"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            <span>Limpar Cadastro</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Import Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Method 1: File Upload */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-gray-900 font-extrabold text-sm">
            <FileSpreadsheet className="w-5 h-5 text-red-600" />
            <span>1. Importar por Arquivo (CSV / XLSX)</span>
          </div>
          <p className="text-xs text-gray-500">
            Selecione uma planilha contendo as colunas: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">matrícula, nome, plano, senha, curso</code>
          </p>

          <label className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold p-3 rounded-xl border-2 border-dashed border-red-300 cursor-pointer transition-colors text-xs">
            <Upload className="w-4 h-4" />
            <span>Selecionar Planilha CSV/XLSX</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Method 2: Online Link Import */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-gray-900 font-extrabold text-sm">
            <LinkIcon className="w-5 h-5 text-red-600" />
            <span>2. Importar por Link de Planilha Online</span>
          </div>
          <p className="text-xs text-gray-500">
            Cole a URL pública da planilha (ex: Google Sheets publicado em CSV)
          </p>

          <form onSubmit={handleUrlImport} className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/..."
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-600"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0"
            >
              Baixar
            </button>
          </form>
        </div>
      </div>

      {/* Import Status Message & Detailed Summary */}
      {importSummary && (
        <div
          className={`p-5 rounded-2xl text-xs font-semibold space-y-3 ${
            importSummary.isError
              ? 'bg-red-50 text-red-900 border-2 border-red-200'
              : 'bg-emerald-50 text-emerald-950 border-2 border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-black uppercase tracking-wide">{importSummary.msg}</span>
            <button 
              onClick={() => setImportSummary(null)} 
              className="text-gray-500 hover:text-gray-900 font-bold underline text-xs cursor-pointer"
            >
              Fechar Resumo
            </button>
          </div>

          {/* Breakdown per Sheet/Aba */}
          {importSummary.resumoAbas && importSummary.resumoAbas.length > 0 && (
            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-emerald-300 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-gray-800 block">Resumo de Processamento por Aba (Sheet):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {importSummary.resumoAbas.map((sheet, i) => (
                  <div key={i} className="bg-emerald-100/60 p-2 rounded-lg text-gray-800 text-[11px] border border-emerald-200">
                    <strong className="block text-emerald-950">{sheet.abaNome}</strong>
                    <span>{sheet.alunosImportados} de {sheet.totalLidos} linhas importadas</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unknown Plans Warnings */}
          {importSummary.planosDesconhecidos && importSummary.planosDesconhecidos.length > 0 && (
            <div className="bg-amber-100/90 text-amber-950 p-3 rounded-xl border border-amber-300 space-y-1">
              <span className="font-black text-amber-900 block uppercase">⚠️ Atenção: Códigos de plano não cadastrados no Admin:</span>
              <p className="text-[11px]">
                Os seguintes códigos da coluna Tags não existem no cadastro de planos: <strong className="font-mono">{importSummary.planosDesconhecidos.join(', ')}</strong>.
                Cadastre esses códigos no menu "Planos" para aplicar os descontos corretos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, matrícula ou curso..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto text-xs font-semibold text-gray-700">
          <div className="flex items-center gap-1.5">
            <span>Curso:</span>
            <select
              value={filterCurso}
              onChange={(e) => setFilterCurso(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none"
            >
              <option value="TODOS">Todos os Cursos</option>
              {cursosDisponiveis.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span>Plano:</span>
            <select
              value={filterPlano}
              onChange={(e) => setFilterPlano(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none"
            >
              <option value="TODOS">Todos os Planos</option>
              {planos.map(p => (
                <option key={p.codigo} value={p.codigo}>{p.nome} ({p.codigo})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Matrícula</th>
                <th className="px-4 py-3.5">Aluno</th>
                <th className="px-4 py-3.5">Curso</th>
                <th className="px-4 py-3.5">Plano de Desconto</th>
                <th className="px-4 py-3.5">Acesso / Senha</th>
                <th className="px-4 py-3.5">Troca de Senha?</th>
                <th className="px-4 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {alunosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nenhum aluno encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                alunosFiltrados.map((aluno) => (
                  <tr key={aluno.matricula} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900">{aluno.matricula}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{aluno.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{aluno.curso}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2.5 py-1 bg-red-50 text-red-700 rounded-full font-bold text-[10px] border border-red-100">
                        {aluno.plano}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold border border-gray-200">
                        <Lock className="w-3 h-3 text-gray-400" />
                        ••••••
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleTogglePasswordRequest(aluno)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                          aluno.solicitarTrocaSenha
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                        title="Clique para alternar a solicitação de troca de senha no próximo login"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>{aluno.solicitarTrocaSenha ? 'Sim (Solicitada)' : 'Não'}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteAluno(aluno.matricula)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Aluno"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Clear Database */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-200">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-xl font-black text-gray-900">Limpar Cadastro de Alunos</h4>
                <p className="text-xs text-gray-500">Ação irreversível</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 font-medium">
              Esta ação apagar totalmente todos os <strong>{alunos.length} alunos</strong> cadastrados na base de dados local. Para prosseguir, digite sua senha de administrador.
            </p>

            {clearError && (
              <div className="p-3 bg-red-50 text-red-800 text-xs font-semibold rounded-xl border border-red-200">
                {clearError}
              </div>
            )}

            <form onSubmit={handleExecuteClearAll} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Senha de Administrador
                </label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-600"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs shadow"
                >
                  Confirmar e Apagar Tudo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manual Student Add */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-200">
            <h4 className="text-xl font-black text-gray-900">Cadastrar Novo Aluno</h4>

            <form onSubmit={handleAddManualStudent} className="space-y-3 text-xs font-medium">
              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Matrícula *</label>
                <input
                  type="text"
                  value={newMatricula}
                  onChange={(e) => setNewMatricula(e.target.value)}
                  placeholder="Ex: 2026099"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  placeholder="Ex: Ana Clara Souza"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Curso</label>
                <input
                  type="text"
                  value={newCurso}
                  onChange={(e) => setNewCurso(e.target.value)}
                  placeholder="Ex: Enfermagem"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Plano de Desconto</label>
                <select
                  value={newPlano}
                  onChange={(e) => setNewPlano(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                >
                  {planos.map(p => (
                    <option key={p.codigo} value={p.codigo}>{p.nome} ({p.codigo})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Senha Inicial</label>
                <input
                  type="password"
                  value={newSenha}
                  onChange={(e) => setNewSenha(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl shadow"
                >
                  Salvar Aluno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
