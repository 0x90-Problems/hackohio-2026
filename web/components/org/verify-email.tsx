"use client"

import { useState } from "react"
import { toast } from "sonner"

import { ORG_ERRORS, ORG_TEXT } from "@/shared/names"
import { OrgApiError, plausibleEmail } from "@/lib/org-api"
import { orgApi } from "@/lib/use-orgs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Your own email, checked with a 6-digit code (email mode only). The board always answers the
// same whether or not the address is free, so this never says either. No suggestions: the
// field has autoComplete off, and nothing here looks anyone up.
export function VerifyEmail({ onVerified }: { onVerified: () => void }) {
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [off, setOff] = useState(false)

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!plausibleEmail(email) || busy) return
    setBusy(true)
    try {
      await orgApi.startEmail(email)
      setSent(true)
    } catch (error) {
      // Email sending isn't set up (link mode): there's no code to wait for.
      if (error instanceof OrgApiError && error.code === ORG_ERRORS.NOT_CONFIGURED) setOff(true)
      else toast.error(error instanceof Error ? error.message : ORG_TEXT.LOAD_FAILED)
    } finally {
      setBusy(false)
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code.trim()) || busy) return
    setBusy(true)
    try {
      if (await orgApi.verifyEmail(code)) {
        toast.success(ORG_TEXT.VERIFIED)
        onVerified()
      }
    } catch (error) {
      toast.error(error instanceof OrgApiError && error.code === ORG_ERRORS.CODE_INVALID ? ORG_TEXT.VERIFY_WRONG : error instanceof Error ? error.message : ORG_TEXT.VERIFY_WRONG)
    } finally {
      setBusy(false)
    }
  }

  if (off) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {ORG_TEXT.EMAIL_NOT_CONFIGURED}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4 duration-200 animate-in fade-in motion-reduce:animate-none">
      <div className="flex flex-col gap-1">
        <p className="font-medium">{ORG_TEXT.VERIFY_TITLE}</p>
        <p className="text-sm text-muted-foreground">{ORG_TEXT.VERIFY_HINT}</p>
      </div>
      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="verify-email">{ORG_TEXT.INVITE_EMAIL_LABEL}</Label>
          <Input
            id="verify-email"
            name="verify-email"
            type="email"
            autoComplete="off"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" disabled={!plausibleEmail(email) || busy}>
          {ORG_TEXT.VERIFY_SEND}
        </Button>
      </form>
      {sent ? (
        <form onSubmit={verify} className="flex flex-col gap-2 duration-200 animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-sm text-muted-foreground" role="status">
              {ORG_TEXT.VERIFY_SENT}
            </p>
            <Label htmlFor="verify-code">{ORG_TEXT.VERIFY_CODE_LABEL}</Label>
            <Input
              id="verify-code"
              name="verify-code"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!/^\d{6}$/.test(code) || busy}>
            {ORG_TEXT.VERIFY_CHECK}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
