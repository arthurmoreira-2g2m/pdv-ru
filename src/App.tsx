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
    let active = true;

    // Safety fallback: Never keep the app frozen on loading screen for more than 1.5 seconds
    const safetyTimer = setTimeout(() => {
      if (active) {
        console.warn('[2G2M] Initializing DB took >1.5s, forcing UI render.');
        setDbReady(true);
      }
    }, 1500);

    const startApp = async () => {
      try {
        await initializeDatabaseSeed();
      } catch (err) {
        console.error('[2G2M] Erro ao inicializar banco de dados:', err);
      } finally {
        if (active) {
          clearTimeout(safetyTimer);
          setDbReady(true);
        }
      }
    };

    // If running in Cordova/VoltBuilder, wait for deviceready or run immediately
    if ((window as any).cordova || (window as any).Cordova) {
      document.addEventListener('deviceready', startApp, false);
    } else {
      startApp();
    }

    return () => {
      active = false;
      clearTimeout(safetyTimer);
    };
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
