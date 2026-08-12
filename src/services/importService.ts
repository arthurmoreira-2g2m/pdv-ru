import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Aluno, PlanoDesconto } from '../types';
import { getAllPlanos } from '../db/indexedDB';

export interface SheetSummary {
  abaNome: string;
  totalLidos: number;
  alunosImportados: number;
}

export interface ImportResult {
  sucesso: boolean;
  alunosValidos: Aluno[];
  erros: string[];
  alertas: string[];
  totalLidos: number;
  resumoAbas: SheetSummary[];
  planosDesconhecidos: string[];
}

/**
 * Normalizes column header keys
 */
function getColumnValue(row: Record<string, any>, candidateKeys: string[]): string {
  for (const rawKey of Object.keys(row)) {
    const cleanKey = rawKey.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[*]/g, "");
    for (const cand of candidateKeys) {
      if (cleanKey === cand || cleanKey.includes(cand)) {
        const val = row[rawKey];
        if (val !== undefined && val !== null) {
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

/**
 * Extracts percentage discount from sheet name e.g. "Dados BOLSA (100%)" -> 100
 */
function extractDiscountFromSheetName(sheetName: string): number | null {
  const match = sheetName.match(/\((\d+)%\)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Parses rows from a single sheet
 */
export async function processarSheet(
  sheetName: string, 
  jsonRows: Record<string, any>[],
  planosCadastrados: PlanoDesconto[]
): Promise<{ alunos: Aluno[]; erros: string[]; alertas: string[]; planosDesconhecidos: string[]; totalLidos: number }> {
  const alunos: Aluno[] = [];
  const erros: string[] = [];
  const alertas: string[] = [];
  const planosDesconhecidosSet = new Set<string>();
  let totalLidos = 0;

  // Build quick map of registered plan codes
  const planoMap = new Map<string, PlanoDesconto>();
  planosCadastrados.forEach(p => planoMap.set(p.codigo.trim().toUpperCase(), p));

  const percentualAba = extractDiscountFromSheetName(sheetName);

  jsonRows.forEach((row, idx) => {
    // Skip empty row objects
    if (!row || Object.keys(row).length === 0) return;
    totalLidos++;

    // Extract Matrícula*
    const matricula = getColumnValue(row, ['matricula', 'ra', 'id']);
    
    // Extract Nome* and Sobrenome*
    const nomeUnico = getColumnValue(row, ['nome']);
    const sobrenome = getColumnValue(row, ['sobrenome']);
    const nomeCompleto = [nomeUnico, sobrenome].filter(Boolean).join(' ').trim();

    // Extract Email, Senha, Observação (Curso), Tags (Plano)
    const email = getColumnValue(row, ['email']);
    const senha = getColumnValue(row, ['usuario senha', 'senha', 'password']) || '123456';
    const curso = getColumnValue(row, ['observacao', 'curso', 'turma']) || 'Geral';
    const tagsPlano = getColumnValue(row, ['tags', 'plano', 'codigo plano']);

    if (!matricula || !nomeCompleto) {
      erros.push(`Aba "${sheetName}" - Linha ${idx + 2}: Matrícula ou Nome/Sobrenome ausente.`);
      return;
    }

    let codigoPlanoFinal = tagsPlano.toUpperCase();

    // Fallback if Tags is empty: check if there's a plan matching the sheet percentage
    if (!codigoPlanoFinal) {
      if (percentualAba !== null) {
        // Find plan code with matching percentage
        const matchingPlano = planosCadastrados.find(p => p.percentualDesconto === percentualAba);
        codigoPlanoFinal = matchingPlano ? matchingPlano.codigo : `PLANO_${percentualAba}`;
      } else {
        codigoPlanoFinal = 'PLANO_REGULAR';
      }
    }

    // Check if the plan code exists in registered plans
    if (!planoMap.has(codigoPlanoFinal)) {
      planosDesconhecidosSet.add(codigoPlanoFinal);
      alertas.push(`Aba "${sheetName}" - Matrícula ${matricula}: Código de plano "${codigoPlanoFinal}" não encontrado no cadastro de planos.`);
    }

    alunos.push({
      matricula,
      nome: nomeCompleto,
      email,
      senha: String(senha),
      curso: curso || 'Geral',
      plano: codigoPlanoFinal,
      solicitarTrocaSenha: false,
    });
  });

  return {
    alunos,
    erros,
    alertas,
    planosDesconhecidos: Array.from(planosDesconhecidosSet),
    totalLidos,
  };
}

/**
 * Parses a File object (CSV or XLSX) into Aluno list reading ALL sheets
 */
export async function importarPlanilhaArquivo(file: File): Promise<ImportResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const planosCadastrados = await getAllPlanos();

  if (extension === 'xlsx' || extension === 'xls') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const todosAlunos: Aluno[] = [];
      const todosErros: string[] = [];
      const todosAlertas: string[] = [];
      const planosDesconhecidosSet = new Set<string>();
      const resumoAbas: SheetSummary[] = [];
      let grandTotalLidos = 0;

      // Process ALL sheets in the workbook
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
        
        const resSheet = await processarSheet(sheetName, jsonRows, planosCadastrados);
        
        todosAlunos.push(...resSheet.alunos);
        todosErros.push(...resSheet.erros);
        todosAlertas.push(...resSheet.alertas);
        resSheet.planosDesconhecidos.forEach(p => planosDesconhecidosSet.add(p));
        grandTotalLidos += resSheet.totalLidos;

        resumoAbas.push({
          abaNome: sheetName,
          totalLidos: resSheet.totalLidos,
          alunosImportados: resSheet.alunos.length,
        });
      }

      // Deduplicate students by matricula (last sheet/row takes precedence)
      const alunosMap = new Map<string, Aluno>();
      todosAlunos.forEach(a => alunosMap.set(a.matricula, a));
      const alunosUnicos = Array.from(alunosMap.values());

      return {
        sucesso: alunosUnicos.length > 0,
        alunosValidos: alunosUnicos,
        erros: todosErros,
        alertas: todosAlertas,
        totalLidos: grandTotalLidos,
        resumoAbas,
        planosDesconhecidos: Array.from(planosDesconhecidosSet),
      };
    } catch (err: any) {
      return {
        sucesso: false,
        alunosValidos: [],
        erros: [`Erro ao ler arquivo Excel: ${err?.message || 'Arquivo corrompido'}`],
        alertas: [],
        totalLidos: 0,
        resumoAbas: [],
        planosDesconhecidos: [],
      };
    }
  } else if (extension === 'csv') {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const resSheet = await processarSheet('CSV principal', results.data as Record<string, any>[], planosCadastrados);
          resolve({
            sucesso: resSheet.alunos.length > 0,
            alunosValidos: resSheet.alunos,
            erros: resSheet.erros,
            alertas: resSheet.alertas,
            totalLidos: resSheet.totalLidos,
            resumoAbas: [{ abaNome: 'CSV principal', totalLidos: resSheet.totalLidos, alunosImportados: resSheet.alunos.length }],
            planosDesconhecidos: resSheet.planosDesconhecidos,
          });
        },
        error: (err) => {
          resolve({
            sucesso: false,
            alunosValidos: [],
            erros: [`Erro no CSV: ${err.message}`],
            alertas: [],
            totalLidos: 0,
            resumoAbas: [],
            planosDesconhecidos: [],
          });
        },
      });
    });
  } else {
    return {
      sucesso: false,
      alunosValidos: [],
      erros: ['Formato de arquivo não suportado. Por favor, envie um arquivo .xlsx ou .csv'],
      alertas: [],
      totalLidos: 0,
      resumoAbas: [],
      planosDesconhecidos: [],
    };
  }
}

