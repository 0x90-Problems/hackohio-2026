"use client"

// The step-by-step page behind "Connect agent" (/agents/connect) and "Create API key"
// (/api/keys/new), NSB-66 and NSB-68. It owns the secret: leaving the page drops it
// from state, so it can never be shown again. What steps 4 and 5 show is up to the caller.

import { useEffect, useReducer, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
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
  SUMMARY_STEP,
  TOKEN_STEP,
  USE_STEP,
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
import { SCOPE_PRESETS, matchingPreset, orderScopes, scopeGroups, scopeLabel } from "@/lib/tokens"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
          className="max-h-80 min-w-0 flex-1 overflow-auto font-mono text-xs whitespace-pre"
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
      <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

/** One row of the summary step: a label on the left, the value on the right (stacked on phones). */
export function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

/** The chosen scopes as plain words, with the raw scope name beside each. */
export function ScopeList({ scopes }: { scopes: readonly Scope[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {scopes.map((scope) => (
        <li key={scope} className="flex flex-wrap items-baseline gap-x-2">
          <span>{scopeLabel(scope)}</span>
          <code className="font-mono text-xs text-muted-foreground">{scope}</code>
        </li>
      ))}
    </ul>
  )
}

/** What the summary step shows besides the secret. */
export type WizardSummary = { name: string; scopes: Scope[]; expiresAt: Date }

export type TokenWizardProps<X> = {
  /** The page heading. */
  title: string
  description: string
  /** Names of the five steps, shown in the progress list and step headings. */
  stepLabels: readonly [string, string, string, string, string]
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
  /** No signed-in person: the name step can't create anything. */
  disabled?: boolean
  /** Where "Back to …" and Done go, already checked to be a path in this app. */
  returnTo: string
  /** The words after "Back to". */
  returnLabel: string
  create: (name: string, scopes: Scope[]) => Promise<{ secret: string; extra: X }>
  /** Step 4: install the agent, or use the key. */
  renderUse: (issued: Issued<X>, markCopied: () => void) => ReactNode
  /** Step 5: what was set up, and the one-time config to copy. */
  renderSummary: (issued: Issued<X>, summary: WizardSummary, markCopied: () => void) => ReactNode
  /** Extra buttons in the last step's footer, before Done. */
  lastFooter?: ReactNode
}

// A full page (NSB-68), so tokens and config snippets get room. The secret lives only in
// this component's state: every way out of the page goes through close(), which drops it.
export function TokenWizard<X>(props: TokenWizardProps<X>) {
  const { defaultScopes, idPrefix, returnTo } = props
  const router = useRouter()
  const [state, dispatch] = useReducer(
    wizardReducer<Scope, X>,
    defaultScopes,
    (scopes: Scope[]) => initialWizard<Scope, X>(scopes),
  )
  const headingRef = useRef<HTMLHeadingElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const firstStep = useRef(true)

  // Focus follows the step: Next and Back land on the new step's heading (not on first load).
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    headingRef.current?.focus()
  }, [state.step])

  useEffect(() => {
    if (state.confirmingClose) confirmRef.current?.focus()
  }, [state.confirmingClose])

  // Reloading or closing the tab with an uncopied secret on screen asks the browser to warn.
  const unsaved = closeNeedsConfirm(state)
  useEffect(() => {
    if (!unsaved) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [unsaved])

  function close() {
    // The secret and the install config built from it go here, for good.
    dispatch({ type: "reset", scopes: defaultScopes })
    router.push(returnTo)
  }

  // "Back to …" or Done.
  function requestClose() {
    if (closeNeedsConfirm(state)) {
      dispatch({ type: "askClose" })
      return
    }
    close()
  }

  async function generate() {
    if (props.disabled || state.step !== NAME_STEP || !canAdvance(state)) return
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-3">
        <div>
          <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={requestClose}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Back to {props.returnLabel}
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <KeyRoundIcon className="size-6" aria-hidden="true" />
            {props.title}
          </h1>
          <p className="text-muted-foreground">{props.description}</p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <WizardProgress labels={props.stepLabels} step={state.step} />

        <Card className="min-w-0 gap-5">
          <CardContent className="flex flex-col gap-5">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-lg font-semibold outline-none focus-visible:underline"
            >
              Step {state.step + 1} of {WIZARD_STEPS}: {stepLabel}
            </h2>
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
                  <div className="flex max-w-lg flex-col gap-2">
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
              {state.step === USE_STEP && state.issued && props.renderUse(state.issued, markCopied)}
              {state.step === SUMMARY_STEP &&
                state.issued &&
                props.renderSummary(
                  state.issued,
                  {
                    name: state.name.trim(),
                    scopes: orderScopes(state.scopes),
                    expiresAt: expiresAt(state.issued.issuedAt, props.expiryHours),
                  },
                  markCopied
                )}
            </div>
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3 border-t">
            {state.confirmingClose ? (
              <Alert role="alertdialog" aria-labelledby={`${idPrefix}-confirm-title`}>
                <AlertTriangleIcon aria-hidden="true" />
                <AlertTitle id={`${idPrefix}-confirm-title`}>
                  Leave without copying the {props.secretWord}?
                </AlertTitle>
                <AlertDescription>
                  <span>It is shown once. After you leave this page, nobody can show it again.</span>
                  <span className="mt-2 flex flex-wrap justify-end gap-2">
                    <Button
                      ref={confirmRef}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => dispatch({ type: "keepOpen" })}
                    >
                      Stay here
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={close}>
                      Leave anyway
                    </Button>
                  </span>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                    <Button
                      type="button"
                      onClick={() => void generate()}
                      disabled={props.disabled || !canAdvance(state)}
                    >
                      <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
                      {state.pending ? props.pendingLabel : props.createLabel}
                    </Button>
                  ) : state.step === LAST_STEP ? (
                    <Button type="button" variant="outline" onClick={requestClose}>
                      Done, back to {props.returnLabel}
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
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

// Numbered steps down the left on wide screens; a row of bars above the card on phones.
function WizardProgress({ labels, step }: { labels: readonly string[]; step: number }) {
  return (
    <ol aria-label="Progress" className="grid grid-cols-5 gap-2 lg:sticky lg:top-20 lg:grid-cols-1 lg:gap-1">
      {labels.map((label, index) => {
        const done = index < step
        const current = index === step
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={cn(
              "flex min-w-0 flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-3 lg:rounded-lg lg:p-2",
              current && "lg:bg-muted"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1 rounded-full transition-colors duration-200 motion-reduce:transition-none lg:hidden",
                done || current ? "bg-foreground" : "bg-muted"
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                "hidden size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors duration-200 motion-reduce:transition-none lg:flex",
                done || current ? "border-foreground bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              {done ? <CheckIcon className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "flex min-w-0 items-center gap-1 text-xs lg:text-sm",
                current ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {done && <CheckIcon className="size-3 shrink-0 lg:hidden" aria-hidden="true" />}
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

      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
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
          {formatWhen(expiry)}
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
          Copy it now. We only keep a scrambled version, so we can&apos;t show it again after you leave this page.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function formatWhen(date: Date) {
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export type { Issued, WizardState }
