# Supermarket Operations App (first customer: Super Arzon)

A web app for supermarkets: receive supplier invoices (PDF or paper), calculate and approve selling prices, track stock per branch, manage offers, print shelf labels, track expiry dates, handle supplier returns and shorts, and organize supplier balances. Built for **Super Arzon (3 branches)** first and designed so other supermarkets can use it with their own configuration.

## Status
Phase 0: planning documents and seed data are complete. Code has not been written yet. See `docs/build-plan.md`.

## Where to start
| If you are… | Read |
|---|---|
| The AI developer | `AGENTS.md`, then everything in `docs/` in the order listed there |
| Ali (project owner) | `START_HERE.md` and `PROMPTS.md` in the package root (outside this repo) |

## Documents
| File | What it covers |
|---|---|
| `docs/requirements.md` | Scope, roles and permissions, every business rule |
| `docs/pricing-engine.md` | Selling-price formulas, rounding, edge cases, worked examples |
| `docs/data-model.md` | Entities, relationships, invoice-extraction JSON, stock ledger |
| `docs/workflows.md` | State machines: invoices, price approval, shorts, returns, alerts |
| `docs/design-language.md` | Colors, type, components, copy rules, RTL |
| `docs/screens.md` | Navigation and screens per role |
| `docs/architecture-devops.md` | Tech stack, repo layout, local setup, Docker, CI/CD, AWS plan, security |
| `docs/build-plan.md` | Phases, exit criteria, acceptance checklist |
| `docs/prototype-brief.md` | The no-backend demo for the owner pitch, plus demo script |
| `docs/open-questions.md` | Unresolved items with the default to build with |

## Seed data (`seed/`)
- `arzon-config.json`: Super Arzon starting configuration (loaded into the database on first run).
- `pricing-test-cases.json`: verified reference cases for the pricing engine (must all pass).
- `demo-data.json`: invented demo data for the prototype.
- `pricing_reference.py`: small reference implementation; `python seed/pricing_reference.py` checks all test cases (21 of 21 pass).

## Assets
- `assets/arzon-logo.png`: Super Arzon logo (low resolution; request a high-resolution or vector file for printed labels).

## Running locally
Filled in by the AI developer during Phase 0 (`docs/architecture-devops.md` describes the target setup: Docker Compose with one command to start everything).
