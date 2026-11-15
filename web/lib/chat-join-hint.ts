// A team's public channels you haven't joined aren't in your sidebar, so an empty sidebar can look
// like the channels are gone. This is the line that says they're there.

export function joinHint(joinable: { name: string }[]): string | null {
  if (joinable.length === 0) return null
  if (joinable.length === 1) return `This team has a channel you haven't joined: #${joinable[0].name}.`
  return `This team has ${joinable.length} channels you haven't joined.`
}
