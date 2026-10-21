# Repository setup

Maintainer: **Ramprasad Atluri** (GitHub: **ATLURI0001**).
Target repository assumed for this archive: **ATLURI0001/IronArc**.
Project name: **IronArc**. No Git history or remote configuration is included.

## Run from the extracted directory

Install Docker with Compose, then:

```bash
cp .env.example .env
docker compose up -d --build
```

Open http://localhost:8080. The first run downloads exercise media and dependencies.
Set your own HTTPS hostname in `.env` before enabling remote passkey login.
The optional AI Coach requires your own provider account and configuration.
No credentials, signing keys, signed APKs, or installed dependencies are included.

## Push to GitHub

Create an empty repository named `IronArc` in your account. From the extracted directory:

```bash
git init -b main
git add .
git commit -m "Initialize maintained IronArc distribution"
git remote add origin https://github.com/ATLURI0001/IronArc.git
git push -u origin main
```

These commands assume the target repository is empty. If you choose a different name,
update `ATLURI0001/IronArc` references before pushing. No repository has been created
or pushed by this task.

## Optional publishing

- Enable Issues and Discussions in repository settings for support links.
- For the browser demo, choose Settings > Pages > Source > GitHub Actions, then run
  the Pages workflow. Its expected URL is https://atluri0001.github.io/IronArc/.
- The `website/` directory contains a separate static landing site. It is not deployed
  by the demo workflow. Choose your hosting and canonical URL before deploying it.
- The container workflow uses the GitHub repository owner and publishes to
  `ghcr.io/atluri0001/ironarc-api` and `ghcr.io/atluri0001/ironarc-web`.
  Allow Actions package writes and choose package visibility as needed. Local Compose
  builds from source, so images need not exist before first use.
- Android/Capacitor/iOS IDs are `dev.ramprasadatluri.ironarc`. Android Java source was
  moved to the matching package directory. Set your own iOS signing team in Xcode.
  See `docs/MOBILE.md` to build and sign with your own keys. This ID represents a new
  application; it does not replace an installed app using the upstream application ID.
- Android download links point to your Releases page; publish a signed APK there before
  advertising a download. Demo links require Pages setup.

## Attribution and changes

The original AGPL license, upstream copyright, app-store exception, and third-party
notices are retained. This is a maintained derivative, not a transfer of the original
code's copyright. See `NOTICE.md`. Upstream changelog entries remain marked as inherited.
Donation configuration and the original maintainer's personal biography were removed.
Links, website metadata, support destinations, package metadata, mobile identifiers,
and container defaults were adapted for this maintainer. The shared API test fixture now
uses recent dates instead of fixed July dates. API CI installs its declared dependencies.

See `VALIDATION.md` for checks and limitations of this prepared source archive.

## Rename compatibility

IronArc retains existing `gym_*` browser storage keys, `opengym-state.json` on-device
storage, the `opengym_plan` exchange-format marker, and the encryption derivation context.
This keeps existing backups, shared plans, and stored Coach credentials compatible.
New backup downloads and visible branding use IronArc. The native application identifier
is `dev.ramprasadatluri.ironarc`, so export/import is needed when moving data from a
separately installed app with another identifier. The Docker Compose project name is now
`ironarc`; for an existing installation, stop the old stack before starting this one on
the same ports. Existing bind-mounted `data/` and `media/` directories remain usable.

The inherited strategy PDF, planning documents, historical changelog, and feature
screenshots retain their original project name as historical material.
