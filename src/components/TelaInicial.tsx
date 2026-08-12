import React from 'react';
import { Utensils, ShieldAlert, ChevronRight, Sparkles } from 'lucide-react';

interface TelaInicialProps {
  onStartPdv: () => void;
  onOpenAdmin: () => void;
}

export const TelaInicial: React.FC<TelaInicialProps> = ({ onStartPdv, onOpenAdmin }) => {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-red-50 via-white to-orange-50 flex flex-col justify-center items-center px-4 py-8 select-none">
      <div className="max-w-4xl w-full mx-auto text-center space-y-8">
        
        {/* Main Logo & Food Theme Banner */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full bg-red-100 blur-lg opacity-70 animate-pulse"></div>
            <img 
              src="https://2g2m.com.br/imagens/2g2m-logo.png" 
              alt="2G2M Logo" 
              className="relative h-20 sm:h-28 w-auto object-contain drop-shadow-md"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-100 border border-red-200 text-red-800 text-sm font-extrabold tracking-wide">
            <span>🍽️ 🥗 🍛 🍲 🍱</span>
            <span className="text-red-900 font-bold">Autoatendimento Escolar</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight">
            Sistema de Refeitório <span className="text-red-600">2G2M</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto font-medium">
            Selecione uma opção abaixo para iniciar o atendimento no totem ou gerenciar as configurações.
          </p>
        </div>

        {/* Two Big Tablet Touch Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-3xl mx-auto pt-4">
          
          {/* Button 1: INICIAR PDV */}
          <button
            onClick={onStartPdv}
            className="group relative bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-3xl p-8 sm:p-10 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95 flex flex-col items-center text-center justify-between border-4 border-red-500 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform"></div>
            
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/20 flex items-center justify-center mb-6 shadow-inner group-hover:rotate-6 transition-transform">
              <Utensils className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>

            <div>
              <span className="block text-2xl sm:text-3xl font-black uppercase tracking-wide mb-2">
                Iniciar PDV
              </span>
              <p className="text-xs sm:text-sm text-red-100 font-medium max-w-xs">
                Acesso do aluno ao totem de autoatendimento do refeitório
              </p>
            </div>

            <div className="mt-8 inline-flex items-center justify-center gap-2 bg-white text-red-600 font-extrabold px-6 py-3 rounded-xl text-sm sm:text-base shadow group-hover:bg-red-50 transition-colors w-full">
              <span>ACESSAR TOTEM</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Button 2: ACESSAR ADMIN */}
          <button
            onClick={onOpenAdmin}
            className="group relative bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-900 rounded-3xl p-8 sm:p-10 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95 flex flex-col items-center text-center justify-between border-4 border-gray-200 overflow-hidden"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-red-50 flex items-center justify-center mb-6 shadow-inner text-red-600 group-hover:-rotate-6 transition-transform">
              <ShieldAlert className="w-10 h-10 sm:w-12 sm:h-12 text-red-600" />
            </div>

            <div>
              <span className="block text-2xl sm:text-3xl font-black uppercase tracking-wide text-gray-900 mb-2">
                Acessar Admin
              </span>
              <p className="text-xs sm:text-sm text-gray-500 font-medium max-w-xs">
                Painel administrativo, importação de alunos e relatórios
              </p>
            </div>

            <div className="mt-8 inline-flex items-center justify-center gap-2 bg-gray-900 text-white font-extrabold px-6 py-3 rounded-xl text-sm sm:text-base shadow group-hover:bg-gray-800 transition-colors w-full">
              <span>GERENCIAMENTO</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

        </div>

        {/* Footer info */}
        <div className="pt-6 text-xs text-gray-600 font-medium flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-red-500" />
          <span>Sistema PWA/TWA 2G2M • Funcionamento Totalmente Offline</span>
        </div>

      </div>
    </div>
  );
};
