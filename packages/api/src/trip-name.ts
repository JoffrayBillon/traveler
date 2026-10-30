export function getTripNameFromArgs(args: readonly string[]): string {
  const nameArgs = args[0] === "--" ? args.slice(1) : args;
  return nameArgs.join(" ").trim();
}
