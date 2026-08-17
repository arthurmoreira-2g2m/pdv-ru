/**
 * Backend mínimo (Node.js + Express + Nodemailer) para o sistema PDV 2G2M.
 *
 * Por que isto existe: Nodemailer fala SMTP direto, e isso só é possível a
 * partir de um servidor Node.js — o navegador/WebView do app (front-end)
 * nunca tem acesso a socket SMTP bruto, por segurança do próprio navegador.
 * Este backend é a peça que efetivamente manda o e-mail; o app (React)
 * só faz uma chamada HTTP simples para ele.
 *
 * Deploy sugerido: Render.com (plano gratuito), Railway, ou qualquer outro
 * serviço que rode Node.js continuamente. Ver README.md nesta pasta.
 */

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3000;

// -------------------------------------------------------------------
// Configuração do transportador SMTP (variáveis de ambiente)
// -------------------------------------------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true', // true para porta 465, false para 587/25
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Chave simples de proteção (evita que qualquer pessoa na internet use seu
// backend para mandar e-mail em nome do 2G2M). O app envia essa mesma chave
// no header. Defina API_KEY no ambiente do backend e o mesmo valor nas
// Configurações do Admin do app.
function checkApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) return next(); // se não configurado, não exige (modo dev)
  const provided = req.header('x-api-key');
  if (provided !== expected) {
    return res.status(401).json({ sucesso: false, mensagem: 'Chave de API inválida ou ausente.' });
  }
  next();
}

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'pdv-2g2m-email-backend' });
});

/**
 * POST /api/send-email
 * body: { to: string, subject: string, html: string, text?: string }
 */
app.post('/api/send-email', checkApiKey, async (req, res) => {
  const { to, subject, html, text } = req.body || {};

  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Campos obrigatórios ausentes: to, subject e (html ou text).',
    });
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text,
    });

    return res.json({
      sucesso: true,
      mensagem: `E-mail enviado com sucesso para ${to}.`,
      detalhes: { messageId: info.messageId },
    });
  } catch (error) {
    console.error('Erro ao enviar e-mail via Nodemailer:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: `Falha ao enviar e-mail: ${error.message || 'erro desconhecido no envio SMTP.'}`,
    });
  }
});

/**
 * POST /api/fetch-file
 * body: { url: string }
 *
 * Proxy de download server-side, usado pela importação de planilha por
 * link quando o provedor (ex: OneDrive/SharePoint) bloqueia o download
 * direto pelo navegador via CORS. Servidor-a-servidor não tem essa
 * restrição — o app chama este endpoint, que busca o arquivo por trás
 * e devolve o conteúdo em base64.
 */
app.post('/api/fetch-file', checkApiKey, async (req, res) => {
  const { url } = req.body || {};

  if (!url) {
    return res.status(400).json({ sucesso: false, mensagem: 'Campo obrigatório ausente: url.' });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ sucesso: false, mensagem: 'URL inválida — apenas http/https são permitidos.' });
    }

    const upstream = await fetch(url, { redirect: 'follow' });
    if (!upstream.ok) {
      return res.status(502).json({
        sucesso: false,
        mensagem: `O servidor de origem respondeu com erro HTTP ${upstream.status}.`,
      });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await upstream.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return res.json({
      sucesso: true,
      contentType,
      base64,
      tamanhoBytes: arrayBuffer.byteLength,
    });
  } catch (error) {
    console.error('Erro ao buscar arquivo via proxy:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: `Falha ao buscar o arquivo: ${error.message || 'erro desconhecido.'}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`[pdv-2g2m-email-backend] rodando na porta ${PORT}`);
});
