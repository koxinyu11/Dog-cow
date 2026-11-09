import { errorDetails, type DiagnosticStage, type PlaygroundReport, type DiagnosticReceipt } from '../../../shared/playground-diagnostics';
export class GameLoadError extends Error {
  constructor(cause: unknown) { super('游戏资源加载失败', { cause }); this.name = 'GameLoadError'; }
}
export interface GameDiagnostics {
  readonly gameId: string;
  readonly runId: string;
  capture(error: unknown, stage?: DiagnosticStage, componentStack?: string): string;
  guard<A extends unknown[], R>(stage: DiagnosticStage, callback: (...args: A) => R): (...args: A) => R;
}
const windowRun = crypto.randomUUID();
const seen = new WeakMap<object, { id: string; runId: string }>();
const recent: PlaygroundReport[] = [];
let installed = false;
function announce(report: PlaygroundReport, receipt?: DiagnosticReceipt) {
  window.dispatchEvent(new CustomEvent('playground:diagnostic', { detail: { report, receipt } }));
}
export function captureFailure(error: unknown, stage: DiagnosticStage, context?: { gameId: string; runId: string }, componentStack?: string, source?: PlaygroundReport['source']): string {
  if (error && typeof error === 'object') {
    const previous = seen.get(error);
    if (previous && (!context || context.runId === previous.runId)) return previous.id;
  }
  const report: PlaygroundReport = { correlationId: crypto.randomUUID(), runId: context?.runId ?? windowRun,
    ...(context ? { gameId: context.gameId } : {}), stage, errors: errorDetails(error), componentStack, source };
  if (error && typeof error === 'object') seen.set(error, { id: report.correlationId, runId: report.runId });
  recent.push(report); if (recent.length > 50) recent.shift();
  announce(report);
  if (window.playground?.report) {
    void window.playground.report(report).then(receipt => announce(report, receipt)).catch(() => announce(report, { correlationId: report.correlationId, persisted: false, warning: '诊断暂时无法发送，当前页面仍保留记录。' }));
  } else {
    // Test fixture / failed preload: preserve bounded local evidence without a service.
    console.error(JSON.stringify({ ...report, errorCode: 'GAME_FAILED', message: report.errors.at(-1)?.message }));
    announce(report, { correlationId: report.correlationId, persisted: false, warning: '本机诊断服务不可用，记录暂存在当前页面。' });
  }
  return report.correlationId;
}
export function localDiagnostics() { return structuredClone(recent); }
export function createGameDiagnostics(gameId: string, runId = crypto.randomUUID()): GameDiagnostics {
  return {
    gameId, runId,
    capture(error, stage = error instanceof GameLoadError ? 'load' : 'render', componentStack) { return captureFailure(error, stage, { gameId, runId }, componentStack); },
    guard(stage, callback) {
      return (...args) => {
        try {
          const result = callback(...args);
          if (result instanceof Promise) return result.catch(error => { captureFailure(error, stage, { gameId, runId }); throw error; }) as ReturnType<typeof callback>;
          return result;
        } catch (error) { captureFailure(error, stage, { gameId, runId }); throw error; }
      };
    },
  };
}
export function installPlaygroundDiagnostics() {
  if (installed) return;
  installed = true;
  // Unbound async failures are intentionally not attributed to the next active game.
  window.addEventListener('error', event => {
    const error = event.error ?? new Error(event.message || '资源加载失败');
    captureFailure(error, 'uncaught', undefined, undefined, { file: event.filename || 'unknown', line: event.lineno, column: event.colno });
  });
  window.addEventListener('unhandledrejection', event => captureFailure(event.reason, 'rejection'));
}
