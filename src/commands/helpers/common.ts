export function buildChangeContext(change: string) {
  return {
    proposal: `openspec/changes/${change}/proposal.md`,
    tasks: `openspec/changes/${change}/tasks.md`,
    acceptance: `openspec/changes/${change}/acceptance.md`,
    notes: `openspec/changes/${change}/notes.md`,
  };
}
