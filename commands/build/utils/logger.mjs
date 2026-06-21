import pc from "picocolors";
import { isCi } from "./process.mjs";


export function animateDots(text) {
  let index = 0;
  const pattern = [0, 1, 2, 3, 2, 1];

  const interval = setInterval(() => {
    index = (index + 1) % pattern.length;
    const timeString = new Date().toTimeString().split(' ')[0];
    process.stdout.write(`\r\x1b[K${pc.dim(pc.gray(`(${timeString})`))} ${pc.bold(pc.yellow(text + '.'.repeat(pattern[index])))}`);
  }, 1000 / 6);
  const timeString = new Date().toTimeString().split(' ')[0];
  process.stdout.write(`\r\x1b[K${pc.dim(pc.gray(`(${timeString})`))} ${pc.bold(pc.yellow(text))}`);

  return (finished = true) => {
    clearInterval(interval);
    process.stdout.write('\r\x1b[K');
    if (!finished) {
      const timeString = new Date().toTimeString().split(' ')[0];
      process.stdout.write(`\r\x1b[K${pc.dim(pc.gray(`(${timeString})`))} ${pc.bold(pc.yellow(text) + pc.red(' (INTERRUPTED)'))}\n`);
    }
  };
}

export function formatDuration(ms) {
  const roundedMs = Math.round(ms);
  if (roundedMs < 1000) return `${roundedMs}ms`;
  const hours = Math.floor(roundedMs / 3_600_000);
  const mins = Math.floor((roundedMs % 3_600_000) / 60_000);
  const secs = Math.floor((roundedMs % 60_000) / 1000);

  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return mins > 0 ? `${mins}m ${secs}s` : `${(roundedMs / 1000).toFixed(2)}s`;
}

export function startLog(text, isNoLogs) {
  const startTime = performance.now();
  const stopFn = (isNoLogs && !isCi()) ? animateDots(text) : (() => {
    console.log(pc.bold(pc.yellow(`${text}...`)));
    return () => { };
  })();

  return (finished = true) => {
    stopFn(finished);
    return formatDuration(performance.now() - startTime);
  };
}
