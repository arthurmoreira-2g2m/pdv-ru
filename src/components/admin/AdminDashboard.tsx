import React, { useState, useEffect } from 'react';
import { AdminTab } from '../../types';
import { getConfiguracoes } from '../../db/indexedDB';
import { TabAlunos } from './TabAlunos';
import { TabServicos } from './TabServicos';
import { TabPlanos } from './TabPlanos';
import { TabVendas } from './TabVendas';
import { TabFechamentos } from './TabFechamentos';
import { TabRecuperacaoDescontos } from './TabRecuperacaoDescontos';
import { TabConfiguracoes } from './TabConfiguracoes';
import { 
  Users, 
  Utensils, 
  Percent, 
  Receipt, 
  Mail, 
  FileCheck, 
  Settings, 
  Lock, 
  ShieldCheck, 
  LogOut,
  ChevronRight
} from 'lucide-react';

interface AdminDashboardProps {
  onReturnHome: () => void;
  onActiveTabChange?: (tabTitle: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onReturnHome, onActiveTabChange }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('ALUNOS');

  // Notify parent of active tab title
  useEffect(() => {
    const titleMap: Record<AdminTab, string> = {
      ALUNOS: 'Alunos',
      SERVICOS: 'Serviços',
      PLANOS: 'Planos',
      VENDAS: 'Vendas',
      FECHAMENTOS: 'Fechamentos',
      RECUPERACAO: 'Recuperação',
      CONFIGURACOES: 'Configurações',
    };
    if (onActiveTabChange) {
      onActiveTabChange(titleMap[activeTab]);
    }
  }, [activeTab, onActiveTabChange]);

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    try {
      const config = await getConfiguracoes();
      const adminPass = config.adminPasswordHash || '2g2m@2g2m';

      if (pinInput.trim() === adminPass) {
        setIsAuthenticated(true);
        setPinInput('');
      } else {
        setPinError('Senha incorreta. Verifique suas credenciais e tente novamente.');
      }
    } catch (err) {
      console.error(err);
      setPinError('Erro ao validar acesso admin.');
    }
  };

  // If not authenticated, render PIN entry modal
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-gray-100 flex items-center justify-center p-4 select-none">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-gray-200 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 uppercase">
              Acesso Administrativo
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              Digite a senha do painel para gerenciar o sistema 2G2M
            </p>
          </div>

          {pinError && (
            <div className="p-3 bg-red-50 text-red-800 text-xs font-semibold rounded-xl border border-red-200 text-center">
              {pinError}
            </div>
          )}

          <form onSubmit={handleAuthenticate} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase text-gray-700 tracking-wider mb-2">
                Senha de Administrador
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••••"
                className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-2xl font-bold text-center text-xl text-gray-900 focus:outline-none focus:border-red-600"
                autoFocus
              />
              <span className="text-[10px] text-gray-400 mt-1 block text-center">
                Senha de acesso restrito ao painel de gestão
              </span>
            </div>

            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold py-4 rounded-2xl shadow-lg transition-all text-base uppercase tracking-wide flex items-center justify-center gap-2"
            >
              <span>Entrar no Admin</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={onReturnHome}
              className="text-xs font-bold text-gray-500 hover:text-red-600 underline"
            >
              Voltar para Tela Inicial
            </button>
          </div>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'ALUNOS', label: 'Alunos', icon: Users },
    { id: 'SERVICOS', label: 'Serviços', icon: Utensils },
    { id: 'PLANOS', label: 'Planos', icon: Percent },
    { id: 'VENDAS', label: 'Vendas', icon: Receipt },
    { id: 'FECHAMENTOS', label: 'Fechamentos', icon: Mail },
    { id: 'RECUPERACAO', label: 'Recuperação', icon: FileCheck },
    { id: 'CONFIGURACOES', label: 'Configurações', icon: Settings },
  ] as const;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-100 flex flex-col">
      
      {/* Navigation Sub-Header */}
      <div className="bg-white border-b border-gray-200 sticky top-[80px] z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-2">
            
            <nav className="flex space-x-1 sm:space-x-2 min-w-max">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as AdminTab)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                      isActive
                        ? 'bg-red-600 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <button
              onClick={() => setIsAuthenticated(false)}
              className="hidden md:flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors ml-4 shrink-0"
              title="Bloquear painel"
            >
              <LogOut className="w-4 h-4" />
              <span>Bloquear</span>
            </button>

          </div>
        </div>
      </div>

      {/* Active Tab Component Render */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'ALUNOS' && <TabAlunos />}
        {activeTab === 'SERVICOS' && <TabServicos />}
        {activeTab === 'PLANOS' && <TabPlanos />}
        {activeTab === 'VENDAS' && <TabVendas />}
        {activeTab === 'FECHAMENTOS' && <TabFechamentos />}
        {activeTab === 'RECUPERACAO' && <TabRecuperacaoDescontos />}
        {activeTab === 'CONFIGURACOES' && <TabConfiguracoes />}
      </main>

    </div>
  );
};
