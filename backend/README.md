# Backend de E-mail — PDV 2G2M (Nodemailer)

Backend mínimo em Node.js/Express, responsável por enviar (via SMTP,
usando Nodemailer) os e-mails de fechamento diário/mensal e de
recuperação de descontos. O app (React, dentro do APK) chama este
backend por HTTP — ele não fala SMTP diretamente porque isso não é
possível a partir de um navegador/WebView.

## Rodando localmente (teste)

```
cd backend
npm install
cp .env.example .env
# edite o .env com suas credenciais SMTP reais
npm start
```

O servidor sobe em `http://localhost:3000`. Teste com:

```
curl -X POST http://localhost:3000/api/send-email \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE_AQUI" \
  -d '{"to":"seu-email@exemplo.com","subject":"Teste","html":"<p>Funcionou!</p>"}'
```

## Deploy em produção — Render.com (recomendado, gratuito)

1. Crie uma conta em render.com.
2. "New +" → "Web Service" → conecte este repositório GitHub.
3. Root Directory: `backend`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Em "Environment", adicione as variáveis (ver `.env.example` abaixo).
7. Deploy. Você vai receber uma URL tipo `https://pdv-2g2m-email.onrender.com`.
8. Cole essa URL no Admin do app → Configurações → "URL do Backend".

**Atenção (plano gratuito do Render):** o servidor "dorme" depois de um
tempo sem uso e demora ~30-50 segundos para "acordar" na primeira
chamada seguinte. Para um sistema de fechamento diário/mensal (uso
esporádico, não em tempo real), isso normalmente não é um problema —
só espere a resposta demorar um pouco na primeira tentativa do dia.

## Variáveis de ambiente necessárias

Veja `.env.example` nesta pasta. Resumo:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
  `SMTP_FROM` — credenciais do provedor de e-mail (Gmail, um provedor
  transacional como Brevo/SendGrid/Mailgun, ou o e-mail corporativo
  da 2G2M, dependendo do que a instituição já usa).
- `API_KEY` — uma senha simples que você escolhe, para impedir que
  qualquer pessoa na internet use seu backend para mandar e-mail. O
  mesmo valor precisa ser colado no Admin do app.

### Se for usar Gmail

Gmail exige uma "Senha de App" (não a senha normal da conta) — precisa
ativar verificação em duas etapas na conta Google e gerar a senha de
app em myaccount.google.com/apppasswords. Configuração:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seuemail@gmail.com
SMTP_PASS=<senha de app de 16 caracteres>
```
