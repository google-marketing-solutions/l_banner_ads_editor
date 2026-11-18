# L-Banner Ads Editor

**L-Banner Ads Editor** is a client-side (zero-backend, stateless) web
application that enables advertisers and creative agencies to design,
batch-generate, and export **1920x1080 L-Banner (L-Band) video ad variations**
directly in the browser.

[![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://ssh.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https://github.com/google-marketing-solutions/l_banner_ads_editor&cloudshell_tutorial=README.md)

**This is not an officially supported Google product.**

Eligibility for the
[Google Open Source Software Vulnerability Rewards Program](https://bughunters.google.com/open-source-security)
is determined by the
[Google Open Source Software Vulnerability Reward Program Rules](https://bughunters.google.com/about/rules/open-source/google-open-source-software-vulnerability-reward-program-rules).

--------------------------------------------------------------------------------

## Key Capabilities

1.  **Interactive L-Banner Canvas Editor (`1920x1080` FHD)**
    -   Configurable L-shape orientation (**Left & Bottom** or **Right &
        Bottom**), panel widths/heights, background colors, and multi-logo asset
        placement.
    -   Full Japanese typography support (**Horizontal `横書き`** & **Vertical
        `縦書き`** Tategaki rendering with automatic punctuation rotation, optical
        kerning, and auto-fit font sizing).
    -   Built-in Google Fonts preloading (`Noto Sans JP`, `M PLUS Rounded 1c`,
        `Noto Serif JP`, `BIZ UDPGothic`) plus custom `.ttf` / `.otf` / `.woff`
        upload.
2.  **Batch Creative Variation Spreadsheet & Optional Gemini 3+ Copy
    Generation**
    -   Manage dozens of creative variations in a spreadsheet table with
        per-cell font size and font family overrides.
    -   Bidirectional **CSV Import / Export** (UTF-8 BOM compatible with Excel
        and Google Sheets).
    -   Optional **AI Ad Copy Generation** powered by the **Gemini 3+ REST API**
        (`gemini-3.8-flash` default) using a user-supplied Google AI Studio API
        key stored strictly in browser `localStorage`.
3.  **Dual Export Modes**
    -   **Transparent Cutout PNG (`ZIP`)**: Exports `1920x1080` L-Banner frames
        with a transparent (`alpha = 0`) video cutout window for external NLE
        compositing.
    -   **Composite MP4 Video Rendering (`WebCodecs` + `mp4-muxer`)**:
        Hardware-accelerated browser-side H.264/AAC MP4 compositing
        (`1920x1080 @ 30fps`) with customizable video scaling and positioning
        inside the cutout window.

--------------------------------------------------------------------------------

## Architecture & Privacy (Stateless Client-Side SPA)

-   **Zero Backend Storage**: All image/video decoding, HTML5 Canvas 2D
    compositing, and WebCodecs MP4 encoding run 100% inside the user's local
    browser memory. No creative assets, videos, or PII are uploaded to a backend
    server.
-   **Bring-Your-Own-Key (BYOK) Gemini Integration**: When using the optional AI
    copy generator, the browser communicates directly with
    `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
    Users can clear their API key from `localStorage` at any time via the
    **Clear Key** button.

--------------------------------------------------------------------------------

## Quick Start (Local Development)

### Prerequisites

-   Node.js `20+` and `npm`
-   Google Chrome `114+` or Microsoft Edge `114+` (required for `WebCodecs`
    hardware MP4 encoding)

```bash
npm install
npm run dev
```

To build the static production bundle (`dist/`):

```bash
npm run build
```

--------------------------------------------------------------------------------

## Self-Service Deployment to Google Cloud Platform (GCP)

You can deploy the static application to your own GCP project using either
**Firebase Hosting** (recommended for zero-maintenance global CDN) or **Cloud
Run** (recommended when restricting access to internal corporate Google Accounts
via **Identity-Aware Proxy (IAP)**).

### Option A: Deploy to Firebase Hosting (Recommended)

```bash
chmod +x deploy.sh
./deploy.sh --project=YOUR_GCP_PROJECT_ID --mode=firebase
```

### Option B: Deploy to Cloud Run (Internal Access with Cloud IAP)

```bash
chmod +x deploy.sh
./deploy.sh --project=YOUR_GCP_PROJECT_ID --mode=cloudrun --region=asia-northeast1
```

After deploying to Cloud Run, you can enable **Identity-Aware Proxy (IAP)** on
the Cloud Run service in the Google Cloud Console to restrict access to specific
Google Workspace domains or IAM groups without modifying application code.

--------------------------------------------------------------------------------

## License & Experimental Software Disclaimer

Copyright 2026 Google LLC. Licensed under the
[Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0). See
[LICENSE](LICENSE).

> **Experimental Notice**: This software is an experimental prototype provided
> on an **"AS IS"** basis, without warranties or conditions of any kind, either
> express or implied. Users are solely responsible for reviewing and verifying
> all generated ad copy, typography, and video outputs for brand safety,
> regulatory compliance, and accuracy prior to use in live advertising
> campaigns.
