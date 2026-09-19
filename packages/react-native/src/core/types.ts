export interface PipelineStepDef {
  id: string;
  title: string;
}

export const DEFAULT_PIPELINE_STEPS: PipelineStepDef[] = [
  { id: 'setup', title: 'Setup' },
  { id: 'install', title: 'Install' },
  { id: 'prebuild', title: 'Prebuild' },
  { id: 'build', title: 'Build' },
  { id: 'postbuild', title: 'Postbuild' },
  { id: 'prerelease', title: 'Prerelease' },
  { id: 'release', title: 'Release' },
  { id: 'postrelease', title: 'Postrelease' },
];

export type PipelineEvent =
  | { type: 'bundle_checking' }
  | { type: 'bundle_installing' }
  | { type: 'bundle_ready'; durationMs: number }
  | { type: 'bundle_error'; error: string }
  | { type: 'pipeline_init'; steps: PipelineStepDef[]; title?: string }
  | { type: 'step_start'; stepId: string; timeString?: string }
  | { type: 'step_end'; stepId: string; duration?: number }
  | { type: 'step_fail'; stepId: string; error?: string }
  | {
      type: 'pipeline_finish';
      ok: boolean;
      durationMs: number;
      error?: string;
    };

export interface CleanOptions {
  platform?: string;
  vendor?: boolean;
  outputs?: boolean;
  derivedData?: boolean;
  'derived-data'?: boolean;
  dryRun?: boolean;
  'dry-run'?: boolean;
}

export interface CleanLogEntry {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface TaskResult {
  id: string;
  title: string;
  status: 'done' | 'error';
  message?: string;
  error?: string;
}

export type TaskEvent =
  | { type: 'start'; id: string; title: string }
  | {
      type: 'message';
      id: string;
      message: string;
      payload?: Record<string, string>;
    }
  | { type: 'success'; id: string; message?: string }
  | { type: 'error'; id: string; error: string };

export type InitTaskResult = TaskResult;
