# MOBU — Loja Virtual (protótipo front-end)

Site institucional + e-commerce da MOBU, com um configurador 3D ao vivo como
diferencial. 100% front-end (HTML/CSS/JS puro + Three.js) — sem build step,
sem dependências para instalar.

## Como abrir

Dê duplo clique em `index.html`, ou sirva a pasta com qualquer servidor
estático (recomendado antes de publicar de verdade):

```bash
npx serve .
# ou
python3 -m http.server 8080
```

## Estrutura

```
index.html       → marcação + todo o CSS (design system em :root)
app.js           → catálogo de produtos, carrinho, favoritos, roteamento, checkout
configurator.js  → motor do configurador 3D (Three.js) — cor + texto ao vivo
logos.js         → logotipo MOBU embutido em base64 (não depende de arquivo externo)
```

## O que já funciona de verdade

- Catálogo com filtro por categoria, busca e ordenação
- Configurador 3D: arraste para girar, troque a cor do filamento e digite um
  nome — tudo atualiza ao vivo, inclusive no card do produto
- Carrinho (drawer + página) e favoritos, persistidos no `localStorage`
- Checkout em 3 passos ("Camada 01/02/03") com Pix, cartão e boleto
- Calculadora de frete por CEP (simulada)
- Cupom `MOBU10` funcional (front-end apenas)
- Totalmente responsivo (testado em mobile)

## O que é só protótipo (precisa de backend para ir ao ar)

- **Nenhum pagamento real é processado.** Pix, cartão e boleto são apenas a
  interface — falta integrar um gateway (Mercado Pago, Pagar.me, Stripe etc.)
- **Nenhum e-mail é enviado.** O pedido "confirmado" não sai da tela.
- **Estoque e pedidos não são salvos em servidor** — o carrinho vive só no
  navegador de quem está comprando.
- **Frete por CEP é simulado** — precisa integrar Correios/Melhor Envio.
- O catálogo (10 produtos) é um ponto de partida — edite o array `PRODUCTS`
  no topo de `app.js` para colocar os produtos reais, com fotos.

## Para colocar no ar de verdade, o caminho mais rápido é:

1. **Backend simples**: Node/Express, ou até uma plataforma pronta (Nuvemshop,
   Loja Integrada) se quiser evitar manter servidor.
2. **Gateway de pagamento**: Pix + cartão via Mercado Pago ou Pagar.me — ambos
   têm SDK em JS e taxas competitivas para PME.
3. **Fotos reais dos produtos** no lugar dos ícones geométricos (que foram uma
   escolha deliberada até vocês terem fotos — combina com a identidade
   "minimalismo tecnológico" da marca, mas fotos reais convertem mais).
4. **Hospedagem**: Vercel, Netlify ou GitHub Pages resolvem o front-end de
   graça; o backend pode ir num VPS simples ou Railway/Render.

## ✨ Crie sua Miniatura (geração de imagem por IA)

Nova aba no site: o cliente envia fotos de uma pessoa ou pet, escolhe um
estilo (Funko, Pixar, Chibi, Hiper-realista) e recebe uma prévia gerada por
IA — que vira a base da miniatura 3D, com preço por tamanho (P/M/G).

