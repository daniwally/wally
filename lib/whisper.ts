export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const ext =
    mimeType === "audio/ogg" || mimeType === "audio/opus"
      ? "ogg"
      : mimeType === "audio/mpeg"
        ? "mp3"
        : mimeType === "audio/mp4" || mimeType === "audio/x-m4a"
          ? "m4a"
          : mimeType === "audio/wav"
            ? "wav"
            : "ogg";

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), `audio.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "es");
  form.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API: ${res.status} ${err.slice(0, 200)}`);
  }
  const json = (await res.json()) as { text: string };
  return json.text.trim();
}
