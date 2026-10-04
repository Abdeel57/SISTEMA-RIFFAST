// Formato NEUTRAL de mensajes: es el que se guarda en la BD y no depende del
// proveedor de IA. Cada traductor lo convierte a su API y de regreso.
//
//   { role: 'user', content, images?: [{ mimeType, data(base64) }] }
//   { role: 'assistant', content, toolCalls?: [{ id, name, args }], raw?: { proveedor, ... } }
//   { role: 'tool', toolCallId, name, content: '<JSON en texto>' }
//
// `raw` guarda lo que un proveedor necesita de vuelta (bloques de Anthropic,
// `thoughtSignature` de Gemini, `reasoning_details` de OpenRouter). Si se cambia
// de proveedor, `raw` se ignora y el historial sigue sirviendo.

export interface ImagePart {
  mimeType: string;
  data: string; // base64 sin el prefijo data:
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  // Texto crudo de los argumentos cuando llegaron como JSON roto. El agente le
  // regresa un error a la IA en vez de ejecutar la herramienta.
  invalidArgs?: string;
}

export interface RawPayload {
  proveedor: string;
  [key: string]: unknown;
}

export interface UserMessage {
  role: 'user';
  content: string;
  images?: ImagePart[];
}

export interface AssistantMessage {
  role: 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  raw?: RawPayload;
}

export interface ToolMessage {
  role: 'tool';
  toolCallId: string;
  name: string;
  content: string; // JSON en texto
}

export type NeutralMessage = UserMessage | AssistantMessage | ToolMessage;

// JSON Schema neutral (subconjunto que entienden los tres formatos).
export interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  [key: string]: unknown;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: JsonSchema; // siempre { type: 'object', properties, required? }
}

// Prompt de sistema: texto plano o dividido en una parte fija (cacheable) y otra
// que cambia en cada mensaje.
export type SystemPrompt = string | { fijo: string; variable: string };

export interface ChatInput {
  system: SystemPrompt;
  messages: NeutralMessage[];
  tools: ToolDef[];
}

export interface Usage {
  entrada: number;
  salida: number;
}

// Respuesta neutral de cualquier proveedor.
export interface ChatResult {
  texto: string;
  llamadas: ToolCall[];
  fin: string; // razón de término tal como la da el proveedor (o 'vacio'/'bloqueado')
  uso: Usage;
  mensaje: AssistantMessage; // listo para guardarse en el historial
}

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'openrouter'
  | 'groq'
  | 'deepseek'
  | 'xai'
  | 'mistral'
  | 'cerebras'
  | 'compatible';

export type WireFormat = 'openai' | 'anthropic' | 'gemini';

export interface AiConfig {
  provider: ProviderId;
  format: WireFormat;
  apiKey: string;
  model: string;
  baseUrl: string;
  vision: boolean;
  maxTokens: number;
  timeoutMs: number;
  // Nombre que se manda a OpenRouter en X-Title.
  appName: string;
}

export interface HttpRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface Translator {
  build(input: ChatInput, cfg: AiConfig): HttpRequest;
  parse(json: unknown, cfg: AiConfig): ChatResult;
  // Error "reintentable" que llega con status 4xx (p. ej. tool_use_failed de Groq).
  retryableBody?(status: number, body: unknown): boolean;
}
