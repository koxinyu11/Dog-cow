/** Bounded, data-free diagnostic wire format shared by renderer and main. */
export const DIAGNOSTIC_STAGES = ['create', 'initialize', 'load', 'ready', 'show', 'preload', 'page', 'renderer', 'unresponsive', 'theme', 'bootstrap', 'render', 'event', 'timer', 'promise', 'uncaught', 'rejection', 'ipc', 'startup', 'clipboard', 'persistence'] as const;
export type DiagnosticStage = typeof DIAGNOSTIC_STAGES[number];
export interface ErrorDetail { name: string; message: string; code?: string; stack?: string }
export interface PlaygroundReport {
  correlationId: string;
  runId: string;
  gameId?: string;
  stage: DiagnosticStage;
  errors: ErrorDetail[];
  componentStack?: string;
  source?: { file: string; line?: number; column?: number };
}
export interface DiagnosticContext { sessionId: string; version: string; buildId: string }
export interface PlaygroundDiagnostic extends PlaygroundReport, DiagnosticContext {
  time: string; errorCode: string; platform: string; arch: string;
}
export interface DiagnosticReceipt { correlationId: string; persisted: boolean; warning?: string; storageError?: ErrorDetail[] }
export interface DiagnosticView { entries: PlaygroundDiagnostic[]; warning?: string; storageError?: ErrorDetail[] }
export const validDiagnosticId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
export function diagnosticText(value: string, limit = 500): string {
  return value.slice(0, limit * 2)
    .replace(/(?:\/Users\/|\/home\/)[^/\s]+/g, '/home/[user]')
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, 'C:\\Users\\[user]')
    .replace(/\b(?:https?|file):\/\/[^\s)]+/g, url => url.replace(/\/\/[^/@\s]+:[^/@\s]+@/, '//[redacted]@').replace(/[?#].*$/, ''))
    .replace(/((?:token|password|secret|authorization|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .slice(0, limit);
}
function field(value: unknown, key: string): unknown {
  try { return value && (typeof value === 'object' || typeof value === 'function') ? Reflect.get(value, key) : undefined; }
  catch { return undefined; }
}
export function errorDetails(value: unknown): ErrorDetail[] {
  const result: ErrorDetail[] = [];
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 5 && value !== undefined; depth++) {
    if (seen.has(value)) break;
    seen.add(value);
    const message = field(value, 'message');
    const name = field(value, 'name');
    const code = field(value, 'code');
    const stack = field(value, 'stack');
    result.push({
      name: typeof name === 'string' ? diagnosticText(name, 80) : 'ThrownValue',
      message: diagnosticText(typeof message === 'string' ? message : typeof value === 'string' ? value : value === null || ['number', 'boolean', 'bigint'].includes(typeof value) ? String(value) : '非标准异常对象'),
      ...(typeof code === 'string' || typeof code === 'number' ? { code: diagnosticText(String(code), 80) } : {}),
      ...(typeof stack === 'string' ? { stack: diagnosticText(stack, 2400) } : {}),
    });
    value = field(value, 'cause');
  }
  return result.length ? result : [{ name: 'UnknownError', message: '异常原因缺失' }];
}
/** Reconstruct known fields; never persist arbitrary renderer objects or paths. */
export function parseDiagnosticReport(value: unknown): PlaygroundReport | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as Record<string, unknown>;
  if (!validDiagnosticId(v.correlationId) || !validDiagnosticId(v.runId) || !DIAGNOSTIC_STAGES.includes(v.stage as DiagnosticStage) || !Array.isArray(v.errors) || v.errors.length < 1 || v.errors.length > 5) return;
  if (v.gameId !== undefined && (typeof v.gameId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(v.gameId))) return;
  const errors: ErrorDetail[] = [];
  for (const raw of v.errors) {
    if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || typeof raw.message !== 'string') return;
    errors.push({ name: diagnosticText(raw.name, 80), message: diagnosticText(raw.message),
      ...(typeof raw.code === 'string' ? { code: diagnosticText(raw.code, 80) } : {}),
      ...(typeof raw.stack === 'string' ? { stack: diagnosticText(raw.stack, 2400) } : {}) });
  }
  const source = v.source as Record<string, unknown> | undefined;
  return { correlationId: v.correlationId, runId: v.runId, stage: v.stage as DiagnosticStage, errors,
    ...(typeof v.gameId === 'string' ? { gameId: v.gameId } : {}),
    ...(typeof v.componentStack === 'string' ? { componentStack: diagnosticText(v.componentStack, 2000) } : {}),
    ...(source && typeof source.file === 'string' ? { source: { file: diagnosticText(source.file, 300),
      ...(Number.isSafeInteger(source.line) && Number(source.line) >= 0 ? { line: Number(source.line) } : {}),
      ...(Number.isSafeInteger(source.column) && Number(source.column) >= 0 ? { column: Number(source.column) } : {}) } } : {}) };
}
