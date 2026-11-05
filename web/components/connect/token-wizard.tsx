"use client"

// The step-by-step modal behind "Connect agent" (Agents page) and "Create API key"
// (API page), NSB-66. It owns the secret: closing the modal drops it from state,
// so it can never be shown again. What the last step shows is up to the caller.

import { useEffect, useReducer, useRef, useState, type ReactNode } from "react"
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  KeyRoundIcon,
} from "@/components/icons"
import { toast } from "sonner"

import type { Scope } from "@/shared/names"
import {
  LAST_STEP,
  NAME_STEP,
  SCOPES_STEP,
  TOKEN_STEP,
  WIZARD_STEPS,
  canAdvance,
  canGoBack,
  closeNeedsConfirm,
  expiresAt,
  initialWizard,
  wizardReducer,
  type Issued,
  type WizardAction,
  type WizardState,
} from "@/lib/connect-wizard"
import { SCOPE_PRESETS, matchingPreset, orderScopes, scopeGroups } from "@/lib/tokens"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SCOPE_GROUPS = scopeGroups()

// Short fade between steps; none at all for people who ask for reduced motion.
const STEP_MOTION = "duration-200 animate-in fade-in slide-in-from-right-2 motion-reduce:animate-none"

export async function copyText(text: string, what: string, description?: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`, description ? { description } : undefined)
    return true
  } catch {
    toast.error("Couldn't copy", { description: "Select the text and copy it by hand." })
    return false
  }
}

/** Dark block with a copy button. Multi-line text keeps its line breaks. */
export function CopyBlock({
  text,
  what,
  multiline = false,
  onCopied,
}: {
  text: string
  what: string
  multiline?: boolean
  onCopied?: () => void
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-foreground p-3 text-background">
      {multiline ? (
        <pre
          className="max-h-48 min-w-0 flex-1 overflow-auto font-mono text-xs whitespace-pre"
          onCopy={onCopied}
        >
          {text}
        </pre>
      ) : (
        <code className="min-w-0 flex-1 font-mono text-xs break-all" onCopy={onCopied}>
          {text}
        </code>
      )}
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="shrink-0 text-background hover:bg-background/15 hover:text-background"
        onClick={async () => {
          if (await copyText(text, what)) onCopied?.()
        }}
        aria-label={`Copy ${what}`}
      >
        <CopyIcon aria-hidden="true" />
      </Button>
    </div>
  )
}

/** A small uppercase label over one part of a step. */
export function StepSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{title}</h4>
      {children}
    </section>
  )
}

export type TokenWizardProps<X> = {
  /** The modal title and the trigger button's text. */
  title: string
  description: string
  /** Names of the four steps, shown in the progress indicator and step headings. */
  stepLabels: readonly [string, string, string, string]
  /** "token" or "API key", for the words around the secret. */
  secretWord: string
  /** The red button on the name step that asks the board for the secret. */
  createLabel: string
  pendingLabel: string
  defaultScopes: Scope[]
  nameLabel: string
  namePlaceholder: string
  expiryHours: number
  /** Element ids start with this, so two wizards never share one. */
  idPrefix: string
  /** No signed-in person: the trigger is disabled. */
  disabled?: boolean
  triggerClassName?: string
  create: (name: string, scopes: Scope[]) => Promise<{ secret: string; extra: X }>
  /** Step 4: install the agent, or use the key. */
  renderLast: (issued: Issued<X>, markCopied: () => void) => ReactNode
  /** Extra buttons in the last step's footer, before Done. */
  lastFooter?: ReactNode
}

export function TokenWizard<X>(props: TokenWizardProps<X>) {
  const { title, defaultScopes, idPrefix } = props
  const [open, setOpen] = useState(false)
  const [state, dispatch] = useReducer(
    wizardReducer<Scope, X>,
    defaultScopes,
    (scopes: Scope[]) => initialWizard<Scope, X>(scopes),
  )
  const headingRef = useRef<HTMLHeadingElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Focus follows the step: Next and Back land on the new step's heading.
  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [open, state.step])

  useEffect(() => {
    if (state.confirmingClose) confirmRef.current?.focus()
  }, [state.confirmingClose])

  function close() {
    setOpen(false)
    // The secret and the install config built from it go here, for good.
    dispatch({ type: "reset", scopes: defaultScopes })
  }

  // Esc, the X, a click outside, or Done.
  function requestClose() {
    if (state.confirmingClose) {
      // A second Esc while asking keeps the token on screen.
      dispatch({ type: "keepOpen" })
      return
    }
    if (closeNeedsConfirm(state)) {
      dispatch({ type: "askClose" })
      return
    }
    close()
  }

  async function generate() {
    if (state.step !== NAME_STEP || !canAdvance(state)) return
    dispatch({ type: "pending", on: true })
    try {
      const { secret, extra } = await props.create(state.name.trim(), orderScopes(state.scopes))
      dispatch({ type: "issued", secret, issuedAt: Date.now(), extra })
    } catch (error) {
      dispatch({ type: "pending", on: false })
      toast.error(error instanceof Error && error.message ? error.message : `Couldn't create the ${props.secretWord}`)
    }
  }

  const markCopied = () => dispatch({ type: "copied" })
  const stepLabel = props.stepLabels[state.step]

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true)
        else requestClose()
      }}
    >
      <DialogTrigger asChild>
        <Button className={props.triggerClassName} disabled={props.disabled}>
          <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-5 sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          headingRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>

        <WizardProgress labels={props.stepLabels} step={state.step} />

        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold outline-none focus-visible:underline"
          >
            Step {state.step + 1} of {WIZARD_STEPS}: {stepLabel}
          </h3>
          <div key={state.step} className={cn("flex flex-col gap-4", STEP_MOTION)}>
            {state.step === SCOPES_STEP && (
              <ScopePicker idPrefix={idPrefix} scopes={state.scopes} dispatch={dispatch} />
            )}
            {state.step === NAME_STEP && (
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void generate()
                }}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${idPrefix}-name`}>{props.nameLabel}</Label>
                  <Input
                    id={`${idPrefix}-name`}
                    value={state.name}
                    onChange={(event) => dispatch({ type: "setName", name: event.target.value })}
                    placeholder={props.namePlaceholder}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1 rounded-lg border p-3">
                  <span className="text-sm font-medium">Expiry</span>
                  <p className="text-sm text-muted-foreground">
                    The {props.secretWord} stops working {props.expiryHours} h after you create it. Your
                    organization sets this in Organization.
                  </p>
                </div>
              </form>
            )}
            {state.step === TOKEN_STEP && state.issued && (
              <IssuedSecret
                issued={state.issued}
                secretWord={props.secretWord}
                expiryHours={props.expiryHours}
                copied={state.copied}
                onCopied={markCopied}
              />
            )}
            {state.step === LAST_STEP && state.issued && props.renderLast(state.issued, markCopied)}
          </div>
        </div>

        {state.confirmingClose ? (
          <Alert role="alertdialog" aria-labelledby={`${idPrefix}-confirm-title`}>
            <AlertTriangleIcon aria-hidden="true" />
            <AlertTitle id={`${idPrefix}-confirm-title`}>
              Close without copying the {props.secretWord}?
            </AlertTitle>
            <AlertDescription>
              <span>It is shown once. After you close this, nobody can show it again.</span>
              <span className="mt-2 flex flex-wrap justify-end gap-2">
                <Button
                  ref={confirmRef}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => dispatch({ type: "keepOpen" })}
                >
                  Keep it open
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={close}>
                  Close anyway
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {canGoBack(state) && (
                <Button type="button" variant="outline" onClick={() => dispatch({ type: "back" })}>
                  <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {state.step === LAST_STEP && props.lastFooter}
              {state.step === NAME_STEP ? (
                <Button type="button" onClick={() => void generate()} disabled={!canAdvance(state)}>
                  <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
                  {state.pending ? props.pendingLabel : props.createLabel}
                </Button>
              ) : state.step === LAST_STEP ? (
                <Button type="button" variant="outline" onClick={requestClose}>
                  Done
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => dispatch({ type: "next" })}
                  disabled={!canAdvance(state)}
                >
                  Next
                  <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function WizardProgress({ labels, step }: { labels: readonly string[]; step: number }) {
  return (
    <ol aria-label="Progress" className="grid grid-cols-4 gap-2">
      {labels.map((label, index) => {
        const done = index < step
        const current = index === step
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className="flex min-w-0 flex-col gap-1.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1 rounded-full transition-colors duration-200 motion-reduce:transition-none",
                done || current ? "bg-foreground" : "bg-muted"
              )}
            />
            <span
              className={cn(
                "flex items-center gap-1 truncate text-xs",
                current ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {done && <CheckIcon className="size-3 shrink-0" aria-hidden="true" />}
              <span className="sr-only">
                Step {index + 1}
                {done ? ", done" : current ? ", current" : ""}:{" "}
              </span>
              <span className="truncate">{label}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// Step 1. Presets on top, then every scope grouped by area. A hint sits under its
// own scope's label, inside that scope's row, so it can't be read as the next one's.
function ScopePicker({
  idPrefix,
  scopes,
  dispatch,
}: {
  idPrefix: string
  scopes: Scope[]
  dispatch: (action: WizardAction<Scope, never>) => void
}) {
  const preset = matchingPreset(scopes)
  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-labelledby={`${idPrefix}-presets`} className="flex flex-col gap-2">
        <span id={`${idPrefix}-presets`} className="text-sm font-medium">
          Start from a preset
          {!preset && <span className="ml-1.5 font-normal text-muted-foreground">· Custom selection</span>}
        </span>
        <div className="grid gap-2 sm:grid-cols-3">
          {SCOPE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => dispatch({ type: "setScopes", scopes: p.scopes })}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none",
                preset === p.id && "border-foreground bg-muted"
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {preset === p.id && <CheckIcon className="size-3.5" aria-hidden="true" />}
                {p.label}
              </span>
              <span className="text-xs text-muted-foreground">{p.description}</span>
            </button>
          ))}
        </div>
      </div>

      {SCOPE_GROUPS.map((group) => (
        <fieldset key={group.id} className="flex flex-col gap-3">
          <legend className="mb-2 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            {group.label}
          </legend>
          {group.options.map(({ scope, label, hint, optIn }) => {
            const id = `${idPrefix}-scope-${scope}`
            const hintId = `${id}-hint`
            return (
              <div key={scope} data-scope={scope} className="flex items-start gap-2.5">
                <Checkbox
                  id={id}
                  className="mt-0.5"
                  aria-describedby={hint ? hintId : undefined}
                  checked={scopes.includes(scope)}
                  onCheckedChange={(on) => dispatch({ type: "toggleScope", scope, on: on === true })}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <Label htmlFor={id} className="font-normal">
                      {label}
                    </Label>
                    <code className="font-mono text-xs text-muted-foreground">{scope}</code>
                  </div>
                  {hint ? (
                    <p id={hintId} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      {optIn && <AlertTriangleIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />}
                      {hint}
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </fieldset>
      ))}
    </div>
  )
}

// Step 3. The secret, once, with when it stops working.
function IssuedSecret({
  issued,
  secretWord,
  expiryHours,
  copied,
  onCopied,
}: {
  issued: Issued<unknown>
  secretWord: string
  expiryHours: number
  copied: boolean
  onCopied: () => void
}) {
  const expiry = expiresAt(issued.issuedAt, expiryHours)
  return (
    <div className="flex flex-col gap-4">
      <CopyBlock text={issued.secret} what={capitalize(secretWord)} onCopied={onCopied} />
      <p className="text-sm text-muted-foreground">
        Expires{" "}
        <time dateTime={expiry.toISOString()} className="font-medium text-foreground">
          {expiry.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </time>{" "}
        ({expiryHours} h from now).
        {copied && (
          <span className="ml-2 inline-flex items-center gap-1 text-foreground">
            <CheckIcon className="size-3.5" aria-hidden="true" />
            Copied
          </span>
        )}
      </p>
      <Alert>
        <AlertTriangleIcon aria-hidden="true" />
        <AlertTitle>This {secretWord} is shown once</AlertTitle>
        <AlertDescription>
          Copy it now. We only keep a scrambled version, so we can&apos;t show it again after you close this.
        </AlertDescription>
      </Alert>
    </div>
  )
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export type { Issued, WizardState }
