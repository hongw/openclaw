import path from "node:path";

import type { AudioTranscriptionRequest, AudioTranscriptionResult } from "../../types.js";
import { fetchWithTimeout, normalizeBaseUrl, readErrorResponse } from "../shared.js";

export const DEFAULT_OPENAI_AUDIO_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_AUDIO_MODEL = "gpt-4o-mini-transcribe";

function resolveModel(model?: string): string {
  const trimmed = model?.trim();
  return trimmed || DEFAULT_OPENAI_AUDIO_MODEL;
}

export async function transcribeOpenAiCompatibleAudio(
  params: AudioTranscriptionRequest,
): Promise<AudioTranscriptionResult> {
  const fetchFn = params.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(params.baseUrl, DEFAULT_OPENAI_AUDIO_BASE_URL);
  
  // Handle baseUrl with query params (e.g., Azure OpenAI with ?api-version=...)
  // Insert /audio/transcriptions before the query string, not after
  let url: string;
  const queryIndex = baseUrl.indexOf("?");
  if (queryIndex !== -1) {
    const basePath = baseUrl.slice(0, queryIndex);
    const queryString = baseUrl.slice(queryIndex);
    url = `${basePath}/audio/transcriptions${queryString}`;
  } else {
    url = `${baseUrl}/audio/transcriptions`;
  }

  const model = resolveModel(params.model);
  const form = new FormData();
  const fileName = params.fileName?.trim() || path.basename(params.fileName) || "audio";
  const bytes = new Uint8Array(params.buffer);
  const blob = new Blob([bytes], {
    type: params.mime ?? "application/octet-stream",
  });
  form.append("file", blob, fileName);
  form.append("model", model);
  if (params.language?.trim()) form.append("language", params.language.trim());
  if (params.prompt?.trim()) form.append("prompt", params.prompt.trim());

  const headers = new Headers(params.headers);
  if (!headers.has("authorization")) {
    headers.set("authorization", `Bearer ${params.apiKey}`);
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers,
      body: form,
    },
    params.timeoutMs,
    fetchFn,
  );

  if (!res.ok) {
    const detail = await readErrorResponse(res);
    const suffix = detail ? `: ${detail}` : "";
    throw new Error(`Audio transcription failed (HTTP ${res.status})${suffix}`);
  }

  const payload = (await res.json()) as { text?: string };
  const text = payload.text?.trim();
  if (!text) {
    throw new Error("Audio transcription response missing text");
  }
  return { text, model };
}
