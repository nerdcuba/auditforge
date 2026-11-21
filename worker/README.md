# AuditForge worker (recon)

Claims jobs from the queue (`public.jobs`), **verifies the `scope_token` signature** with the
Ed25519 public key, checks it matches the job's target, runs **passive recon**, and submits findings
and logs through the `worker` schema RPCs. It has no direct table access and never accepts a target
as a loose parameter.

In this version it only does **recon/passive**. `active` mode is safely rejected (not executed):
Claude-BugHunter's intrusive skills come later, once verification and isolation are solid (see the
repo README, phases 2→4).

## Integration with Claude-BugHunter

The worker **orchestrates** the pack (it does not reimplement exploits). The seam lives in
`src/engagement.ts`: it runs an external command (the driver `scripts/engagement.sh`) in an isolated
working directory and reads findings from the contract file (`auditforge-findings.json`, schema
`auditforge.findings/1`).

- To install the pack into the image, build with `--build-arg PACK_COMMIT=<reviewed sha>`
  (see `Dockerfile`): it clones the repo and installs `cbh`. **Pin a commit you've reviewed.**
- Enable the pack by setting `ENGAGEMENT_CMD=/app/scripts/engagement.sh`. Without that variable the
  worker uses its internal passive recon (`src/recon.ts`).
- The exact mapping from `cbh recon` output to the contract is finalized on the deployed worker
  (it depends on the real `manifest.json`/`live-hosts.json` schema of the commit you pin).

Credit: **Sachin Sharma / Claude-BugHunter** (MIT · CC BY 4.0). See `NOTICE`.

## Isolation (required)

Deploy the worker on a **dedicated server or VM** registered in Coolify: no Docker socket, no
privileges, with an **egress firewall**, no LAN access. Treat it as a red zone: it runs an offensive
tool with your Claude key. The worker's own SSRF guard (`src/net.ts`) is defense in depth, not a
replacement for the host firewall.

## Environment variables

See `.env.example`. The worker uses the `auditforge_worker` role (never the service role) and only
the **public** signing key (never the private one).

## Development

```bash
npm install
npm run build
node dist/index.js
```
