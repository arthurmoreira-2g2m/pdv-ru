import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Aluno, Servico, PlanoDesconto, Venda, ConfiguracoesSistema } from '../types';

interface Schema2G2M extends DBSchema {
  alunos: {
    key: string; // matricula
    value: Aluno;
    indexes: { 'by-plano': string; 'by-curso': string };
  };
  servicos: {
    key: string; // id
    value: Servico;
  };
  planos: {
    key: string; // codigo
    value: PlanoDesconto;
  };
  vendas: {
    key: string; // id
    value: Venda;
    indexes: { 'by-dataHora': string; 'by-aluno': string; 'by-servico': string };
  };
  configuracoes: {
    key: string; // key name
    value: { key: string; value: any };
  };
}

const DB_NAME = 'db_2g2m_pdv';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<Schema2G2M>> | null = null;

export function getDB(): Promise<IDBPDatabase<Schema2G2M>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema2G2M>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Alunos Store
        if (!db.objectStoreNames.contains('alunos')) {
          const alunosStore = db.createObjectStore('alunos', { keyPath: 'matricula' });
          alunosStore.createIndex('by-plano', 'plano');
          alunosStore.createIndex('by-curso', 'curso');
        }

        // Servicos Store
        if (!db.objectStoreNames.contains('servicos')) {
          db.createObjectStore('servicos', { keyPath: 'id' });
        }

        // Planos Store
        if (!db.objectStoreNames.contains('planos')) {
          db.createObjectStore('planos', { keyPath: 'codigo' });
        }

        // Vendas Store
        if (!db.objectStoreNames.contains('vendas')) {
          const vendasStore = db.createObjectStore('vendas', { keyPath: 'id' });
          vendasStore.createIndex('by-dataHora', 'dataHora');
          vendasStore.createIndex('by-aluno', 'alunoMatricula');
          vendasStore.createIndex('by-servico', 'servicoId');
        }

        // Configuracoes Store
        if (!db.objectStoreNames.contains('configuracoes')) {
          db.createObjectStore('configuracoes', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Seeds initial demo data if database is empty
 */
export async function initializeDatabaseSeed(): Promise<void> {
  const db = await getDB();

  // Seed Planos
  const existingPlanos = await db.getAll('planos');
  if (existingPlanos.length === 0) {
    const defaultPlanos: PlanoDesconto[] = [
      { codigo: '5648175.19', nome: 'Bolsa Integral (100%)', percentualDesconto: 100 },
      { codigo: '5648177.13', nome: 'Bolsa Parcial (70%)', percentualDesconto: 70 },
      { codigo: 'PLANO_100', nome: 'Bolsa Integral (100%)', percentualDesconto: 100 },
      { codigo: 'PLANO_70', nome: 'Bolsa Parcial (70%)', percentualDesconto: 70 },
      { codigo: 'PLANO_50', nome: 'Bolsa Parcial (50%)', percentualDesconto: 50 },
      { codigo: 'PLANO_30', nome: 'Bolsa Parcial (30%)', percentualDesconto: 30 },
      { codigo: 'PLANO_REGULAR', nome: 'Sem Desconto (0%)', percentualDesconto: 0 },
    ];
    const tx = db.transaction('planos', 'readwrite');
    for (const p of defaultPlanos) {
      await tx.store.put(p);
    }
    await tx.done;
  }

  // Seed Servicos
  const existingServicos = await db.getAll('servicos');
  if (existingServicos.length === 0) {
    const defaultServicos: Servico[] = [
      {
        id: 'serv-almoco',
        nome: 'Almoço',
        icone: '🍽️',
        horarioInicio: '11:00',
        horarioFim: '14:30',
        precoBase: 18.00,
        planosPermitidos: ['TODOS'],
        ativo: true,
      },
      {
        id: 'serv-jantar',
        nome: 'Jantar',
        icone: '🍛',
        horarioInicio: '18:00',
        horarioFim: '21:00',
        precoBase: 18.00,
        planosPermitidos: ['TODOS'],
        ativo: true,
      },
      {
        id: 'serv-cafe',
        nome: 'Café da Manhã',
        icone: '☕',
        horarioInicio: '06:30',
        horarioFim: '09:30',
        precoBase: 8.00,
        planosPermitidos: ['TODOS'],
        ativo: true,
      },
      {
        id: 'serv-lanche',
        nome: 'Lanche',
        icone: '🍎',
        horarioInicio: '15:00',
        horarioFim: '16:30',
        precoBase: 6.00,
        planosPermitidos: ['TODOS'],
        ativo: true,
      },
    ];
    const tx = db.transaction('servicos', 'readwrite');
    for (const s of defaultServicos) {
      await tx.store.put(s);
    }
    await tx.done;
  }

  // Seed Demo Alunos
  const existingAlunos = await db.getAll('alunos');
  if (existingAlunos.length === 0) {
    const defaultAlunos: Aluno[] = [
      {
        matricula: '2026001',
        nome: 'Lucas Silva',
        senha: '123456',
        plano: 'PLANO_100',
        curso: 'Engenharia de Software',
        solicitarTrocaSenha: true,
      },
      {
        matricula: '2026002',
        nome: 'Mariana Santos',
        senha: '123456',
        plano: 'PLANO_70',
        curso: 'Medicina',
        solicitarTrocaSenha: false,
      },
      {
        matricula: '2026003',
        nome: 'Gabriel Oliveira',
        senha: '123456',
        plano: 'PLANO_50',
        curso: 'Administração',
        solicitarTrocaSenha: false,
      },
      {
        matricula: '2026004',
        nome: 'Beatriz Costa',
        senha: '123456',
        plano: 'PLANO_REGULAR',
        curso: 'Direito',
        solicitarTrocaSenha: false,
      },
    ];
    const tx = db.transaction('alunos', 'readwrite');
    for (const a of defaultAlunos) {
      await tx.store.put(a);
    }
    await tx.done;
  }

  // Seed Default Configs
  const configService = await getConfiguracoes();
  if (!configService.adminPasswordHash) {
    await saveConfiguracoes({
      backendEmailUrl: '',
      backendEmailApiKey: '',
      emailDestinatario: 'financeiro@2g2m.com.br',
      adminPasswordHash: '2g2m@2g2m', // default admin pin
      exigirTrocaSenhaPadrao: false,
    });
  }
}

/* ================= CRUD ALUNOS ================= */
export async function getAllAlunos(): Promise<Aluno[]> {
  const db = await getDB();
  return db.getAll('alunos');
}

export async function getAlunoByMatricula(matricula: string): Promise<Aluno | undefined> {
  const db = await getDB();
  return db.get('alunos', matricula.trim());
}

export async function saveAluno(aluno: Aluno): Promise<void> {
  const db = await getDB();
  await db.put('alunos', aluno);
}

export async function saveAlunosBulk(alunos: Aluno[]): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('alunos', 'readwrite');
  let count = 0;
  for (const a of alunos) {
    if (a.matricula) {
      await tx.store.put(a);
      count++;
    }
  }
  await tx.done;
  return count;
}

export async function deleteAluno(matricula: string): Promise<void> {
  const db = await getDB();
  await db.delete('alunos', matricula);
}

export async function clearAllAlunos(): Promise<void> {
  const db = await getDB();
  await db.clear('alunos');
}

/* ================= CRUD SERVICOS ================= */
export async function getAllServicos(): Promise<Servico[]> {
  const db = await getDB();
  return db.getAll('servicos');
}

export async function saveServico(servico: Servico): Promise<void> {
  const db = await getDB();
  await db.put('servicos', servico);
}

export async function deleteServico(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('servicos', id);
}

/* ================= CRUD PLANOS ================= */
export async function getAllPlanos(): Promise<PlanoDesconto[]> {
  const db = await getDB();
  const list = await db.getAll('planos');
  
  const defaultPlanos: PlanoDesconto[] = [
    { codigo: '5648175.19', nome: 'Bolsa Integral (100%)', percentualDesconto: 100 },
    { codigo: '5648177.13', nome: 'Bolsa Parcial (70%)', percentualDesconto: 70 },
    { codigo: 'PLANO_100', nome: 'Bolsa Integral (100%)', percentualDesconto: 100 },
    { codigo: 'PLANO_70', nome: 'Bolsa Parcial (70%)', percentualDesconto: 70 },
    { codigo: 'PLANO_50', nome: 'Bolsa Parcial (50%)', percentualDesconto: 50 },
    { codigo: 'PLANO_30', nome: 'Bolsa Parcial (30%)', percentualDesconto: 30 },
    { codigo: 'PLANO_REGULAR', nome: 'Sem Desconto (0%)', percentualDesconto: 0 },
  ];

  for (const defP of defaultPlanos) {
    if (!list.some(p => p.codigo && p.codigo.trim().toUpperCase() === defP.codigo.toUpperCase())) {
      await db.put('planos', defP);
      list.push(defP);
    }
  }

  return list;
}

export async function getPlanoByCodigo(codigo: string): Promise<PlanoDesconto | undefined> {
  if (!codigo) return { codigo: 'PLANO_REGULAR', nome: 'Sem Desconto (0%)', percentualDesconto: 0 };
  const cleanCode = codigo.trim().toUpperCase();
  const db = await getDB();
  let plano = await db.get('planos', cleanCode);
  if (plano) return plano;

  if (cleanCode === '5648175.19' || cleanCode.includes('100')) {
    return { codigo: cleanCode, nome: 'Bolsa Integral (100%)', percentualDesconto: 100 };
  }
  if (cleanCode === '5648177.13' || cleanCode.includes('70')) {
    return { codigo: cleanCode, nome: 'Bolsa Parcial (70%)', percentualDesconto: 70 };
  }
  if (cleanCode.includes('50')) {
    return { codigo: cleanCode, nome: 'Bolsa Parcial (50%)', percentualDesconto: 50 };
  }
  if (cleanCode.includes('30')) {
    return { codigo: cleanCode, nome: 'Bolsa Parcial (30%)', percentualDesconto: 30 };
  }

  return { codigo: cleanCode, nome: `Plano ${cleanCode}`, percentualDesconto: 0 };
}

export async function savePlano(plano: PlanoDesconto): Promise<void> {
  const db = await getDB();
  await db.put('planos', plano);
}

export async function deletePlano(codigo: string): Promise<void> {
  const db = await getDB();
  await db.delete('planos', codigo);
}

/* ================= CRUD VENDAS ================= */
export async function getAllVendas(): Promise<Venda[]> {
  const db = await getDB();
  const vendas = await db.getAll('vendas');
  return vendas.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
}

export async function registrarVenda(venda: Venda): Promise<void> {
  const db = await getDB();
  await db.put('vendas', venda);
}

export async function clearAllVendas(): Promise<void> {
  const db = await getDB();
  await db.clear('vendas');
}

/* ================= CONFIGURACOES ================= */
export async function getConfiguracoes(): Promise<ConfiguracoesSistema> {
  const db = await getDB();
  const item = await db.get('configuracoes', 'main_config');
  if (item && item.value) {
    if (item.value.adminPasswordHash === '123456') {
      item.value.adminPasswordHash = '2g2m@2g2m';
      await saveConfiguracoes(item.value);
    }
    return item.value;
  }
  return {
    backendEmailUrl: '',
    backendEmailApiKey: '',
    emailDestinatario: 'financeiro@2g2m.com.br',
    adminPasswordHash: '2g2m@2g2m',
    exigirTrocaSenhaPadrao: false,
  };
}

export async function saveConfiguracoes(config: ConfiguracoesSistema): Promise<void> {
  const db = await getDB();
  await db.put('configuracoes', { key: 'main_config', value: config });
}
