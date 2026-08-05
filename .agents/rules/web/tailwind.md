---
trigger: model_decision
description: When working on the web application and anything UI related
globs: apps/web/**/*.{tsx,jsx,ts,js,css}
---

# Tailwind CSS Usage Standard

**Rule Name:** tailwind-design-system-standard

**Applies to:** All frontend files using Tailwind CSS (.tsx, .jsx, .ts, .js)

---

## Purpose

This rule enforces a scalable, semantic, design-system-first approach to Tailwind CSS.

Tailwind must not be used as ad-hoc inline styling.
All UI must follow the layered Tailwind strategy defined below.

---

## Tailwind Mental Model (Required)

Tailwind usage is split into three strict layers:

1. **Design Tokens** → `tailwind.config.js`
2. **Semantic Component Classes** → `@layer components`
3. **Inline Utilities** → Layout & one-offs only

Violations of this order are not allowed.

---

## 1. Design Tokens (Global Only)

### Rules

- ❌ Never use hex colors in JSX or CSS
- ❌ Never hardcode font sizes, colors, spacing, or shadows inline
- ✅ Always use tokens defined in `tailwind.config.js`

### Allowed Examples

```
bg-ui-bg
bg-ui-surface
text-text-primary
text-brand-blue
bg-brand-teal
border-ui-border
```

### Disallowed Examples

```
bg-[#2F5F8F]
text-gray-800
shadow-[0_4px_12px_rgba(0,0,0,0.08)]
```

If a value is missing, add it to `tailwind.config.js` first.

---

## 2. Semantic Component Classes (Required for UI)

### Rules

- ✅ Reusable UI must use semantic classes
- ❌ Do not repeat long Tailwind class strings across components
- ❌ Do not style core UI elements inline

Semantic classes must be created in:

```
src/styles/tailwind.css
@layer components
```

### Required for:

- Buttons
- Inputs
- Forms
- Cards
- Modals
- Layout containers
- Navigation elements
- Status indicators

### Example

```css
@layer components {
  .btn {
    @apply inline-flex items-center justify-center rounded-md font-medium;
  }

  .btn-teal {
    @apply btn bg-brand-teal text-text-primary;
  }
}
```

### JSX Usage

```tsx
<button className="btn-teal">Save</button>
```

---

## 3. Inline Utilities (Strictly Limited)

### Allowed Use Cases

Inline Tailwind utilities are allowed only for:

- Layout (flex, grid, gap)
- Spacing between elements
- Responsive adjustments
- One-off positioning

### Allowed

```tsx
<div className="flex items-center gap-4">
```

### Disallowed

```tsx
<button className="px-4 py-2 bg-brand-teal rounded-md">
```

If inline utilities are copied more than once, they must be abstracted.

---

## New Component Styling Standard

When creating a new component:

### Step 1 — Ask:

"Will this component be reused?"

- If yes → semantic class required
- If no → inline layout utilities allowed

---

### Step 2 — Create Semantic Class

Add a new class under `@layer components`:

```css
.component-name {
  @apply bg-ui-surface border border-ui-border rounded-lg p-4;
}
```

**Naming rules:**

- kebab-case
- describe purpose, not appearance
- avoid color names (card-primary, not card-blue)

---

### Step 3 — Use in JSX

```tsx
<div className="component-name">...</div>
```

---

## Color Usage Rules

### Backgrounds

- Use neutral UI colors only
- `bg-ui-bg`, `bg-ui-surface`, `bg-ui-muted`

### Text

- Default: `text-text-primary`
- Muted: `text-text-muted`
- Brand accents: `text-brand-blue`

### Buttons / CTAs

- CTAs must only use:
  - `btn-teal`
  - `btn-orange`
- Do not invent new CTA colors without approval

---

## Accessibility & Interaction

### Required for interactive elements

- `focus:ring-*`
- Hover state
- Clear contrast

### Example

```css
.btn-teal {
  @apply focus:ring-2 focus:ring-brand-teal;
}
```

---

## Anti-Patterns (Do Not Do This)

- Large inline class strings
- Hex colors in JSX
- One-off buttons styled inline
- Repeating layouts without abstraction
- Styling logic inside components

---

## Success Criteria

A codebase following this rule will:

- Have readable JSX
- Centralized visual changes
- Minimal CSS files
- Fast refactors
- Consistent UI
- Predictable components

---

## Cursor Agent Instruction

When generating or modifying code:

- Always prefer existing semantic classes
- Create new semantic classes when needed
- Never introduce raw colors or spacing values
- Follow the three-layer Tailwind system