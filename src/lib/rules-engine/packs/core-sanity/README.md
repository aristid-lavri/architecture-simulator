# core-sanity

**Pack ID :** `core-sanity`

## Purpose

Ship the baseline of architecturally impossible or suspicious connections. This is the
default pack loaded by the rules engine and covers the "obviously wrong" wiring that
beginners (and seasoned architects on a Friday afternoon) tend to draw.

## Rule ID convention

```
core-sanity/<category>/<rule-name>
```

The category segment matches the directory under `rules/`.

## Stats

- **15 rules total** (10 ERROR + 5 WARNING)
- **Categories**
  - `physical` (9) — physically impossible connections (DB initiating, firewall
    initiating, client→client, etc.). All ERROR.
  - `routing` (5) — routing smells / suspicious topologies (LB→LB, client→DB
    direct, etc.). 1 ERROR + 4 WARNING.
  - `topology` (1) — graph-scope checks (orphan circuit-breaker). WARNING.

## Phase 2

Future categories (security, performance, cost) will be added under `rules/<category>/`
without touching the engine — just add files and register them in `pack.ts`.
