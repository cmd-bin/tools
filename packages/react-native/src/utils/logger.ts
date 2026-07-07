import pc from "picocolors";

export function formatDuration(ms: number) {
  const roundedMs = Math.round(ms);
  if (roundedMs < 1000) return `${roundedMs}ms`;
  const hours = Math.floor(roundedMs / 3_600_000);
  const mins = Math.floor((roundedMs % 3_600_000) / 60_000);
  const secs = Math.floor((roundedMs % 60_000) / 1000);

  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return mins > 0 ? `${mins}m ${secs}s` : `${(roundedMs / 1000).toFixed(2)}s`;
}

export const exampleLog = (text: string) => {
  return (
    pc.dim(pc.white(`  $ npx `)) + pc.magenta(text.replace("$", "").trim())
  );
};

export const descriptionLog = (text: string) => {
  return pc.cyan(text);
};

export const titleLog = (text: string) => {
  return pc.bold(text);
};
