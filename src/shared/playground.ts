import type { DiagnosticContext, DiagnosticReceipt, DiagnosticView, PlaygroundReport } from './playground-diagnostics.js';
/** Local playground contract. No task, income or filesystem capabilities. */
export type PlaygroundTheme = 'light' | 'dark';
export type PlaygroundCommand = 'bootstrap' | 'ready' | 'report' | 'diagnostics' | 'copyDiagnostics';
export interface PlaygroundBridge {
  invoke(command: PlaygroundCommand): Promise<{ theme: PlaygroundTheme; context: DiagnosticContext }>;
  report(value: PlaygroundReport): Promise<DiagnosticReceipt>;
  diagnostics(id?: string): Promise<DiagnosticView>;
  copyDiagnostics(id?: string): Promise<void>;
  onTheme(callback: (theme: PlaygroundTheme) => void): () => void;
}
export const PLAYGROUND_ERRORS = {
  PLAYGROUND_OPEN_FAILED: '游乐场打开失败，请点击摩天轮重试。',
  PLAYGROUND_RENDERER_FAILED: '游乐场意外关闭，请点击摩天轮重新打开。',
} as const;
export function trustedPlaygroundCommand(command: unknown, url: string, expected: string): command is PlaygroundCommand {
  return (['bootstrap', 'ready', 'report', 'diagnostics', 'copyDiagnostics'].includes(String(command))) && url === expected;
}
declare global { interface Window { playground: PlaygroundBridge } }
