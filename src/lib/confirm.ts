import { prompt } from './documents';

export async function confirmDestructiveAction(message: string, confirmed = false) {
  if (confirmed) return true;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`${message} Re-run with --yes to confirm.`);
  }
  const answer = await prompt(`${message} Type "yes" to continue: `);
  if (answer.toLowerCase() !== 'yes') throw new Error('Operation cancelled.');
  return true;
}
