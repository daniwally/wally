const BASE_URL = "https://api.moonshot.ai/v1";

function apiKey(): string {
  const key = process.env.MOONSHOT_API_KEY;
  if (!key) throw new Error("MOONSHOT_API_KEY not set");
  return key;
}

export function hasMoonshot(): boolean {
  return !!process.env.MOONSHOT_API_KEY;
}

// Sube un PDF y obtiene el texto extraído via la API de Moonshot "file-extract"
export async function extractPdfText(buffer: Buffer, filename: string): Promise<string> {
  // Step 1: upload
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
    filename,
  );
  form.append("purpose", "file-extract");

  const uploadRes = await fetch(`${BASE_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Moonshot upload failed: ${uploadRes.status} ${err.slice(0, 200)}`);
  }
  const uploaded = (await uploadRes.json()) as { id: string };

  // Step 2: fetch text content
  const contentRes = await fetch(`${BASE_URL}/files/${uploaded.id}/content`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!contentRes.ok) {
    throw new Error(`Moonshot get content failed: ${contentRes.status}`);
  }

  // La API puede devolver JSON o texto según la versión
  const raw = await contentRes.text();
  try {
    const parsed = JSON.parse(raw);
    if (parsed.content) return String(parsed.content);
    if (parsed.text) return String(parsed.text);
    return raw;
  } catch {
    return raw;
  }
}

// Tool-call estilo OpenAI contra Moonshot chat completions
export async function moonshotToolCall(params: {
  systemPrompt: string;
  userContent: string;
  tool: {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  };
  model?: "moonshot-v1-32k" | "moonshot-v1-128k" | "kimi-k2-0711-preview";
  maxTokens?: number;
}): Promise<Record<string, unknown>> {
  const model = params.model ?? "moonshot-v1-128k";

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userContent },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: params.tool.name,
            description: params.tool.description,
            parameters: params.tool.input_schema,
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: params.tool.name },
      },
      temperature: 0.3,
      max_tokens: params.maxTokens ?? 16000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Moonshot chat failed: ${res.status} ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices: Array<{
      message: {
        tool_calls?: Array<{
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  const toolCalls = data.choices?.[0]?.message?.tool_calls;
  if (!toolCalls || toolCalls.length === 0) {
    throw new Error("Moonshot did not call the tool");
  }
  return JSON.parse(toolCalls[0].function.arguments);
}
