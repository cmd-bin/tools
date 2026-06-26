export const getRuntime = (): "Deno" | "Bun" | "Node" => {
  const global: any = globalThis as any;
  return global["Deno"]?.args ? "Deno" : global["Bun"]?.argv ? "Bun" : "Node";
};

export const getRuntimeTimeArgs = (): string[] => {
  const global: any = globalThis as any;
  return (
    (global["Deno"]?.args && [
      global["Deno"].execPath(),
      global["Deno"].mainModule,
      ...global["Deno"]?.args,
    ]) ??
    global["Bun"]?.argv ??
    global["process"]?.argv ??
    []
  );
};