**Isso precisa de um backend.** A chave de API de geração de imagem nunca
pode ficar no navegador (qualquer pessoa poderia roubá-la pelo "Inspecionar
elemento" e gerar custos na sua conta). Por isso o fluxo é:

```
Navegador do cliente  →  seu backend (guarda a chave)  →  provedor de IA
                      ←  devolve só a imagem pronta     ←
```

- **`cloudflare-worker.js`** — o backend de referência, pronto pra publicar.
  Segue as instruções no topo do próprio arquivo (resumo: `wrangler login`,
  `wrangler secret put GEMINI_API_KEY`, `wrangler deploy`).
- Depois de publicar, cole a URL gerada em `MINIATURE_API_ENDPOINT`, no topo
  do bloco `AI STUDIO` dentro do `index.html`.
- **Enquanto não configurar**, o site roda em **modo de demonstração**: ele
  mostra a própria foto enviada (com um selo "PRÉVIA DE TESTE") no lugar da
  imagem gerada, só para você validar o fluxo completo — upload, escolha de
  estilo, tamanho, carrinho — sem gastar nada.
- **Os prompts de cada estilo** (Funko, Pixar, Chibi, Hiper-realista) ficam
  no objeto `STYLE_PROMPTS`, dentro do `cloudflare-worker.js` — cole ali os
  prompts que você for definir para cada estilo. As chaves (`funko`, `pixar`,
  `chibi`, `realista`) precisam bater com o `id` de cada estilo em
  `AI_STYLES`, no `index.html`.
- **Nenhuma referência ao provedor de IA aparece pro cliente** — nem no
  texto do site, nem na resposta do backend (o campo se chama
  `previewImage`, sem nenhuma menção a marca).
- **Custo por geração**: na ordem de US$ 0,04–0,07 por imagem no modelo
  sugerido (confirme o valor atual antes de publicar) — vale considerar
  isso na precificação e/ou limitar quantas vezes o cliente pode clicar em
  "gerar novamente".
- **Consentimento**: o cliente precisa marcar uma confirmação de que tem
  autorização para usar as fotos enviadas antes de continuar — já vem
  pronto no fluxo.

## 🚀 Guia passo a passo: integrar de verdade e testar (Gemini + Supabase + GitHub)

### Parte 1 — Chave do Gemini

1. Acesse **https://aistudio.google.com/apikey**
2. Crie (ou selecione) um projeto do Google Cloud e gere uma API key
3. Guarde essa chave — ela só vai entrar na Supabase, nunca no site

### Parte 2 — Backend na Supabase

```bash
# 1) instale a CLI (uma vez só, globalmente)
npm install -g supabase

# 2) faça login (abre o navegador)
supabase login

# 3) dentro da pasta do projeto (a mesma pasta com o index.html)
supabase init

# 4) a função generate-miniature já vem pronta neste projeto em
#    supabase/functions/generate-miniature/index.ts — não precisa criar,
#    só conferir se está ali. Se quiser criar do zero: 
#    supabase functions new generate-miniature

# 5) crie um projeto em https://database.new (se ainda não tiver um) e
#    pegue o "Project Reference ID" em Settings > General

# 6) linke este projeto local ao projeto remoto da Supabase
supabase link --project-ref SEU_PROJECT_REF

# 7) salve a chave do Gemini como segredo (nunca vai pro código/GitHub)
supabase secrets set GEMINI_API_KEY=cole_sua_chave_aqui

# 8) publique a função
supabase functions deploy generate-miniature
```

Ao final, a Supabase mostra a URL da função, algo como:
`https://SEU_PROJECT_REF.supabase.co/functions/v1/generate-miniature`

**Teste rápido pelo terminal** (confirma que a chave e a função estão certas,
mesmo antes de colar os prompts de verdade):

```bash
curl -X POST https://SEU_PROJECT_REF.supabase.co/functions/v1/generate-miniature \
  -H "Content-Type: application/json" \
  -d '{"images":["data:image/png;base64,COLE_UMA_IMAGEM_PEQUENA_EM_BASE64"],"styleId":"funko"}'
```
Se voltar `{"previewImage": "data:image/..."}`, está funcionando — mesmo que
a imagem gerada ainda não faça sentido, porque o prompt do estilo `funko`
ainda está com o texto `TODO` de exemplo.

### Parte 3 — Conectar o site ao backend

Abra `index.html`, procure por `const MINIATURE_API_ENDPOINT` (dentro do
bloco `AI STUDIO`) e cole a URL da função:

```js
const MINIATURE_API_ENDPOINT = 'https://SEU_PROJECT_REF.supabase.co/functions/v1/generate-miniature';
```

### Parte 4 — Publicar no GitHub para testar

```bash
cd pasta-do-projeto
git init
git add .
git commit -m "MOBU: site + configurador 3D + miniatura por IA"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/mobu-loja.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: Deploy from a branch → Branch:
`main` / `(root)` → Save**. Em ~1 minuto o site fica no ar em
`https://SEU-USUARIO.github.io/mobu-loja/`.

### Parte 5 — Testar de ponta a ponta

Abra a URL do GitHub Pages, vá em **"Crie sua Miniatura"**, envie uma foto
de verdade e escolha um estilo. Se tudo estiver certo, a chamada vai
navegador → Supabase → Gemini → volta a imagem real (o selo "PRÉVIA DE
TESTE" não aparece mais, porque isso só mostra quando `MINIATURE_API_ENDPOINT`
está vazio).

### ⚠️ Antes de divulgar pro público de verdade

- `verify_jwt = false` (em `supabase/config.toml`) deixa a função **aberta
  para qualquer um** chamar — ótimo para testar, arriscado para produção
  (alguém poderia gastar seus créditos do Gemini). Quando o site tiver
  domínio definitivo: troque `ALLOWED_ORIGIN` no `index.ts` para esse
  domínio exato, e considere `verify_jwt = true` com autenticação Supabase.
- Confirme os limites e o custo atual em
  https://ai.google.dev/gemini-api/docs/pricing antes de divulgar — o
  modelo sugerido custa hoje entre US$ 0,04 e US$ 0,07 por imagem gerada.

## Migrando para um servidor e nuvem mais profissional (mais adiante)

Quando o teste validar e for hora de profissionalizar:

- **Hospedagem do site**: GitHub Pages funciona bem para teste, mas não tem
  domínio próprio nem HTTPS customizado facilmente. Trocar para **Vercel**
  ou **Netlify** apontando pro mesmo repositório do GitHub é o caminho mais
  direto — o deploy automático já vem pronto (todo `git push` atualiza o
  site sozinho), e dá pra usar um domínio como `mobu3d.com.br`.
- **Backend**: a Edge Function da Supabase já roda em produção de verdade
  (não é só para teste) e escala sozinha — pode continuar nela por bastante
  tempo. Se um dia precisar de algo que a Supabase não cobre bem, dá pra
  migrar só essa função para um servidor Node/Express dedicado (Railway,
  Render, VPS) sem precisar mexer no resto do site.
- **Com o mesmo projeto Supabase**, quando fizer sentido, dá pra também
  guardar pedidos de verdade num banco Postgres, subir as fotos dos
  clientes num Storage bucket (em vez de só passar em base64), e até
  autenticar clientes — tudo isso já vem incluso no mesmo projeto que você
  acabou de criar.

## Editando o catálogo

Cada produto em `PRODUCTS` (em `app.js`) aceita:

```js
{
  id: 'slug-unico', name: 'Nome do produto', cat: 'personalizado',
  price: 59.90,              // ou null para "Sob consulta"
  badge: 'Mais vendido',     // ou null
  configurable: true,        // mostra o configurador 3D + seletor de cor
  hasText: true,             // mostra campo de texto personalizado
  shape: 'plate',            // ícone: plate | figure | vase | grid | gem | gear | lamp
  rating: 4.9, reviews: 128,
  desc: '...',
  specs: { 'Material': 'PLA premium', ... },
}
```