/**
 * Fetches an online spreadsheet URL (CSV or direct downloadable XLSX link) and imports
 */
export async function importarPlanilhaUrl(url: string): Promise<ImportResult> {
  const planosCadastrados = await getAllPlanos();
  try {
    let fetchUrl = url.trim();
    if (fetchUrl.includes('docs.google.com/spreadsheets') && !fetchUrl.includes('export?format=csv')) {
      if (fetchUrl.includes('/edit')) {
        fetchUrl = fetchUrl.replace(/\/edit.*$/, '/export?format=csv');
      } else if (!fetchUrl.endsWith('/export?format=csv')) {
        fetchUrl = fetchUrl + '/export?format=csv';
      }
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Servidor respondeu com HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('spreadsheet') || contentType.includes('excel') || fetchUrl.includes('.xlsx')) {
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const todosAlunos: Aluno[] = [];
      const todosErros: string[] = [];
      const todosAlertas: string[] = [];
      const planosDesconhecidosSet = new Set<string>();
      const resumoAbas: SheetSummary[] = [];
      let grandTotalLidos = 0;

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
        const resSheet = await processarSheet(sheetName, jsonRows, planosCadastrados);
        todosAlunos.push(...resSheet.alunos);
        todosErros.push(...resSheet.erros);
        todosAlertas.push(...resSheet.alertas);
        resSheet.planosDesconhecidos.forEach(p => planosDesconhecidosSet.add(p));
        grandTotalLidos += resSheet.totalLidos;

        resumoAbas.push({
          abaNome: sheetName,
          totalLidos: resSheet.totalLidos,
          alunosImportados: resSheet.alunos.length,
        });
      }

      const alunosMap = new Map<string, Aluno>();
      todosAlunos.forEach(a => alunosMap.set(a.matricula, a));
      const alunosUnicos = Array.from(alunosMap.values());

      return {
        sucesso: alunosUnicos.length > 0,
        alunosValidos: alunosUnicos,
        erros: todosErros,
        alertas: todosAlertas,
        totalLidos: grandTotalLidos,
        resumoAbas,
        planosDesconhecidos: Array.from(planosDesconhecidosSet),
      };
    } else {
      // Treat as CSV
      const csvText = await response.text();
      return new Promise((resolve) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const resSheet = await processarSheet('Link Online', results.data as Record<string, any>[], planosCadastrados);
            resolve({
              sucesso: resSheet.alunos.length > 0,
              alunosValidos: resSheet.alunos,
              erros: resSheet.erros,
              alertas: resSheet.alertas,
              totalLidos: resSheet.totalLidos,
              resumoAbas: [{ abaNome: 'Link Online', totalLidos: resSheet.totalLidos, alunosImportados: resSheet.alunos.length }],
              planosDesconhecidos: resSheet.planosDesconhecidos,
            });
          },
          error: (err) => {
            resolve({
              sucesso: false,
              alunosValidos: [],
              erros: [`Erro ao interpretar CSV: ${err.message}`],
              alertas: [],
              totalLidos: 0,
              resumoAbas: [],
              planosDesconhecidos: [],
            });
          },
        });
      });
    }
  } catch (err: any) {
    return {
      sucesso: false,
      alunosValidos: [],
      erros: [`Não foi possível carregar a planilha online: ${err?.message || 'Erro de conexão'}`],
      alertas: [],
      totalLidos: 0,
      resumoAbas: [],
      planosDesconhecidos: [],
    };
  }
}

