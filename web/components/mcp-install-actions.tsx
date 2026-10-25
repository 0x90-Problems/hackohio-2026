"use client"

import { ArrowRightIcon, CopyIcon } from "@/components/icons"
import { toast } from "sonner"

import type { McpInstallLinks } from "@/lib/mcp-install"
import { Button } from "@/components/ui/button"

async function copyText(text: string, what: string, description?: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`, description ? { description } : undefined)
  } catch {
    toast.error("Couldn't copy", { description: "Select the text and copy it by hand." })
  }
}

export function McpInstallActions({ install }: { install: McpInstallLinks }) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        onClick={() => copyText(install.json, "MCP config")}
      >
        <CopyIcon data-icon="inline-start" aria-hidden="true" />
        Copy MCP config
      </Button>
      <Button variant="outline" className="w-full justify-start" asChild>
        <a href={install.cursorUrl}>
          <ArrowRightIcon data-icon="inline-start" aria-hidden="true" />
          Add to Cursor
        </a>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-auto w-full justify-start py-2 whitespace-normal"
        onClick={() =>
          copyText(install.json, "Claude Desktop config", "Paste it into claude_desktop_config.json.")
        }
      >
        <CopyIcon data-icon="inline-start" aria-hidden="true" />
        <span className="flex flex-col items-start gap-0.5 text-left">
          <span>Copy for Claude Desktop</span>
          <span className="text-xs font-normal text-muted-foreground">
            Paste into claude_desktop_config.json
          </span>
        </span>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        onClick={() => copyText(install.claudeCommand, "Claude Code command")}
      >
        <CopyIcon data-icon="inline-start" aria-hidden="true" />
        Copy Claude Code command
      </Button>
    </div>
  )
}
