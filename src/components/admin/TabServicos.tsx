import React, { useState, useEffect } from 'react';
import { Servico, PlanoDesconto } from '../../types';
import { getAllServicos, saveServico, deleteServico, getAllPlanos } from '../../db/indexedDB';
import { Utensils, Plus, Trash2, Edit2, Clock, Check, Power } from 'lucide-react';

export const TabServicos: React.FC = () => {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [planos, setPlanos] = useState<PlanoDesconto[]>([]);
  const [editingServico, setEditingServico] = useState<Partial<Servico> | null>(null);

  const EMOJI_OPTIONS = ['🍽️', '🥗', '🍛', '🍲', '🍱', '🥣', '🥪', '🍎', '☕', '🥤', '🥛', '🥐'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sList, pList] = await Promise.all([
        getAllServicos(),
        getAllPlanos(),
      ]);
      setServicos(sList);
      setPlanos(pList);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenAdd = () => {
    setEditingServico({
      id: `serv-${Date.now()}`,
      nome: '',
      icone: '🍽️',
      horarioInicio: '11:00',
      horarioFim: '14:00',
      precoBase: 15.00,
      planosPermitidos: ['TODOS'],
      ativo: true,
    });
  };

  const handleSaveServico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServico?.nome?.trim()) {
      alert('O nome do serviço é obrigatório.');
      return;
    }

    const itemToSave: Servico = {
      id: editingServico.id || `serv-${Date.now()}`,
      nome: editingServico.nome.trim(),
      icone: editingServico.icone || '🍽️',
      horarioInicio: editingServico.horarioInicio || '00:00',
      horarioFim: editingServico.horarioFim || '23:59',
      precoBase: Number(editingServico.precoBase) || 0,
      planosPermitidos: editingServico.planosPermitidos || ['TODOS'],
      ativo: editingServico.ativo !== false,
    };

    await saveServico(itemToSave);
    setEditingServico(null);
    await loadData();
  };

  const handleToggleActive = async (servico: Servico) => {
    await saveServico({ ...servico, ativo: !servico.ativo });
    await loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este serviço?')) {
      await deleteServico(id);
      await loadData();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Utensils className="w-6 h-6 text-red-600" />
            <span>Cadastro de Serviços ({servicos.length})</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Configure as refeições (Almoço, Jantar, etc.), horários de atendimento e preço base
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Serviço</span>
        </button>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {servicos.map((servico) => (
          <div
            key={servico.id}
            className={`bg-white rounded-2xl p-5 border-2 shadow-sm flex flex-col justify-between transition-all ${
              servico.ativo ? 'border-gray-200 hover:border-red-300' : 'border-gray-200 opacity-60 bg-gray-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-4xl">{servico.icone || '🍽️'}</span>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                    servico.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {servico.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <h4 className="text-lg font-black text-gray-900 uppercase">{servico.nome}</h4>

              <div className="flex items-center text-xs text-gray-600 font-semibold mt-2">
                <Clock className="w-4 h-4 mr-1.5 text-red-600" />
                <span>Horário: {servico.horarioInicio} às {servico.horarioFim}</span>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Preço Base:</span>
                <span className="text-xl font-black text-red-600">
                  R$ {servico.precoBase.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => handleToggleActive(servico)}
                className={`p-2 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-colors ${
                  servico.ativo ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{servico.ativo ? 'Desativar' : 'Ativar'}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingServico(servico)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-xl transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(servico.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: Add/Edit Service */}
      {editingServico && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-200">
            <h4 className="text-xl font-black text-gray-900">
              {editingServico.id && servicos.some(s => s.id === editingServico.id) ? 'Editar Serviço' : 'Novo Serviço'}
            </h4>

            <form onSubmit={handleSaveServico} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Nome do Serviço *</label>
                <input
                  type="text"
                  value={editingServico.nome || ''}
                  onChange={(e) => setEditingServico({ ...editingServico, nome: e.target.value })}
                  placeholder="Ex: Almoço, Jantar, Cafe Especial"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Ícone / Emoji</label>
                <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setEditingServico({ ...editingServico, icone: emoji })}
                      className={`text-2xl p-2 rounded-xl transition-transform ${
                        editingServico.icone === emoji ? 'bg-red-600 scale-110 shadow' : 'hover:bg-gray-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Horário Início</label>
                  <input
                    type="time"
                    value={editingServico.horarioInicio || '11:00'}
                    onChange={(e) => setEditingServico({ ...editingServico, horarioInicio: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Horário Fim</label>
                  <input
                    type="time"
                    value={editingServico.horarioFim || '14:00'}
                    onChange={(e) => setEditingServico({ ...editingServico, horarioFim: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Preço Base (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingServico.precoBase !== undefined ? editingServico.precoBase : 15.00}
                  onChange={(e) => setEditingServico({ ...editingServico, precoBase: parseFloat(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-black text-base text-red-600"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingServico(null)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl shadow"
                >
                  Salvar Serviço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
