# Prototype review guide

The seven review branches form a chain: each is based on the preceding part. Part 1 is based on `feat/phase-0-1-foundation`, whose pull request is still open. Review and merge in that order; none of these branches pushes directly to `main`.

Cloud validation is handled by Codex and CI. Ali does not need to install tools or run checks locally. The commands below are for anyone who wants to run the demo on a machine with the pinned Node.js 22 version installed.

From the repository root, after selecting the review branch:

```bash
cd prototype
npm ci
npm run dev
```

Open `http://localhost:5174` on that machine. To stop the server, press Ctrl+C in its terminal. This app uses fictional browser data only. Demo PINs: Supervisor `1111`, Floor Worker `2222`, Cashier `3333`. Reset demo restores all fictional seed data.

## 1. Shell and design system

Branch: `feat/prototype-01-shell`

1. Select Cashier, enter PIN `3333`, and click Sign in.
2. Check that only Cashier lookup appears in the menu.
3. Change the Role switcher to Supervisor and sign in with `1111`.
4. Change Branch 1 to Branch 2, then select فارسی and inspect the mirrored layout.
5. On a phone-sized window, open the menu and navigate with the keyboard.
6. Click Reset demo, then confirm Reset demo. Language and role stay selected.

At this stage the business screens are placeholders; the later review branches replace them in the requested order.
