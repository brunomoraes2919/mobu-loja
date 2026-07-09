// supabase/functions/generate-miniature/index.ts
//
// Backend do "Crie sua Miniatura" — versão Supabase Edge Function (Deno).
// Mesma lógica do cloudflare-worker.js, adaptada para o runtime da Supabase.
//
// Recebe { images: string[], styleId: string }, chama o Gemini com o prompt
// do estilo escolhido, e devolve { previewImage: "data:image/...;base64,..." }.
// A chave fica em Deno.env (nunca no navegador, nunca no código-fonte).

// Modelo do Gemini usado para gerar a imagem. Confirme o nome atual em
// https://ai.google.dev/gemini-api/docs/image-generation antes de publicar
// de vez — a Google costuma trocar o modelo recomendado com frequência.
const MODEL_ID = "gemini-3.1-flash-image";

// -----------------------------------------------------------------------
// PROMPTS POR ESTILO — cole aqui os prompts reais. A chave (funko, pixar,
// chibi, realista) precisa ser IDÊNTICA ao "id" de cada estilo em
// AI_STYLES, dentro do index.html do site.
// -----------------------------------------------------------------------
const STYLE_PROMPTS: Record<string, string> = {
  funko: `TODO: cole aqui o prompt para o estilo Funko`,
  pixar: `TODO: cole aqui o prompt para o estilo Pixar`,
  chibi: `TODO: cole aqui o prompt para o estilo Chibi`,
  realista: `TODO: cole aqui o prompt para o estilo Hiper-realista`,
};

// Enquanto está testando, "*" é o mais prático (permite chamar de
// localhost, do GitHub Pages, de onde for). Quando o site tiver domínio
// definitivo, troque para esse domínio exato — isso impede que outros
// sites usem sua chave do Gemini às suas custas.
const ALLOWED_ORIGIN = "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  };
}
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { images?: string[]; styleId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { images, styleId } = body;
  if (!Array.isArray(images) || images.length === 0) return json({ error: "no_images" }, 400);
  if (images.length > 4) return json({ error: "too_many_images" }, 400);

  const prompt = styleId ? STYLE_PROMPTS[styleId] : undefined;
  if (!prompt) return json({ error: "invalid_style" }, 400);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "server_not_configured" }, 500);

  // monta as partes da requisição: o prompt de texto + cada foto enviada
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  for (const dataUrl of images) {
    const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(dataUrl);
    if (!match) continue;
    parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
  }
  if (parts.length === 1) return json({ error: "no_valid_images" }, 400);

  let apiRes: Response;
  try {
    apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      },
    );
  } catch {
    return json({ error: "upstream_unreachable" }, 502);
  }

  if (!apiRes.ok) {
    // não repassa o corpo do erro do provedor pro cliente — só loga no painel da função
    console.error("Falha na geração:", apiRes.status, await apiRes.text().catch(() => ""));
    return json({ error: "generation_failed" }, 502);
  }

  const data = await apiRes.json();
  const candidateParts = data?.candidates?.[0]?.content?.parts ?? [];
  // deno-lint-ignore no-explicit-any
  const imagePart = candidateParts.find((p: any) => p.inlineData || p.inline_data);
  const inline = imagePart?.inlineData ?? imagePart?.inline_data;

  if (!inline) return json({ error: "no_image_returned" }, 502);

  // resposta genérica — nenhuma referência ao provedor de IA
  return json({
    previewImage: `data:${inline.mimeType ?? inline.mime_type};base64,${inline.data}`,
  });
});
