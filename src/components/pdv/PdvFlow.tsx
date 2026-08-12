import React, { useState, useEffect } from 'react';
import { Aluno, Servico, PlanoDesconto, Venda } from '../../types';
import { 
  getAlunoByMatricula, 
  saveAluno, 
  getAllServicos, 
  getPlanoByCodigo, 
  registrarVenda 
} from '../../db/indexedDB';
import { imprimirCupom, formatarDadosCupom, CouponData } from '../../services/printerService';
import { ThermalReceipt } from '../ThermalReceipt';
import { 
  User, 
  Lock, 
  Utensils, 
  CheckCircle, 
  Printer, 
  Clock, 
  ArrowLeft, 
  KeyRound, 
  AlertCircle,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface PdvFlowProps {
  onReturnHome: () => void;
}

type PdvStep = 'LOGIN' | 'TROCA_SENHA_PERGUNTA' | 'TROCA_SENHA_FORM' | 'SERVICOS' | 'CONFIRMACAO' | 'SUCESSO';

export const PdvFlow: React.FC<PdvFlowProps> = ({ onReturnHome }) => {
  const [step, setStep] = useState<PdvStep>('LOGIN');

  // Form State
  const [matriculaInput, setMatriculaInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [novaSenhaInput, setNovaSenhaInput] = useState('');
  const [confirmarSenhaInput, setConfirmarSenhaInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Active Transaction Context
  const [alunoLogado, setAlunoLogado] = useState<Aluno | null>(null);
  const [planoAluno, setPlanoAluno] = useState<PlanoDesconto | null>(null);
  const [servicosList, setServicosList] = useState<Servico[]>([]);
  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(null);
  const [vendaConfirmada, setVendaConfirmada] = useState<Venda | null>(null);
  const [couponData, setCouponData] = useState<CouponData | null>(null);
  const [countdown, setCountdown] = useState(8);

  // Load Services on mount or reset
  useEffect(() => {
    loadServicos();
  }, []);

  const loadServicos = async () => {
    try {
      const list = await getAllServicos();
      setServicosList(list.filter(s => s.ativo));
    } catch (err) {
      console.error('Erro ao carregar serviços:', err);
    }
  };

  // Auto-reset timer on Success screen
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'SUCESSO') {
      setCountdown(8);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            resetPdv();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step]);

  const resetPdv = () => {
    setStep('LOGIN');
    setMatriculaInput('');
    setSenhaInput('');
    setNovaSenhaInput('');
    setConfirmarSenhaInput('');
    setErrorMessage('');
    setAlunoLogado(null);
    setPlanoAluno(null);
    setServicoSelecionado(null);
    setVendaConfirmada(null);
    setCouponData(null);
  };

  // Handle Login Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!matriculaInput.trim() || !senhaInput.trim()) {
      setErrorMessage('Por favor, informe a matrícula e a senha.');
      return;
    }

    try {
      const aluno = await getAlunoByMatricula(matriculaInput.trim());

      if (!aluno) {
        setErrorMessage('Matrícula não encontrada no sistema.');
        return;
      }

      const senhaCorreta = aluno.senha || aluno.matricula;
      if (senhaInput.trim() !== senhaCorreta) {
        setErrorMessage('Senha incorreta. Verifique e tente novamente.');
        return;
      }

      // Fetch student plan
      const plano = await getPlanoByCodigo(aluno.plano);
      setPlanoAluno(plano || { codigo: aluno.plano, nome: 'Regular', percentualDesconto: 0 });
      setAlunoLogado(aluno);

      // Check if password reset requested
      if (aluno.solicitarTrocaSenha) {
        setStep('TROCA_SENHA_PERGUNTA');
      } else {
        await loadServicos();
        setStep('SERVICOS');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao autenticar. Tente novamente.');
    }
  };

  // Handle Password Change Decision
  const handleTrocaSenhaChoice = async (desejaTrocar: boolean) => {
    if (desejaTrocar) {
      setStep('TROCA_SENHA_FORM');
    } else {
      await loadServicos();
      setStep('SERVICOS');
    }
  };

  // Handle Password Change Submission
  const handleTrocaSenhaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (novaSenhaInput.length < 4) {
      setErrorMessage('A nova senha deve ter pelo menos 4 dígitos.');
      return;
    }

    if (novaSenhaInput !== confirmarSenhaInput) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    if (alunoLogado) {
      const alunoAtualizado: Aluno = {
        ...alunoLogado,
        senha: novaSenhaInput,
        solicitarTrocaSenha: false,
      };
      await saveAluno(alunoAtualizado);
      setAlunoLogado(alunoAtualizado);
      await loadServicos();
      setStep('SERVICOS');
    }
  };

  // Check service availability time window
  const isServicoDisponivel = (servico: Servico): { disponivel: boolean; motivo?: string } => {
    if (!servico.ativo) {
      return { disponivel: false, motivo: 'Serviço inativo' };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [hInicio, mInicio] = servico.horarioInicio.split(':').map(Number);
    const [hFim, mFim] = servico.horarioFim.split(':').map(Number);

    const inicioMinutes = hInicio * 60 + mInicio;
    const fimMinutes = hFim * 60 + mFim;

    if (currentMinutes < inicioMinutes || currentMinutes > fimMinutes) {
      return { 
        disponivel: false, 
        motivo: `Disponível das ${servico.horarioInicio} às ${servico.horarioFim}` 
      };
    }

    // Check plan restriction if configured
    if (alunoLogado && servico.planosPermitidos && !servico.planosPermitidos.includes('TODOS')) {
      if (!servico.planosPermitidos.includes(alunoLogado.plano)) {
        return { disponivel: false, motivo: 'Não permitido para o seu plano' };
      }
    }

    return { disponivel: true };
  };

  // Handle Service Selection
  const handleSelectServico = (servico: Servico) => {
    const status = isServicoDisponivel(servico);
    if (!status.disponivel) return;

    setServicoSelecionado(servico);
    setStep('CONFIRMACAO');
  };

  // Handle Final "ACESSAR" Button Click (Execute Sale)
  const handleConfirmarAcesso = async () => {
    if (!alunoLogado || !servicoSelecionado || !planoAluno) return;

    const precoBase = servicoSelecionado.precoBase;
    const percentualDesconto = planoAluno.percentualDesconto || 0;
    const valorSubsidio = precoBase * (percentualDesconto / 100);
    const valorCobradoAluno = precoBase - valorSubsidio;

    const novaVenda: Venda = {
      id: `VND-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dataHora: new Date().toISOString(),
      alunoMatricula: alunoLogado.matricula,
      alunoNome: alunoLogado.nome,
      alunoCurso: alunoLogado.curso,
      servicoId: servicoSelecionado.id,
      servicoNome: servicoSelecionado.nome,
      precoBase,
      planoCodigo: planoAluno.codigo,
      percentualDesconto,
      valorCobradoAluno,
      valorSubsidio,
    };

    try {
      await registrarVenda(novaVenda);
      setVendaConfirmada(novaVenda);

      // Generate coupon format
      const cData = formatarDadosCupom(novaVenda);
      setCouponData(cData);

      // Trigger automatic thermal print
      imprimirCupom(novaVenda);

      setStep('SUCESSO');
    } catch (err) {
      console.error('Erro ao registrar acesso:', err);
      setErrorMessage('Falha ao registrar acesso. Tente novamente.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      <ThermalReceipt couponData={couponData} />

      <div className="w-full max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden my-4">
        
        {/* PDV Header Banner */}
        <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between border-b border-red-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Utensils className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold uppercase tracking-wide">
                Refeitório 2G2M • Totem PDV
              </h2>
              <p className="text-xs text-red-100 font-medium">
                {alunoLogado ? `Aluno: ${alunoLogado.nome} (${alunoLogado.matricula})` : 'Identificação de Acesso'}
              </p>
            </div>
          </div>

          {step !== 'LOGIN' && step !== 'SUCESSO' && (
            <button
              onClick={() => {
                if (step === 'CONFIRMACAO') setStep('SERVICOS');
                else if (step === 'SERVICOS') resetPdv();
                else resetPdv();
              }}
              className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          )}
        </div>

        {/* Content Body based on Step */}
        <div className="p-6 sm:p-8">

          {/* STEP 1: LOGIN */}
          {step === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="text-center space-y-2">
                <span className="inline-block p-4 bg-red-50 text-red-600 rounded-2xl mb-2">
                  <User className="w-10 h-10" />
                </span>
                <h3 className="text-2xl font-black text-gray-900">
                  Acesso do Aluno
                </h3>
                <p className="text-sm text-gray-500 font-medium">
                  Digite sua Matrícula e Senha numérica para liberação
                </p>
              </div>

              {errorMessage && (
                <div className="p-4 bg-red-50 border-l-4 border-red-600 text-red-800 rounded-r-xl text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-2">
                    Matrícula
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={matriculaInput}
                      onChange={(e) => setMatriculaInput(e.target.value)}
                      placeholder="Ex: 2026001"
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl font-bold text-lg text-gray-900 focus:outline-none focus:border-red-600 focus:bg-white transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-2">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={senhaInput}
                      onChange={(e) => setSenhaInput(e.target.value)}
                      placeholder="••••••"
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl font-bold text-lg text-gray-900 focus:outline-none focus:border-red-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                <span>Entrar no Sistema</span>
                <ChevronRight className="w-6 h-6" />
              </button>
            </form>
          )}

          {/* STEP 2: TROCA SENHA PERGUNTA */}
          {step === 'TROCA_SENHA_PERGUNTA' && (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <KeyRound className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900">
                  Deseja trocar sua senha?
                </h3>
                <p className="text-sm text-gray-600 font-medium">
                  Olá, <strong className="text-gray-900">{alunoLogado?.nome}</strong>. O administrador solicitou que você atualize sua senha de acesso.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button
                  onClick={() => handleTrocaSenhaChoice(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold py-4 rounded-2xl text-base transition-all"
                >
                  Não, Continuar
                </button>
                <button
                  onClick={() => handleTrocaSenhaChoice(true)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-4 rounded-2xl text-base transition-all shadow-md"
                >
                  Sim, Trocar Senha
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: TROCA SENHA FORM */}
          {step === 'TROCA_SENHA_FORM' && (
            <form onSubmit={handleTrocaSenhaSubmit} className="space-y-6">
              <div className="text-center space-y-2">
                <span className="inline-block p-3 bg-red-50 text-red-600 rounded-2xl mb-1">
                  <KeyRound className="w-8 h-8" />
                </span>
                <h3 className="text-2xl font-black text-gray-900">
                  Nova Senha de Acesso
                </h3>
                <p className="text-sm text-gray-500 font-medium">
                  Defina uma nova senha numérica
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border-l-4 border-red-600 text-red-800 rounded-r-xl text-xs font-semibold">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-2">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={novaSenhaInput}
                    onChange={(e) => setNovaSenhaInput(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl font-bold text-lg text-gray-900 focus:outline-none focus:border-red-600"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-2">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={confirmarSenhaInput}
                    onChange={(e) => setConfirmarSenhaInput(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl font-bold text-lg text-gray-900 focus:outline-none focus:border-red-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold text-base py-4 rounded-2xl shadow-lg transition-all"
              >
                Salvar Nova Senha e Continuar
              </button>
            </form>
          )}

          {/* STEP 4: SERVICOS SELECTION */}
          {step === 'SERVICOS' && (
            <div className="space-y-6">
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">
                    Aluno Autenticado
                  </span>
                  <span className="text-lg font-black text-gray-900 block">
                    {alunoLogado?.nome}
                  </span>
                  <span className="text-xs text-gray-600 font-medium">
                    Curso: {alunoLogado?.curso} • Matrícula: {alunoLogado?.matricula}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-500 uppercase block">Plano</span>
                  <span className="inline-block px-3 py-1 bg-red-600 text-white rounded-full text-xs font-extrabold">
                    {planoAluno?.nome || alunoLogado?.plano} ({planoAluno?.percentualDesconto || 0}% Desc.)
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-wide">
                  Selecione o Serviço Desejado
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Clique no botão do refeição desejada para visualizar o cálculo de acesso
                </p>
              </div>

              {servicosList.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl">
                  Nenhum serviço cadastrado no momento. Solocite ao Admin.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {servicosList.map((servico) => {
                    const status = isServicoDisponivel(servico);
                    const percentualDesconto = planoAluno?.percentualDesconto || 0;
                    const precoBase = servico.precoBase;
                    const valorCobrado = precoBase * (1 - percentualDesconto / 100);

                    return (
                      <button
                        key={servico.id}
                        onClick={() => handleSelectServico(servico)}
                        disabled={!status.disponivel}
                        className={`p-5 rounded-2xl border-2 text-left flex flex-col justify-between transition-all duration-200 ${
                          status.disponivel
                            ? 'bg-white border-gray-200 hover:border-red-600 hover:shadow-lg active:scale-95 cursor-pointer'
                            : 'bg-gray-100 border-gray-200 opacity-65 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-4xl">{servico.icone || '🍽️'}</span>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                              status.disponivel
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {status.disponivel ? 'Disponível' : 'Indisponível'}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-lg font-black text-gray-900 uppercase mb-1">
                            {servico.nome}
                          </h4>
                          <div className="flex items-center text-xs text-gray-500 font-medium mb-3">
                            <Clock className="w-3.5 h-3.5 mr-1 text-gray-400" />
                            <span>{servico.horarioInicio} - {servico.horarioFim}</span>
                          </div>
                        </div>

                        {status.disponivel ? (
                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-gray-500 font-semibold">Preço do Aluno:</span>
                            <span className="text-base font-black text-red-600">
                              {percentualDesconto === 100 ? 'GRÁTIS' : `R$ ${valorCobrado.toFixed(2).replace('.', ',')}`}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-red-600 pt-2 border-t border-gray-200">
                            {status.motivo}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: CONFIRMACAO (ACESSAR) */}
          {step === 'CONFIRMACAO' && servicoSelecionado && planoAluno && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <span className="inline-block p-4 bg-red-100 text-red-600 rounded-full mb-1">
                  <Sparkles className="w-8 h-8" />
                </span>
                <h3 className="text-2xl font-black text-gray-900 uppercase">
                  Confirmação de Compra / Liberação
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Revise o valor final e clique no botão <strong className="text-red-600">ACESSAR</strong> para imprimir o cupom
                </p>
              </div>

              {/* Summary Card */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">Serviço Selecionado:</span>
                  <span className="font-extrabold text-gray-900 uppercase flex items-center gap-1.5">
                    <span>{servicoSelecionado.icone}</span>
                    <span>{servicoSelecionado.nome}</span>
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">Preço Base do Serviço:</span>
                  <span className="font-bold text-gray-700">R$ {servicoSelecionado.precoBase.toFixed(2).replace('.', ',')}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">Desconto do Plano ({planoAluno.codigo}):</span>
                  <span className="font-bold text-emerald-600">
                    - {planoAluno.percentualDesconto}% (Submencionado R$ {(servicoSelecionado.precoBase * (planoAluno.percentualDesconto/100)).toFixed(2).replace('.', ',')})
                  </span>
                </div>

                <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-base font-black text-gray-900 uppercase">Valor a Cobrar do Aluno:</span>
                  <span className="text-2xl font-black text-red-600">
                    {planoAluno.percentualDesconto === 100 
                      ? 'R$ 0,00 (ISENTO)' 
                      : `R$ ${(servicoSelecionado.precoBase * (1 - planoAluno.percentualDesconto/100)).toFixed(2).replace('.', ',')}`}
                  </span>
                </div>
              </div>

              {/* Status Badge Line Preview */}
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
                <span className="text-xs font-bold text-amber-800 uppercase block mb-1">
                  Linha no Cupom Térmico:
                </span>
                <span className="text-base font-black text-gray-900 bg-white px-4 py-1.5 rounded-lg border border-gray-300 inline-block font-mono">
                  {planoAluno.percentualDesconto === 100
                    ? 'ACESSO'
                    : `COBRAR R$ ${(servicoSelecionado.precoBase * (1 - planoAluno.percentualDesconto/100)).toFixed(2).replace('.', ',')}`}
                </span>
              </div>

              {/* BIG ACESSAR BUTTON */}
              <button
                onClick={handleConfirmarAcesso}
                className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-3xl py-6 rounded-2xl shadow-2xl hover:shadow-red-200 transition-all duration-200 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wider border-4 border-red-500"
              >
                <span>ACESSAR</span>
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>
          )}

          {/* STEP 6: SUCESSO (Cupom Gerado e Impresso) */}
          {step === 'SUCESSO' && couponData && (
            <div className="text-center space-y-6 py-2">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle className="w-12 h-12" />
              </div>

              <div className="space-y-1">
                <h3 className="text-3xl font-black text-gray-900 uppercase">
                  Acesso Confirmado!
                </h3>
                <p className="text-sm text-gray-600 font-medium">
                  Seu cupom térmico foi enviado para a impressora.
                </p>
              </div>

              {/* Status Highlight */}
              <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-lg space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 block">
                  Status Final do Cupom
                </span>
                <span className="text-2xl font-black tracking-wide block">
                  {couponData.statusLinha}
                </span>
              </div>

              {/* Receipt Visual Preview Box */}
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl p-4 text-left font-mono text-xs max-w-xs mx-auto text-gray-800 space-y-1">
                <div className="text-center font-bold border-b border-gray-300 pb-1 mb-1">
                  *** CUPOM TÉRMICO (5x6cm) ***
                </div>
                <div><strong>Data:</strong> {couponData.dataHoraFormatada}</div>
                <div><strong>Serviço:</strong> {couponData.servicoNome}</div>
                <div><strong>Aluno:</strong> {couponData.alunoNome}</div>
                <div><strong>Curso:</strong> {couponData.alunoCurso}</div>
                <div><strong>Matrícula:</strong> {couponData.alunoMatricula}</div>
                <div className="font-black text-center pt-1 border-t border-gray-300 mt-1 uppercase text-sm text-red-600">
                  {couponData.statusLinha}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                  <Printer className="w-4 h-4 text-emerald-600" />
                  Imprimindo em bobina 5cm x 6cm
                </span>
                <button
                  onClick={resetPdv}
                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-6 py-3 rounded-xl text-sm transition-all shadow"
                >
                  Novo Acesso ({countdown}s)
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
