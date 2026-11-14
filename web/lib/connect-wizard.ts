// State for the Connect agent and Create API key pages (NSB-66, NSB-68).
// Steps: 0 what it may do, 1 name, 2 token shown once, 3 install or use it, 4 summary.
// Pure so it can be unit tested. The secret lives only here, and leaving
// the page throws it away, so it is never shown again.

export const WIZARD_STEPS = 5
export const SCOPES_STEP = 0
export const NAME_STEP = 1
export const TOKEN_STEP = 2
export const USE_STEP = 3
export const SUMMARY_STEP = 4
export const LAST_STEP = SUMMARY_STEP

/** What the board handed back once: the secret and anything built from it. */
export type Issued<X> = { secret: string; issuedAt: number; extra: X }

export type WizardState<S extends string, X> = {
  step: number
  scopes: S[]
  name: string
  pending: boolean
  issued: Issued<X> | null
  copied: boolean
  /** The person asked to close while an uncopied token is showing. */
  confirmingClose: boolean
}

export type WizardAction<S extends string, X> =
  | { type: "next" }
  | { type: "back" }
  | { type: "setScopes"; scopes: S[] }
  | { type: "toggleScope"; scope: S; on: boolean }
  | { type: "setName"; name: string }
  | { type: "pending"; on: boolean }
  | { type: "issued"; secret: string; issuedAt: number; extra: X }
  | { type: "copied" }
  | { type: "askClose" }
  | { type: "keepOpen" }
  | { type: "reset"; scopes: S[] }

export function initialWizard<S extends string, X>(scopes: S[]): WizardState<S, X> {
  return {
    step: SCOPES_STEP,
    scopes: [...scopes],
    name: "",
    pending: false,
    issued: null,
    copied: false,
    confirmingClose: false,
  }
}

/** Whether Next (or, on the name step, Generate) may be pressed. */
export function canAdvance<S extends string, X>(state: WizardState<S, X>): boolean {
  if (state.pending) return false
  if (state.step === SCOPES_STEP) return state.scopes.length > 0
  if (state.step === NAME_STEP) return state.scopes.length > 0 && state.name.trim().length > 0
  return state.step < LAST_STEP && state.issued !== null
}

/** Back is offered before the token exists, and after it back down to the token. */
export function canGoBack<S extends string, X>(state: WizardState<S, X>): boolean {
  if (state.pending) return false
  if (state.step === NAME_STEP) return state.issued === null
  return state.step > TOKEN_STEP
}

/** Leaving with a token on screen that was never copied asks first. */
export function closeNeedsConfirm<S extends string, X>(state: WizardState<S, X>): boolean {
  return state.issued !== null && !state.copied
}

export function wizardReducer<S extends string, X>(
  state: WizardState<S, X>,
  action: WizardAction<S, X>,
): WizardState<S, X> {
  switch (action.type) {
    case "next":
      // The name step moves on only when the token arrives ("issued").
      if (state.step === NAME_STEP || !canAdvance(state)) return state
      return { ...state, step: state.step + 1 }
    case "back":
      if (!canGoBack(state)) return state
      return { ...state, step: state.step - 1, confirmingClose: false }
    case "setScopes":
      if (state.issued) return state
      return { ...state, scopes: [...new Set(action.scopes)] }
    case "toggleScope": {
      if (state.issued) return state
      const without = state.scopes.filter((s) => s !== action.scope)
      return { ...state, scopes: action.on ? [...without, action.scope] : without }
    }
    case "setName":
      if (state.issued) return state
      return { ...state, name: action.name }
    case "pending":
      return { ...state, pending: action.on }
    case "issued":
      return {
        ...state,
        pending: false,
        step: TOKEN_STEP,
        issued: { secret: action.secret, issuedAt: action.issuedAt, extra: action.extra },
        copied: false,
      }
    case "copied":
      return state.issued ? { ...state, copied: true, confirmingClose: false } : state
    case "askClose":
      return closeNeedsConfirm(state) ? { ...state, confirmingClose: true } : state
    case "keepOpen":
      return { ...state, confirmingClose: false }
    case "reset":
      // Leaving: the secret and everything built from it are dropped here.
      return initialWizard<S, X>(action.scopes)
  }
}

/** When the token stops working, from the organization's expiry in hours. */
export function expiresAt(issuedAt: number, hours: number): Date {
  const safe = Number.isFinite(hours) && hours > 0 ? hours : 0
  return new Date(issuedAt + safe * 60 * 60 * 1000)
}
