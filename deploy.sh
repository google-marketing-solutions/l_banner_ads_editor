#!/bin/bash
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Deploys L-Banner Ads Editor to a customer GCP project via Firebase Hosting
# or Cloud Run.

set -euo pipefail

readonly DEFAULT_MODE="firebase"
readonly DEFAULT_REGION="asia-northeast1"
readonly DEFAULT_SERVICE="l-banner-ads-editor"

usage() {
  cat <<EOF
Usage: $0 --project=<GCP_PROJECT_ID> [--mode=firebase|cloudrun] [--region=<REGION>] [--service=<SERVICE_NAME>]
EOF
}

main() {
  local project_id=""
  local mode="${DEFAULT_MODE}"
  local region="${DEFAULT_REGION}"
  local service_name="${DEFAULT_SERVICE}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --project=*)
        project_id="${1#*=}"
        shift
        ;;
      --mode=*)
        mode="${1#*=}"
        shift
        ;;
      --region=*)
        region="${1#*=}"
        shift
        ;;
      --service=*)
        service_name="${1#*=}"
        shift
        ;;
      --help|-h)
        usage
        return 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        usage >&2
        return 1
        ;;
    esac
  done

  if [[ -z "${project_id}" ]]; then
    echo "Error: --project=<GCP_PROJECT_ID> is required." >&2
    usage >&2
    return 1
  fi

  if [[ "${mode}" == "firebase" ]]; then
    if [[ -f "package-lock.json" ]]; then
      npm ci
    else
      npm install
    fi
    npm run build
    npx firebase-tools deploy --only hosting --project "${project_id}"
  elif [[ "${mode}" == "cloudrun" ]]; then
    gcloud run deploy "${service_name}" \
      --project "${project_id}" \
      --source . \
      --region "${region}" \
      --platform managed \
      --allow-unauthenticated
  else
    echo "Error: Unsupported mode '${mode}'. Expected 'firebase' or 'cloudrun'." >&2
    return 1
  fi
}

main "$@"
