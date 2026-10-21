# IronArc validation

Checked on 2026-10-21 with Node v24.19.0 and npm 11.9.0.
The project's Docker and CI configurations use Node 22.

- Frontend: 207 tests passed across 8 test files.
- API: 56 tests passed across 4 test files after dependency installation.
- Frontend production build: passed. The existing large-bundle warning remains.
- Locale consistency: 11 translated locales, 781 keys each, in sync.
- Generated AI Coach catalogue: in sync, 1,324 exercises.
- API startup and HTTP `/api/health`: passed with a temporary data directory.
- Native app identifiers and Java package paths: checked for consistency.
- Rebranding: visible app names, all locale keys, repository/Pages links, package names,
  containers, Android/iOS/Capacitor identifiers, and SVG/PNG banner updated to IronArc.
- Original LICENSE file: preserved byte-for-byte.
- ZIP integrity and source inventory: checked during packaging.

Docker is unavailable in this environment. Full container builds, real provider sign-in,
passkey registration, live GitHub workflows, Android/iOS compilation, and mobile signing
were not tested. GitHub Pages, Releases, and GHCR links require repository publishing
and configuration by the maintainer. Dependencies and exercise media are downloaded
at install/build or first run and are not included in this source archive.

Historical documents and screenshots retain upstream naming. Backup and plan format
identifiers and the Coach encryption context remain unchanged for compatibility.
