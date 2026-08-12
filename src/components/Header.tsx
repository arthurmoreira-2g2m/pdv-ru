import React, { useState, useEffect } from 'react';
import { ViewMode } from '../types';
import { Shield, Home, Clock, Utensils } from 'lucide-react';

interface HeaderProps {
  currentView: ViewMode;
  onNavigateHome: () => void;
  adminTabTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigateHome, adminTabTitle }) => {
  const [timeString, setTimeString] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo and Brand */}
        <div 
          onClick={onNavigateHome}
          className="flex items-center space-x-4 cursor-pointer group select-none"
        >
          <img 
            src="https://2g2m.com.br/imagens/2g2m-logo.png" 
            alt="Logo 2G2M" 
            className="h-12 w-auto object-contain transition-transform group-hover:scale-105"
            onError={(e) => {
              // Fallback element if image fails or offline
              const target = e.target as HTMLElement;
              target.style.display = 'none';
            }}
          />
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tight text-red-600 flex items-center gap-1.5">
              2G2M <Utensils className="w-5 h-5 text-red-600 inline" />
            </span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Sistema de Refeitório & Autoatendimento
            </span>
          </div>
        </div>

        {/* Dynamic Badge or Breadcrumb */}
        {currentView !== 'INICIAL' && (
          <div className="hidden sm:flex items-center space-x-2 bg-red-50 border border-red-100 rounded-full px-4 py-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
            <span className="text-xs font-bold text-red-700 tracking-wide uppercase">
              {currentView === 'PDV' ? 'Totem PDV Ativo' : `Painel Admin ${adminTabTitle ? `• ${adminTabTitle}` : ''}`}
            </span>
          </div>
        )}

        {/* Time and Navigation */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center text-sm font-medium text-gray-600 bg-gray-50 px-3.5 py-1.5 rounded-lg border border-gray-200">
            <Clock className="w-4 h-4 mr-2 text-red-600" />
            <span>{timeString}</span>
          </div>

          {currentView !== 'INICIAL' && (
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow active:scale-95"
              title="Voltar para Início"
            >
              <Home className="w-4 h-4 text-red-600" />
              <span>Sair / Início</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
