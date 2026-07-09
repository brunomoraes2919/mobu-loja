/**
 * MOBU — backend do "Crie sua Miniatura" (Cloudflare Worker)
 * ---------------------------------------------------------------------
 * Recebe as fotos do cliente + o estilo escolhido, chama o Gemini para
 * gerar a imagem, e devolve só a imagem pronta pro site. A chave da API
 * fica só aqui (nunca no navegador) e nada na resposta menciona o
 * provedor de IA — o campo se chama "previewImage", só isso.
 *
 * COMO PUBLICAR
 * 1) Crie uma conta em https://dash.cloudflare.com (grátis) se ainda não tiver.
 * 2) Instale a CLI:  npm install -g wrangler
 * 3) wrangler login
 * 4) Nesta pasta:    wrangler init mobu-ai-studio --yes
 *    e substitua o arquivo gerado pelo conteúdo deste arquivo.
 * 5) Guarde sua chave em segredo (NUNCA no código):
 *      wrangler secret put GEMINI_API_KEY
 *    (cole a chave que você gerou em https://aistudio.google.com/apikey)
 * 6) wrangler deploy
 * 7) Copie a URL que aparecer (algo como
 *    https://mobu-ai-studio.SEU-USUARIO.workers.dev) e cole em
 *    MINIATURE_API_ENDPOINT no início do app.js do site.
 *
 * CUSTO (referência, confirme em https://ai.google.dev/gemini-api/docs/pricing):
 * o modelo abaixo custa hoje algo entre US$ 0,04 e US$ 0,07 por imagem
 * gerada (1K de resolução) — vale considerar isso na precificação e/ou
 * limitar quantas vezes o cliente pode clicar em "gerar novamente".
 */

// Modelo do Gemini usado para gerar a imagem. A Google troca o modelo
// recomendado com alguma frequência — confira o nome atual em
// https://ai.google.dev/gemini-api/docs/image-generation antes de publicar,
// e ajuste aqui se precisar.
const MODEL_ID = 'gemini-3.1-flash-image';

// -----------------------------------------------------------------------
// PROMPTS POR ESTILO — cole aqui os prompts reais que você vai enviar.
// A chave (funko, pixar, chibi, realista) precisa ser IDÊNTICA ao "id" de
// cada estilo em AI_STYLES no app.js do site.
// -----------------------------------------------------------------------
const STYLE_PROMPTS = {
  funko: `TODO: cole aqui o prompt para o estilo Funko`,
  pixar: `TODO: cole aqui o prompt para o estilo Pixar`,
  chibi: `TODO: cole aqui o prompt para o estilo Chibi`,
  realista: `TODO: cole aqui o prompt para o estilo Hiper-realista`,
};

// Domínio(s) autorizado(s) a chamar este backend. Restrinja em produção —
// deixar "*" é conveniente para testar, mas qualquer site poderia usar sua
// chave e gerar custos na sua conta.
const ALLOWED_ORIGIN = '*'; // troque para 'https://seudominio.com.br' quando publicar

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    const { images, styleId } = body || {};
    if (!Array.isArray(images) || images.length === 0) return json({ error: 'no_images' }, 400);
    if (images.length > 4) return json({ error: 'too_many_images' }, 400);

    const prompt = STYLE_PROMPTS[styleId];
    if (!prompt) return json({ error: 'invalid_style' }, 400);

    if (!env.GEMINI_API_KEY) return json({ error: 'server_not_configured' }, 500);

    // monta as partes da requisição: o prompt de texto + cada foto enviada
    const parts = [{ text: prompt }];
    for (const dataUrl of images) {
      const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(dataUrl);
      if (!match) continue;
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
    if (parts.length === 1) return json({ error: 'no_valid_images' }, 400);

    let apiRes;
    try {
      apiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] }),
        }
      );
    } catch {
      return json({ error: 'upstream_unreachable' }, 502);
    }

    if (!apiRes.ok) {
      // não repassa o corpo do erro do provedor pro cliente — só loga no worker
      console.error('Falha na geração:', apiRes.status, await apiRes.text().catch(() => ''));
      return json({ error: 'generation_failed' }, 502);
    }

    const data = await apiRes.json();
    const candidateParts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = candidateParts.find(p => p.inlineData || p.inline_data);
    const inline = imagePart?.inlineData || imagePart?.inline_data;

    if (!inline) return json({ error: 'no_image_returned' }, 502);

    // resposta genérica — nenhuma referência ao provedor de IA
    return json({
      previewImage: `data:${inline.mimeType || inline.mime_type};base64,${inline.data}`,
    });
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
