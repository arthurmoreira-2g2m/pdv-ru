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
 * Normaliza links de compartilhamento de provedores comuns (Google Sheets,
 * OneDrive/SharePoint) para uma URL de download direto sempre que possível.
 */
function normalizarUrlPlanilha(urlOriginal: string): string {
  let url = urlOriginal.trim();

  // Google Sheets: .../edit... -> .../export?format=xlsx
  if (url.includes('docs.google.com/spreadsheets')) {
    if (url.includes('/edit')) {
      return url.replace(/\/edit.*$/, '/export?format=xlsx');
    }
    if (!url.includes('/export')) {
      return url.replace(/\/?$/, '/export?format=xlsx');
    }
    return url;
  }

  // OneDrive pessoal (onedrive.live.com/... ou 1drv.ms/...): força download=1
  if (url.includes('onedrive.live.com') || url.includes('1drv.ms')) {
    if (!url.includes('download=1')) {
      return url + (url.includes('?') ? '&' : '?') + 'download=1';
    }
    return url;
  }

  // SharePoint / OneDrive for Business (.../:x:/... ou ?web=1 no final)
  if (url.includes('sharepoint.com') || url.includes('-my.sharepoint.com')) {
    return url.replace(/(\?|&)web=1/i, '$1download=1').replace(/\/?$/, url.includes('?') ? '' : '?download=1');
  }

  return url;
}

function pareceExcel(contentType: string, url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return (
    contentType.includes('spreadsheet') ||
    contentType.includes('excel') ||
    contentType.includes('octet-stream') ||
    lowerUrl.endsWith('.xlsx') ||
    lowerUrl.endsWith('.xls') ||
    lowerUrl.includes('format=xlsx')
  );
}

async function processarBufferPlanilha(
  arrayBuffer: ArrayBuffer,
  planosCadastrados: PlanoDesconto[]
): Promise<ImportResult> {
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
    resSheet.planosDesconhecidos.forEach((p) => planosDesconhecidosSet.add(p));
    grandTotalLidos += resSheet.totalLidos;

    resumoAbas.push({
      abaNome: sheetName,
      totalLidos: resSheet.totalLidos,
      alunosImportados: resSheet.alunos.length,
    });
  }

  const alunosMap = new Map<string, Aluno>();
  todosAlunos.forEach((a) => alunosMap.set(a.matricula, a));
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
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Busca o arquivo através do backend Node.js (proxy server-side). Usado
 * como fallback quando o download direto pelo navegador falha por CORS
 * (comum em links de OneDrive/SharePoint, que não liberam acesso de
 * outros domínios).
 */
async function buscarViaBackendProxy(
  url: string,
  backendUrl: string,
  backendApiKey?: string
): Promise<{ arrayBuffer: ArrayBuffer; contentType: string } | null> {
  const response = await fetch(`${backendUrl.replace(/\/$/, '')}/api/fetch-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(backendApiKey ? { 'x-api-key': backendApiKey } : {}),
    },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();
  if (!response.ok || !data.sucesso) {
    throw new Error(data.mensagem || `Backend respondeu com HTTP ${response.status}`);
  }

  return { arrayBuffer: base64ToArrayBuffer(data.base64), contentType: data.contentType || '' };
}

/**
 * Fetches an online spreadsheet URL (CSV, .xlsx do Google Sheets, OneDrive,
 * SharePoint, ou qualquer link de download direto) e importa.
 *
 * Tenta primeiro o download direto pelo navegador (mais rápido, funciona
 * para provedores que liberam CORS, como o export do Google Sheets). Se
 * isso falhar (comum em OneDrive/SharePoint, que bloqueiam acesso de
 * outros domínios), tenta de novo através do backend Node.js configurado
 * em Configurações, que faz esse download por fora do navegador.
 */
export async function importarPlanilhaUrl(
  urlOriginal: string,
  backendUrl?: string,
  backendApiKey?: string
): Promise<ImportResult> {
  const planosCadastrados = await getAllPlanos();
  const fetchUrl = normalizarUrlPlanilha(urlOriginal);

  // --- Tentativa 1: download direto pelo navegador ---
  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Servidor respondeu com HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (pareceExcel(contentType, fetchUrl)) {
      const arrayBuffer = await response.arrayBuffer();
      return await processarBufferPlanilha(arrayBuffer, planosCadastrados);
    } else {
      const csvText = await response.text();
      return await new Promise((resolve) => {
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
          error: (err: any) => {
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
  } catch (directError: any) {
    // --- Tentativa 2: proxy via backend (contorna bloqueio de CORS) ---
    if (!backendUrl) {
      return {
        sucesso: false,
        alunosValidos: [],
        erros: [
          `Não foi possível baixar a planilha diretamente pelo navegador (${directError?.message || 'erro de conexão'}). ` +
            `Isso costuma acontecer com links do OneDrive/SharePoint, que bloqueiam acesso externo. ` +
            `Configure a URL do backend em Configurações para permitir o download por trás do servidor.`,
        ],
        alertas: [],
        totalLidos: 0,
        resumoAbas: [],
        planosDesconhecidos: [],
      };
    }

    try {
      const proxied = await buscarViaBackendProxy(fetchUrl, backendUrl, backendApiKey);
      if (!proxied) throw new Error('Backend não retornou conteúdo.');

      if (pareceExcel(proxied.contentType, fetchUrl)) {
        return await processarBufferPlanilha(proxied.arrayBuffer, planosCadastrados);
      } else {
        const csvText = new TextDecoder('utf-8').decode(proxied.arrayBuffer);
        return await new Promise((resolve) => {
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
              const resSheet = await processarSheet('Link Online (via backend)', results.data as Record<string, any>[], planosCadastrados);
              resolve({
                sucesso: resSheet.alunos.length > 0,
                alunosValidos: resSheet.alunos,
                erros: resSheet.erros,
                alertas: resSheet.alertas,
                totalLidos: resSheet.totalLidos,
                resumoAbas: [{ abaNome: 'Link Online (via backend)', totalLidos: resSheet.totalLidos, alunosImportados: resSheet.alunos.length }],
                planosDesconhecidos: resSheet.planosDesconhecidos,
              });
            },
            error: (err: any) => {
              resolve({
                sucesso: false,
                alunosValidos: [],
                erros: [`Erro ao interpretar CSV (via backend): ${err.message}`],
                alertas: [],
                totalLidos: 0,
                resumoAbas: [],
                planosDesconhecidos: [],
              });
            },
          });
        });
      }
    } catch (proxyError: any) {
      return {
        sucesso: false,
        alunosValidos: [],
        erros: [
          `Falha no download direto (${directError?.message || 'erro de conexão'}) e também via backend (${proxyError?.message || 'erro desconhecido'}).`,
        ],
        alertas: [],
        totalLidos: 0,
        resumoAbas: [],
        planosDesconhecidos: [],
      };
    }
  }
}

