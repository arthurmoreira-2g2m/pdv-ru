import React, { useState, useEffect } from 'react';
import { ViewMode } from './types';
import { initializeDatabaseSeed } from './db/indexedDB';
import { Header } from './components/Header';
import { TelaInicial } from './components/TelaInicial';
import { PdvFlow } from './components/pdv/PdvFlow';
import { AdminDashboard } from './components/admin/AdminDashboard';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('INICIAL');
  const [adminTabTitle, setAdminTabTitle] = useState<string>('');
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await initializeDatabaseSeed();
        setDbReady(true);
      } catch (err) {
        console.error('Erro ao inicializar banco de dados:', err);
        setDbReady(true);
      }
    }
    init();
  }, []);

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-black text-gray-700 uppercase tracking-wider">
            Carregando Sistema 2G2M...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans text-gray-900 antialiased selection:bg-red-500 selection:text-white">
      {/* Top Header Bar */}
      <Header
        currentView={currentView}
        onNavigateHome={() => setCurrentView('INICIAL')}
        adminTabTitle={adminTabTitle}
      />

      {/* Main View Manager */}
      <main className="flex-1">
        {currentView === 'INICIAL' && (
          <TelaInicial
            onStartPdv={() => setCurrentView('PDV')}
            onOpenAdmin={() => setCurrentView('ADMIN')}
          />
        )}

        {currentView === 'PDV' && (
          <PdvFlow
            onReturnHome={() => setCurrentView('INICIAL')}
          />
        )}

        {currentView === 'ADMIN' && (
          <AdminDashboard
            onReturnHome={() => setCurrentView('INICIAL')}
            onActiveTabChange={(title) => setAdminTabTitle(title)}
          />
        )}
      </main>
    </div>
  );
}
