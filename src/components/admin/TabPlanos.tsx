import React, { useState, useEffect } from 'react';
import { PlanoDesconto } from '../../types';
import { getAllPlanos, savePlano, deletePlano } from '../../db/indexedDB';
import { Percent, Plus, Trash2, Edit2, ShieldCheck } from 'lucide-react';

export const TabPlanos: React.FC = () => {
  const [planos, setPlanos] = useState<PlanoDesconto[]>([]);
  const [editingPlano, setEditingPlano] = useState<Partial<PlanoDesconto> | null>(null);

  useEffect(() => {
    loadPlanos();
  }, []);

  const loadPlanos = async () => {
    try {
      const list = await getAllPlanos();
      setPlanos(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenAdd = () => {
    setEditingPlano({
      codigo: '',
      nome: '',
      percentualDesconto: 50,
    });
  };

  const handleSavePlano = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlano?.codigo?.trim() || !editingPlano?.nome?.trim()) {
      alert('Código e Nome do plano são obrigatórios.');
      return;
    }

    const itemToSave: PlanoDesconto = {
      codigo: editingPlano.codigo.trim().toUpperCase(),
      nome: editingPlano.nome.trim(),
      percentualDesconto: Math.min(100, Math.max(0, Number(editingPlano.percentualDesconto) || 0)),
    };

    await savePlano(itemToSave);
    setEditingPlano(null);
    await loadPlanos();
  };

  const handleDelete = async (codigo: string) => {
    if (confirm(`Deseja realmente excluir o plano ${codigo}?`)) {
      await deletePlano(codigo);
      await loadPlanos();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Percent className="w-6 h-6 text-red-600" />
            <span>Planos de Desconto ({planos.length})</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Cadastre os códigos de planos de bolsa e os percentuais de desconto atribuídos aos alunos
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Plano</span>
        </button>
      </div>

      {/* Plans List Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-extrabold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-4">Código do Plano</th>
              <th className="px-5 py-4">Nome / Descrição</th>
              <th className="px-5 py-4">Percentual de Desconto</th>
              <th className="px-5 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
            {planos.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                  Nenhum plano de desconto cadastrado.
                </td>
              </tr>
            ) : (
              planos.map((plano) => (
                <tr key={plano.codigo} className="hover:bg-red-50/20 transition-colors">
                  <td className="px-5 py-4 font-black text-gray-900">
                    <span className="inline-block px-3 py-1 bg-red-50 text-red-700 rounded-lg border border-red-100 font-mono">
                      {plano.codigo}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-bold text-gray-900 text-sm">{plano.nome}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1 font-black text-emerald-700 text-sm bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <Percent className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{plano.percentualDesconto}% DE DESCONTO</span>
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingPlano(plano)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(plano.codigo)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: Add/Edit Plan */}
      {editingPlano && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-200">
            <h4 className="text-xl font-black text-gray-900">
              {planos.some(p => p.codigo === editingPlano.codigo) ? 'Editar Plano' : 'Novo Plano de Desconto'}
            </h4>

            <form onSubmit={handleSavePlano} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Código do Plano *</label>
                <input
                  type="text"
                  value={editingPlano.codigo || ''}
                  onChange={(e) => setEditingPlano({ ...editingPlano, codigo: e.target.value.toUpperCase() })}
                  placeholder="Ex: PLANO_100, BOLSISTA_70"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-sm uppercase"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Nome do Plano *</label>
                <input
                  type="text"
                  value={editingPlano.nome || ''}
                  onChange={(e) => setEditingPlano({ ...editingPlano, nome: e.target.value })}
                  placeholder="Ex: Bolsa Integral 100%"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Percentual de Desconto (%): <strong className="text-red-600">{editingPlano.percentualDesconto}%</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={editingPlano.percentualDesconto || 0}
                  onChange={(e) => setEditingPlano({ ...editingPlano, percentualDesconto: parseInt(e.target.value) })}
                  className="w-full accent-red-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-1">
                  <span>0% (Sem Desconto)</span>
                  <span>50%</span>
                  <span>100% (Isenção Total)</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingPlano(null)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl shadow"
                >
                  Salvar Plano
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
