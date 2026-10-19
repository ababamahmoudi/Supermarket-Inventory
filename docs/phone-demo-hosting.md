# Test the phone demo from Ubuntu

This is a browser prototype with fictional data. No cloud account, site, email policy or other resource has been created for you. The first two options below run on your own Ubuntu computer. The optional Cloudflare option is a procedure you may choose to follow later; it is not needed to review the app on Ubuntu.

Every phone, browser profile and site address keeps its **own separate demo records**. A change on your Ubuntu computer does not appear on a phone. Switching people from **Demo** demonstrates colleagues sharing that one browser; it does not send data to another device. The local address, a Cloudflare production address and a preview address are different browser storage areas. Use fictional information only. App updates preserve that address's local data; changing to another address may look like a fresh demo.

The combined review branch is **`feat/prototype-e3-phones`**, stacked on E2, E1 and C8. It is available in [pull request #24](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/24) and includes all four review branches. After the approved pull requests are merged in order, use `main` for later hosted updates. This guide describes intended owner steps; actual automated test and screenshot results belong in the PR review documents.

## 1. Start it in a browser inside Ubuntu Desktop

You need Git and the supported Node 22, not Docker, Docker Desktop, Python or `make setup`. Open **Terminal** with **Ctrl+Alt+T**. Run one block at a time and wait for the usual prompt. If a command fails, keep its complete error and stop at that step.

Install the download tools and Git:

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
```

Ubuntu may ask for your computer password. Nothing appears while you type it; press Enter when finished. Expect the installation to complete without an error.

Install the supported Node version with the same installer used by the prototype README:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22.23.3
nvm alias default 22.23.3
nvm use 22.23.3
node --version
npm --version
```

Expect **`v22.23.3`** and an npm version. The package supports Node 22 at least 22.22.2 and below 23. If `nvm` is not found, close Terminal, reopen it and repeat the `export`, `.`, and `nvm` lines. Do not install a different Node major to work around an error.

If this repository is not already downloaded:

```bash
cd ~
git clone --branch feat/prototype-e3-phones https://github.com/ababamahmoudi/Supermarket-Inventory.git
cd Supermarket-Inventory
```

If `Supermarket-Inventory` already exists, use these instead:

```bash
cd ~/Supermarket-Inventory
git status --short
```

No output means there are no changed files. If files are listed, keep them and stop before switching branches. When there are no changes, run:

```bash
git fetch origin
git switch feat/prototype-e3-phones
git pull --ff-only origin feat/prototype-e3-phones
```

`git status --short` should show no changed files. If it lists changes or switching is refused, keep those files and the message. Do not run `git reset --hard`, delete the folder or choose a discard option. `--ff-only` also refuses to overwrite different local history. If the branch is not found, check that `git fetch origin` succeeded and that you are in this repository; compare the branch name with [pull request #24](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/24) and retain the error.

Check the branch, build, and start:

```bash
git branch --show-current
cd prototype
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 5174 --strictPort
```

Expect **`feat/prototype-e3-phones`**, a completed dependency installation, a successful TypeScript/Vite build and **`http://127.0.0.1:5174/`**. Leave this Terminal open. In Chrome or Firefox **inside Ubuntu**, enter **http://localhost:5174**. The sign-in page should open. A funding notice or build chunk-size warning is not a failure when the command ends successfully.

For a fresh/reset fictional demo, use **manager / demo1234**. The privileged second step is simulated; follow the prompt. Open **Demo** and choose the direct **Switch to…** item for the supplied person. At phone width, open **More (⋯) → Demo** first. The supplied usernames are owner, manager, rh-supervisor, ny-floor, wh-floor and cashier. Existing saved/custom passwords are preserved during normal upgrades; the fresh-demo password is not a promise to overwrite them. **Reset demo** explicitly clears fictional business/People changes in this browser, as its confirmation explains.

For local automated checks, stop the preview with **Ctrl+C**, then run each command separately from `~/Supermarket-Inventory/prototype`:

```bash
npm test
npm run lint
npm run build
```

`npm test` already runs the SDK suite after the app tests. Expect each command to finish with zero failures/an exit status of 0. Test totals can grow; use the actual current output. Do not interpret tests that are skipped or not run as passes. Start `npm run preview` again to continue clicking. The PR review guide gives the browser-suite commands and actual executed results.

If the browser is blank, check the server Terminal first. If port 5174 is in use, stop the **old demo server you started** with Ctrl+C and retry; do not kill unrelated processes. A failed `npm ci` or build must be resolved before the app can be tested. Keep the exact error, Node version and branch name to share.

## 2. Open it on a phone on the same Wi-Fi

This option is for checking layout and tapping through flows. Your computer must stay on and keep serving the app. Both devices must be on the same trusted local network, not guest Wi-Fi which blocks devices from one another.

In the preview Terminal, press **Ctrl+C**, then run:

```bash
cd ~/Supermarket-Inventory/prototype
npm run preview -- --host 0.0.0.0 --port 5174 --strictPort
```

Expect a Local address and one or more Network addresses. `0.0.0.0` makes this test server listen on your computer's network interfaces; it is not the address to type into the phone.

Open a second Terminal and find Ubuntu's local address:

```bash
ip -brief -4 address show scope global
```

For example, `wlp2s0 UP 192.168.1.20/24` means the address is **192.168.1.20**. Use your actual number, not this example. Ignore Docker/VPN/bridge interfaces. On the phone, open Chrome or Safari and type **http://192.168.1.20:5174**, replacing the number. Do not use `localhost` on the phone: that means the phone itself. You should see the normal sign-in screen with the phone's own fresh/local data.

Try English/Persian and light/dark. Open Products and Received: rows should show a name, one muted facts line, the important value and an end arrow. In Labels, tapping its checkbox should select, while opening the row should retain the existing permitted behavior. Run the E2 demo steps by switching people **on that same phone**; switching the person on Ubuntu will not change the phone's records.

### If the phone cannot load it

1. Open **http://localhost:5174** inside Ubuntu. If that fails too, the preview is not running or its build failed. Fix its Terminal error first.
2. Open the **Network** address from the preview in the Ubuntu browser. Use the exact shown port. If the address changed after reconnecting Wi-Fi, use the new one.
3. Check the phone is on the same Wi-Fi, with cellular/VPN temporarily disconnected for this local test if it routes away from that Wi-Fi. Guest networks often isolate clients; use your normal trusted Wi-Fi. Do not change your router to expose this port to the Internet.
4. If Ubuntu is a **virtual machine**, follow the VM steps below. A usual `10.0.2.15` NAT address belongs inside the VM and is not reachable directly from your phone.
5. Check Ubuntu's firewall:

```bash
sudo ufw status verbose
```

If it is **inactive**, it is not the blocker; do not enable it just for this demo. If it is **active**, allow only your phone's actual local address to this port. Find that address in the phone's Wi-Fi network details. For example, if the phone is `192.168.1.45`:

```bash
sudo ufw allow from 192.168.1.45 to any port 5174 proto tcp comment 'Arzon phone demo'
```

Replace **192.168.1.45** with the phone's real address. Retry from the phone. Do not turn off the firewall or open all ports. When finished, remove only this rule:

```bash
sudo ufw delete allow from 192.168.1.45 to any port 5174 proto tcp
```

If your phone obtains a different address later, use the new address and remove the old rule. A host computer firewall can also matter when a VM uses forwarding; allow only TCP 5174 from that phone/local subnet rather than disabling the host firewall.

### If Ubuntu is inside VirtualBox, VMware or another VM

**Bridged network (simplest):** shut down Ubuntu normally. In the VM application's settings choose **Network → Bridged adapter/network**, select the host computer's active Wi-Fi/Ethernet adapter, then start Ubuntu. In VirtualBox this is **Settings → Network → Adapter 1 → Attached to: Bridged Adapter**; VMware has a comparable **Network Adapter → Bridged** option. The VM should get its own address on the same local network as the phone. Repeat `ip -brief -4 address show scope global` and use that VM address. Some Wi-Fi adapters/workplace networks do not allow bridging.

**If bridging is unavailable:** use the VM application's NAT **Port forwarding**. Forward host TCP port **5174** to guest TCP port **5174**, while Ubuntu's preview listens on `0.0.0.0`. Use the host computer's real local Wi-Fi address on the phone, not Ubuntu's internal NAT address. In VirtualBox: VM powered off → **Settings → Network → Adapter 1: NAT → Advanced → Port Forwarding → +** → Name `Arzon demo`, Protocol `TCP`, Host IP your host's Wi-Fi address, Host Port `5174`, Guest IP leave blank unless your VM requires its actual NAT address, Guest Port `5174`. Save and restart. Permit this one port from the phone in the host firewall if required. Remove the forwarding rule when finished. This is VM forwarding, **not Internet router port forwarding**.

### What ordinary local HTTP cannot prove

An ordinary `http://192.168…` phone address is not a secure browser context. Browser service workers/installability and camera APIs normally require HTTPS (or a browser's special same-device `localhost` exception, which does not apply to your phone reaching Ubuntu). Android/iPhone may offer a basic shortcut, but this is not proof of the intended installed standalone app. Use the HTTPS option below for that test. Do not disable browser security or accept a self-signed-certificate warning as the solution.

The current **Scan barcode** action focuses product search. A live camera barcode decoder is **not implemented**; HTTPS does not add it. You can type/search a barcode. **Take photo** uses the existing device file/camera picker where supported; its actual available choices depend on the phone browser. This is separate from live scanning.

## 3. Optional private HTTPS link with Cloudflare Pages and Access

Follow this section only when you choose to create a hosted demo. **Nothing here has already been created, deployed or tested against your account.** Use fictional data only. Cloudflare Pages hosts the built files; Cloudflare Access asks for an approved email before delivering them. The app still has its own local demo sign-in after that gate.

Choose the Pages free static-site plan and Cloudflare Zero Trust/Access Free for a small group (the requested under-50-user use case). Check the current [Cloudflare Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/) and [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) during setup: plans/seat limits may change. Confirm the chosen plan shows **$0**; do not select a paid upgrade, paid add-on or exceed the free allowance. The dashboard may ask for billing details even when selecting Free; read that screen before accepting. This guide creates no paid resource and does not authorize one.

The recommended first setup is **Direct Upload**: you build on Ubuntu and upload the finished folder yourself. It avoids automatic publishing before Access is verified. A Direct Upload project cannot later be converted to a Git-integrated project; Cloudflare requires a separate project for that. Later updates below are manual after merges, so no GitHub authorization/token or automatic deployment is needed.

### A. Create a harmless placeholder first

1. In a browser, open **https://dash.cloudflare.com**. Sign in to your own Cloudflare account or create one yourself. If you need Zero Trust onboarding, choose a team name and the **Free** plan. The developer has not done this for you.
2. On Ubuntu create a placeholder containing **none of the application**:

```bash
mkdir -p ~/arzon-placeholder
cat > ~/arzon-placeholder/index.html <<'HTML'
<!doctype html><html lang="en"><meta charset="utf-8"><title>Demo not published</title><h1>Demo not published</h1><p>Private access is being configured.</p></html>
HTML
```

3. Cloudflare dashboard → **Workers & Pages → Create application → Pages → Upload assets / Drag and drop your files**. Menu wording can vary; choose a **Pages Direct Upload** static project, not a Worker/paid plan.
4. Choose a unique project name such as `arzon-private-demo`. Drag the **arzon-placeholder** folder from Ubuntu Files into the upload box and deploy it. Note the actual generated address, such as **`arzon-private-demo.pages.dev`**. Cloudflare may add characters if the name is taken. Use your actual name everywhere below.
5. The harmless placeholder may be public while you configure Access. **Do not upload `prototype/dist` yet.** Do not share an application link until both hostname protections below are verified.

### B. Add the email-code sign-in method

1. Open **Zero Trust → Integrations → Identity providers** in Cloudflare. Add **One-time PIN** if it is not already listed. Cloudflare's current docs say new Zero Trust organizations may not add it automatically.
2. Use this email-code method for the demo applications. This is Cloudflare's email gate, **not the app's removed PIN pad**. Prototype sign-in stays username/password with its simulated privileged second step.
3. In the Access policies below, enter **only the exact email addresses you permit**, including your own. Do not use Everyone, an entire email domain, Bypass or Service Auth for the demo. Approved email users obtain one-use email codes; entering an unapproved address can show a generic “code sent” message without sending a code, so that message alone is not proof of authorization.

### C. Protect production and preview addresses separately

**Critical:** Pages' **Enable access policy** initially protects deployment **previews**, such as `hash.arzon-private-demo.pages.dev`. It does **not** by itself protect the parent production address `arzon-private-demo.pages.dev`. A wildcard `*.arzon-private-demo.pages.dev` does not include its parent. Cloudflare's official [Known issues: enable Access on pages.dev](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain) gives the production-plus-preview procedure.

1. **Workers & Pages → your Pages project → Settings → General → Enable access policy**. Open **Manage** for the generated Access application.
2. In **Zero Trust → Access controls → Applications**, open that application → **Configure**. Under **Public hostname**, remove the wildcard **`*`** from the Subdomain field so its hostname is exactly **`arzon-private-demo.pages.dev`**, with no path restriction. Rename it **Arzon demo — production** if needed, then save. Check the displayed full hostname carefully; do not accidentally protect only `/login` or another path.
3. Configure its policy: **Allow** → **Include → Emails** → your exact permitted addresses. Select **One-time PIN** as a login method. Remove any initial Cloudflare-team-only or broad policy you do not intend to retain. Do not leave an Everyone/Bypass rule. Use a short session duration you understand, such as 4 hours. Save.
4. Return to **Workers & Pages → your project → Settings → General** and **enable the access policy again**. This creates/recreates protection for the wildcard preview address while keeping production protection.
5. Back in **Access controls → Applications**, verify there are **two separate applications**:

| Application | Complete public hostname | Allowed people |
| --- | --- | --- |
| Arzon demo — production | `arzon-private-demo.pages.dev` | Your exact email list |
| Arzon demo — previews | `*.arzon-private-demo.pages.dev` | The same exact email list |

6. Configure the previews application's **Allow → Emails** and One-time PIN method just as for production, removing broad/team/bypass policies. A branch alias such as `review.arzon-private-demo.pages.dev` and every hash deployment URL must be covered by the preview policy. Keep production's parent separately protected.
7. Do not add a custom domain for this basic guide. If you later add one, it needs its own explicit Access application/policy; securing pages.dev alone does not secure every other address.

If the dashboard differs, use the linked official procedure and verify the **actual full hostnames and anonymous result**, not just the presence of an “enabled” label. Keep the harmless placeholder until protection is demonstrated. Do not work around a denial by adding Everyone or Bypass.

### D. Verify privacy before uploading the real build

1. In a **new private/incognito browser window**, open the production address. Expect the **Cloudflare email-code sign-in gate** before the placeholder, not direct content.
2. Open the actual hash-based deployment URL listed in **Pages → Deployments** in another new private window. Expect the same gate. If there is a branch preview alias, check that too. Treat every accessible hostname as an entry point.
3. Sign in using your allowed email and its code. Expect the harmless **Demo not published** page. In another clean private window, an email outside your Allow list must not reach the placeholder. You do not need to send anyone a message or ask them to test; use a separate address you control if available. An unapproved email's generic “code sent” notice alone is not proof it passed.
4. Optional technical confirmation from Ubuntu, without adding cookies or Access credentials:

```bash
curl -I https://arzon-private-demo.pages.dev
```

Replace the hostname. Expect a redirect to an Access sign-in page or access denial, not unrestricted application content. Test the actual preview hostname in the same way. Headers alone do not replace the clean-browser checks.

If **any** hostname serves the placeholder directly without the gate, stop here and fix that application's full hostname/policy. The production and previews must both be protected before the next section. An app demo password does not substitute for the requested private delivery gate.

### E. Upload the built fictional app

1. Confirm you are on the intended combined branch and build successfully on Ubuntu:

```bash
cd ~/Supermarket-Inventory
git branch --show-current
cd prototype
npm ci
npm run build
```

2. Open Ubuntu **Files → Home → Supermarket-Inventory → prototype → dist**. Expect `index.html`, the assets folder and generated public app/manifest/icon/offline files. Upload the **contents of this built dist folder** using the Pages upload step, not the source repository, `.git`, environment files, browser exports or real invoices. If Cloudflare asks for a folder, choose **dist** itself. The deployed root must contain `index.html`, not an extra `dist/index.html` level.
3. **Workers & Pages → your project → Create a new deployment → Production** → drag the built dist folder → **Save and Deploy**. Keep both Access applications enabled. If Cloudflare generated another preview/hash address, check it too.
4. Repeat the anonymous production/preview checks. Once allowed through Access, expect the real prototype sign-in. Sign in locally as manager, then use Demo switching for review. Test a direct static path such as `/manifest.webmanifest` (use the actual generated name) in a clean private window: it must also be gated, not only the front page.
5. Share the HTTPS production link **only with email addresses already in both Allow policies**. They receive their own Cloudflare gate, then their own separate demo data. Do not share your Cloudflare account password or email code.

### F. Install it on the Home Screen

Use the **HTTPS production address** on the phone and pass Cloudflare Access first. Check the normal prototype opens. The Access session and installed app may use different browser cookie contexts; if the installed app asks for Access again, use an allowed email. Do not disable protection to make installation work.

- **Android, Chrome:** open the site → Chrome **⋮ → Add to Home screen / Install app** → confirm. Some versions show an install icon or a banner instead. Return to the Home Screen and tap **Super Arzon**. Expect its own company icon and standalone app window. A mere browser bookmark is different from a standalone installation.
- **iPhone, Safari:** open the site in Safari → **Share → Add to Home Screen** → if offered, keep **Open as Web App** on → **Add**. Return to the Home Screen and tap **Super Arzon**. If Add to Home Screen is missing, open the link in Safari itself, not an email app's embedded browser. Names/menus vary by iOS version.

Check English/Persian, theme, Products and Received rows, People and task controls, bell and normal file/label flows. No actual Android/iPhone installation is claimed by Chromium phone-width or standalone emulation. Report the phone model, OS/browser version and what the real Home Screen launch did.

The live barcode decoder is still not built. HTTPS makes secure browser features available where supported; it does not make Scan barcode begin live scanning. Do not claim a camera test passed merely because the search field received focus.

### G. Check offline behavior and updates

After at least one successful online visit/worker installation, close and reopen the app while disconnected. Expect the small **No connection** page when navigation cannot fetch the app. Reconnect and choose **Try again**. This worker caches permitted public assets/offline content only; it does not cache a signed-in HTML page, server business responses, original documents or an Access login response. An already open app can retain its browser-local loaded data; that does not mean another phone or server received its changes.

To test an available new release, first finish or cancel any open form/unsaved work and complete file/printing operations. **Demo → Update app** is deliberate and must wait for genuine active work. Do not force-refresh while an invoice attachment/hash check, migration, print confirmation or save is in progress. The update preserves this browser's data; another URL/browser has separate records. A remote Access revocation cannot erase already downloaded public assets or local fictional records from a phone.

### H. Update the hosted app after merges to main

The four review branches are not automatically merged. Once you have approved them and they are merged C8 → E1 → E2 → E3, update the built site manually. Close the running preview with Ctrl+C and, from the repository, run:

```bash
cd ~/Supermarket-Inventory
git status --short
```

Continue only if that status shows no changed files. If it lists files, keep them and stop before switching branches. With a clean status, run:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
cd prototype
npm ci
npm run build
```

Expect a clean status, branch `main`, fast-forward update and successful build. If local files/history differ, keep them and the error; do not reset or discard. Run the current tests from section 1 if you want to verify this machine. Then **Pages → project → Create a new deployment → Production** and upload the new **dist** folder as above. Leave **both** Access applications/policies in place. Recheck unauthenticated production and preview access after every deployment, then verify the allowed person's app. Existing phones may show Update available; finish work before choosing Update app.

Direct Upload is intentionally manual in this guide. It does not start deploying every push to a review branch or require the developer to connect your GitHub account. If you later choose Git integration, configure a new project, `main` production branch, build root `prototype`, build command `npm run build`, output `dist`, supported Node22, and control preview branches. Protect that new project's actual production and preview hostnames with a placeholder before publishing the real app. That separate setup has not been performed here.

### I. Remove an email or turn the demo off

To remove a viewer, **Zero Trust → Access controls → Applications → each of the two applications → Policies** → remove that exact email from Allow → save. Check session controls/logs to revoke that user's existing Access sessions as available; policy/session changes do not delete a device's local prototype data. Also remove the email from any future custom-domain policy. Prototype People deactivation in one browser is not remote device revocation.

To take the whole link offline:

1. Stop uploading new builds. Keep both Access applications/policies active while content still exists.
2. **Workers & Pages → project → Settings → Delete project** (the exact menu may be under General). Read the project name/confirmation and delete **only this demo project**. If you prefer a temporary stop, keep the site behind a deny policy or deploy a harmless unavailable placeholder while preserving both gates; do not remove protection.
3. Verify production, hash/preview and any custom domain no longer serve the app in a clean browser. Delete related old preview deployments/project content as required by Cloudflare; a preview URL can outlive a newer branch alias until removed.
4. Only after the content/project is removed may you remove its two Access applications if you want to tidy the account. **Removing Access first can make an existing Pages site public.** If Git integration is ever used later, disable automatic builds and disconnect that project before removing protections.
5. Stop the local preview with Ctrl+C, remove only the temporary phone firewall/VM-forwarding rule you added, and remove the Home Screen shortcut if desired. Local data remains in each browser until its user clears that site's storage; never promise remote erasure.

## Official sources and what was verified

The guide uses Cloudflare's official documentation, including its Pages production/preview warning. The public websites were blocked by this development environment's network proxy during the read-only review; the corresponding official upstream repository files below were successfully read through the supported allowed GitHub route. Their response status and hashes are retained in [hosting source review](evidence/e3/hosting-source-review.json). This is documentation review, **not an executed Cloudflare deployment, policy validation or hardware-phone test**. Dashboard names, plans and hardware behavior can change; verify the actual displayed result.

- [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) — prebuild/folder upload and no later conversion to Git integration. [Official source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/get-started/direct-upload.mdx).
- [Preview deployment access](https://developers.cloudflare.com/pages/configuration/preview-deployments/) and [Known issues: production plus preview Access](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain) — previews public by default, parent production requires its own policy, re-enable wildcard preview after modifying the original. [Official source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/platform/known-issues.mdx).
- [One-time PIN identity provider](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/) — approved-email code login, no longer necessarily added by default, and generic sent message for blocked users. [Official source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/cloudflare-one/integrations/identity-providers/one-time-pin.mdx).
- [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) — Allow/Include selectors and policy scope. [Official source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/cloudflare-one/access-controls/policies/index.mdx).
- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) and [Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/) — check the live free allowance before setup; the pricing website itself could not be freshly fetched in this environment.
- [MDN secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts) and [Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — HTTPS/local exception, manifest and install behavior. [Official source](https://github.com/mdn/content/blob/main/files/en-us/web/progressive_web_apps/guides/making_pwas_installable/index.md).
- [Vite static deploy](https://vite.dev/guide/static-deploy.html) — build the static output and use preview for local verification. [Official source](https://github.com/vitejs/vite/blob/main/docs/guide/static-deploy.md).
