import React, { useState, useEffect } from 'react';
import { ConfiguracoesSistema } from '../../types';
import { getConfiguracoes, saveConfiguracoes, initializeDatabaseSeed } from '../../db/indexedDB';
import { 
  Settings, 
  Mail, 
  KeyRound, 
  Database, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const TabConfiguracoes: React.FC = () => {
  const [config, setConfig] = useState<ConfiguracoesSistema>({
    backendEmailUrl: '',
    backendEmailApiKey: '',
    emailDestinatario: 'financeiro@2g2m.com.br',
    adminPasswordHash: '2g2m@2g2m',
    exigirTrocaSenhaPadrao: false,
  });

  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [passError, setPassError] = useState('');
  const [seedStatus, setSeedStatus] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await getConfiguracoes();
      setConfig(cfg);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setSavedSuccess(false);

    let finalPass = config.adminPasswordHash;

    if (newAdminPass.trim()) {
      if (newAdminPass !== confirmAdminPass) {
        setPassError('A nova senha de admin e a confirmação não coincidem.');
        return;
      }
      finalPass = newAdminPass.trim();
    }

    const newCfg: ConfiguracoesSistema = {
      ...config,
      adminPasswordHash: finalPass,
    };

    await saveConfiguracoes(newCfg);
    setConfig(newCfg);
    setNewAdminPass('');
    setConfirmAdminPass('');
    setSavedSuccess(true);

    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReloadDemoSeed = async () => {
    if (confirm('Deseja recarregar os dados de demonstração (serviços padrão, planos e alunos demo)?')) {
      await initializeDatabaseSeed();
      setSeedStatus('Dados de teste recarregados com sucesso!');
      setTimeout(() => setSeedStatus(''), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-red-600" />
          <span>Configurações do Sistema</span>
        </h3>
        <p className="text-xs text-gray-500 font-medium mt-0.5">
          Ajuste as chaves de integração do EmailJS, senhas administrativas e parâmetros gerais
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Configurações salvas com sucesso!</span>
        </div>
      )}

      {passError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span>{passError}</span>
        </div>
      )}

      <form onSubmit={handleSaveAll} className="space-y-6">
        
        {/* BACKEND EMAIL (NODEMAILER) SETTINGS */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-gray-900 font-black text-base border-b border-gray-100 pb-3">
            <Mail className="w-5 h-5 text-red-600" />
            <span>Envio de E-mail (Backend Nodemailer)</span>
          </div>

          <p className="text-xs text-gray-500">
            Informe o endereço do backend próprio (Node.js + Nodemailer) responsável por enviar os e-mails de fechamento/recuperação, e a chave de API configurada nele.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
            <div>
              <label className="block text-gray-700 uppercase mb-1">URL do Backend</label>
              <input
                type="text"
                value={config.backendEmailUrl}
                onChange={(e) => setConfig({ ...config, backendEmailUrl: e.target.value })}
                placeholder="Ex: https://pdv-2g2m-email.onrender.com"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs focus:outline-none focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-gray-700 uppercase mb-1">Chave de API</label>
              <input
                type="text"
                value={config.backendEmailApiKey}
                onChange={(e) => setConfig({ ...config, backendEmailApiKey: e.target.value })}
                placeholder="Mesma chave definida em API_KEY no backend"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs focus:outline-none focus:border-red-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 uppercase mb-1">E-mail Destinatário dos Fechamentos</label>
              <input
                type="email"
                value={config.emailDestinatario}
                onChange={(e) => setConfig({ ...config, emailDestinatario: e.target.value })}
                placeholder="Ex: financeiro@2g2m.com.br"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-red-600"
              />
            </div>
          </div>
        </div>

        {/* ADMIN PASSWORD */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-gray-900 font-black text-base border-b border-gray-100 pb-3">
            <KeyRound className="w-5 h-5 text-red-600" />
            <span>Alterar Senha do Administrador</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
            <div>
              <label className="block text-gray-700 uppercase mb-1">Nova Senha Admin</label>
              <input
                type="password"
                value={newAdminPass}
                onChange={(e) => setNewAdminPass(e.target.value)}
                placeholder="Digite para alterar a senha atual"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-gray-700 uppercase mb-1">Confirmar Nova Senha</label>
              <input
                type="password"
                value={confirmAdminPass}
                onChange={(e) => setConfirmAdminPass(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-red-600"
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-sm py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
        >
          <Save className="w-5 h-5" />
          <span>Salvar Todas as Configurações</span>
        </button>

      </form>

      {/* SAMPLE SEED UTILITY */}
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-3">
        <div className="flex items-center space-x-2 text-gray-900 font-extrabold text-sm">
          <Database className="w-5 h-5 text-red-600" />
          <span>Banco de Dados Local (IndexedDB)</span>
        </div>
        <p className="text-xs text-gray-600 font-medium">
          Caso queira repovoar o banco local com os serviços e planos padrões do sistema 2G2M, clique no botão abaixo:
        </p>

        {seedStatus && (
          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
            {seedStatus}
          </div>
        )}

        <button
          onClick={handleReloadDemoSeed}
          className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-red-600" />
          <span>Recarregar Dados de Teste Padrão</span>
        </button>
      </div>

    </div>
  );
};
