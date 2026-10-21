# Before and after

Real corrections from past reviews, grouped by what was wrong. They show the calibration: deletion is the usual outcome, and survivors shrink to one clause.

## Session narrative and justifying the change

```ts
// The dim sits on the bar so its own controls fade with the items rather than staying full strength.
```
→ deleted. It argues for the change against the previous state ("rather than"). The reason went into the commit.

```ts
take(1), // Only take the first result
// Note: cleanup is now handled by the animation completion callback
```
→ `return modalRef.result$.pipe(take(1));` — "now" records an edit, and the first comment restates `take(1)`.

```ts
// One shared iframe: per-file iframes each re-import every icon and fail partway through on CI runners.
isolate: false,
```
→ `isolate: false,` with the reason moved to the commit message, because it explains why the setting was changed, not something a reader of the config needs each time.

## Ephemeral references

```ts
/** What a data grid hands its cell content (D10). Spike: carries only the entered cell; the row's disabled state follows in phase 1. */
```
→ `/** What a data grid hands its cell content, so the controls inside can follow where the user has entered the grid. @internal */`
Decision ids, "spike", "phase 1" mean nothing once the planning document is gone.

```cs
// The group carries no version field of its own until MRP-1182 puts xmin on the entities, so there is nothing to detect a change made underneath this write. Locking the row serialises two of these calls against each other, and materialises the row tracked so the upsert below finds it without reading it again.
```
→ `// Nothing on the group detects a change made underneath this write, so the row is locked to serialise two of these calls against each other.`
Ticket key and future fix gone; one causal sentence kept.

## Comparisons with another or a removed system

```cs
/// Orders a search the way OpenSearch ordered it: a row with no value sorts last…
/// …any other is refused as OpenSearch refused it.
```
→ `/// Orders a search: a row with no value sorts last…` / `…any other is refused.`

```cs
// Members first, as DynamoDB writes them: they already carry the group pointer…
```
→ `// Members first: they carry the group pointer the group's member list is read back from.`

```cs
/// Writes <paramref name="incoming"/> as DynamoDB's <c>Put</c> would: the row ends up holding exactly the…
```
→ `/// Replaces the row with <paramref name="incoming"/>: the row ends up holding exactly the…`
This applies even though DynamoDB was still the live store of record at the time. A comparison with a running system is still a comparison: the comment outlives the migration.

## The code, compiler or a test already says it

```ts
// Typed as the default App, because its inferred type from a custom Octokit loses the REST endpoint types
const app: App = …
```
→ deleted. Removing `: App` fails to compile, so the compiler guards it.

```ts
// Writing after the lock was lost would overwrite whatever its new holder has saved
this.stateLock?.signal.throwIfAborted();
```
→ the line alone.

```ts
/** Drive the flat list's keyboard model from the search field, leaving typing keys alone. */
protected handleSearchKeydown(event: KeyboardEvent) { … }
```
→ no JSDoc: the guard is the documentation, and it's a template-only protected member.

## Public docs describing mechanism instead of usage

```ts
/** Captures its projected content and registers it with the `ActionBarRegistry` service for rendering at the `beam-action-bar-outlet`; renders nothing in place. */
```
→ `/** Declares a page's action bar; its actions render at the `beam-action-bar-outlet`, not in place. */`
The internal service is invisible to consumers.

```ts
/** Translation key for the message announced… The design carries no visible message for this state — the error treatment on the chrome is the visual signal — so this is the accessible equivalent and is exposed to assistive technology only. */
```
→ `/** Translation key for the message announced to assistive technology when a search runs with nothing entered. Not shown visually. */`
What the consumer gets stays in; why the design chose it goes.

```ts
/** File-type filter in native `accept` syntax, applied to the explorer dialogue and to incoming files from either path — explorer choices and drops alike. */
```
→ `/** File-type filter in native `accept` syntax. Files that do not match are silently ignored, whether chosen in the explorer or dropped. Unset accepts any file. */`
Rewritten around what the consumer observes, including the unset default.

```ts
/** The date treated as "today". Defaults to the current date; overridable for testing. */
```
→ `/** The date treated as "today". Defaults to the current date. */` — "for testing" is the author's reason, not the consumer's.

```ts
/** Appearance of a `beam-action-bar-button`. Tertiary is excluded by design. */
```
→ `/** Appearance of a `beam-action-bar-button`. */` — the type already shows tertiary isn't an option.

## Overlong, condensed rather than deleted

```ts
/** Pushes a consumer-written value into the filters: a filter whose key is named is shown carrying that clause's value, every other filter is cleared, and clauses naming no registered filter are held pending. */
```
→ `/** Pushes a consumer-written value into the filters, holding clauses that name no registered filter. */`
Keeps the one non-obvious behaviour; drops what follows naturally.

```ts
/** Modals stack: opening a modal from within another (for example a confirmation) places the new one on top. Up to {@link MAX_MODAL_DEPTH} modals may be open at once; only the top-most is interactive, with the rest dimmed behind the top modal's backdrop and made inert. */
```
→ `/** Modals stack up to {@link MAX_MODAL_DEPTH} deep; only the top one is interactive, the rest are dimmed and inert. */`

## Public-but-internal members

```ts
readonly focusSuppressed = injectCellFocusSuppressed();   // public because a host directive reads it
```
→
```ts
/**
 * Whether an enclosing data grid hides this control's focus ring, because the user has not entered its cell.
 * @internal
 */
```
Consumers never set it, so it's marked internal to keep it out of generated docs. (If the member were `protected` and template-only, it would get no doc at all.)

## Comment contradicts the code

```ts
// Filters shown from the start run this in declaration order, so they keep that order.
```
Filters declared inside a consumer's `@for` actually ranked last — the comment described intent the code didn't meet. That was a bug, not a wording problem: flag it to the user rather than editing the comment to match.

## Kept

```ts
// Chromium fires focusout while removing or moving the focused element, before the mutation is reported: a
// removal or a move keeps the focus to restore, a blur to nothing focusable lets it go.
```
A platform quirk nobody could infer from the code, which someone would otherwise "simplify" away. This is what a surviving comment looks like.
