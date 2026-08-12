/**
 * Types for 2G2M Refectory POS & Admin System
 */

export interface Aluno {
  matricula: string;
  nome: string;
  email?: string;
  senha?: string;
  plano: string; // Plano code reference
  curso: string;
  solicitarTrocaSenha?: boolean;
}

export interface Servico {
  id: string;
  nome: string;
  icone: string; // Emoji or Lucide icon name
  horarioInicio: string; // HH:mm
  horarioFim: string; // HH:mm
  precoBase: number; // In BRL
  planosPermitidos: string[]; // List of plan codes or ['TODOS']
  ativo: boolean;
}

export interface PlanoDesconto {
  codigo: string; // e.g. "PLANO_100", "PLANO_70", "INTEGRAL"
  nome: string; // e.g. "Bolsa Integral (100%)"
  percentualDesconto: number; // 0 to 100
}

export interface Venda {
  id: string;
  dataHora: string; // ISO String
  alunoMatricula: string;
  alunoNome: string;
  alunoCurso: string;
  servicoId: string;
  servicoNome: string;
  precoBase: number;
  planoCodigo: string;
  percentualDesconto: number;
  valorCobradoAluno: number; // precoBase * (1 - percentualDesconto/100)
  valorSubsidio: number; // precoBase * (percentualDesconto/100)
}

export interface ConfiguracoesSistema {
  emailjsServiceId: string;
  emailjsTemplateId: string;
  emailjsPublicKey: string;
  emailjsDestinatario: string;
  adminPasswordHash: string;
  exigirTrocaSenhaPadrao: boolean;
}

export type ViewMode = 'INICIAL' | 'PDV' | 'ADMIN';

export type AdminTab = 
  | 'ALUNOS' 
  | 'SERVICOS' 
  | 'PLANOS' 
  | 'VENDAS' 
  | 'FECHAMENTOS' 
  | 'RECUPERACAO' 
  | 'CONFIGURACOES';
