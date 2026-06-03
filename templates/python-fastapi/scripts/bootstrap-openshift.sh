#!/usr/bin/env bash
# Bootstrap OpenShift after the k8 repo is published.
# Runs in the RHDH scaffolder pod; requires oc and cluster credentials:
#   TOKEN, SERVER  – OpenShift API (set in the RHDH pod)
#   GITHUB_PAT     – optional; used for github-token secret and code-repo webhook
#   APP_NAME, NAMESPACE, GITHUB_ORG – passed from the template step

set -euo pipefail

: "${TOKEN:?TOKEN must be set in the RHDH scaffolder pod}"
: "${SERVER:?SERVER must be set in the RHDH scaffolder pod}"
: "${APP_NAME:?APP_NAME is required}"
: "${NAMESPACE:?NAMESPACE is required}"
: "${GITHUB_ORG:?GITHUB_ORG is required}"

WORKSPACE="${WORKSPACE:-.}"
ARGOCD_APP="${WORKSPACE}/k8/k8/app/argocd-app.yaml"

if ! command -v oc >/dev/null 2>&1; then
  echo "ERROR: oc CLI not found in the scaffolder container" >&2
  exit 1
fi

echo "Logging in to OpenShift..."
oc login "$SERVER" --token="$TOKEN" --insecure-skip-tls-verify=true

echo "Ensuring namespace ${NAMESPACE} exists..."
oc new-project "${NAMESPACE}" 2>/dev/null || echo "Namespace ${NAMESPACE} already exists"
oc label namespace "${NAMESPACE}" \
  argocd.argoproj.io/managed-by=openshift-gitops \
  --overwrite

if [[ ! -f "${ARGOCD_APP}" ]]; then
  echo "ERROR: ArgoCD Application manifest not found at ${ARGOCD_APP}" >&2
  exit 1
fi

echo "Creating ArgoCD Application for ${APP_NAME}..."
oc apply -f "${ARGOCD_APP}"

if [[ -n "${GITHUB_PAT:-}" ]]; then
  echo "Creating github-token secret in ${NAMESPACE}..."
  oc create secret generic github-token \
    --from-literal=token="${GITHUB_PAT}" \
    -n "${NAMESPACE}" \
    --dry-run=client -o yaml | oc apply -f -
else
  echo "WARNING: GITHUB_PAT not set; skipping github-token secret (Tekton cannot push to the k8 repo)"
fi

WEBHOOK_SECRET="$(openssl rand -hex 20)"
echo "Creating github-webhook-secret in ${NAMESPACE}..."
oc create secret generic github-webhook-secret \
  --from-literal=secret="${WEBHOOK_SECRET}" \
  -n "${NAMESPACE}" \
  --dry-run=client -o yaml | oc apply -f -

echo "Waiting for ArgoCD to sync Tekton Pipeline ${APP_NAME} (up to 5 minutes)..."
for i in $(seq 1 30); do
  if oc get pipeline "${APP_NAME}" -n "${NAMESPACE}" &>/dev/null; then
    echo "Pipeline found after $((i * 10))s"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "WARNING: Pipeline not found; ArgoCD may still be syncing gitops manifests"
  fi
  sleep 10
done

echo "Waiting for EventListener route el-${APP_NAME}-listener (up to 5 minutes)..."
for i in $(seq 1 30); do
  if oc get route "el-${APP_NAME}-listener" -n "${NAMESPACE}" &>/dev/null; then
    echo "Route found after $((i * 10))s"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "WARNING: EventListener route not found; configure the GitHub webhook manually"
    exit 0
  fi
  sleep 10
done

if [[ -n "${GITHUB_PAT:-}" ]]; then
  LISTENER_URL="$(oc get route "el-${APP_NAME}-listener" -n "${NAMESPACE}" -o jsonpath='https://{.spec.host}')"
  REPO="${GITHUB_ORG}/${APP_NAME}-code"
  echo "Registering GitHub push webhook on ${REPO}..."
  PAYLOAD="$(jq -n \
    --arg url "${LISTENER_URL}" \
    --arg secret "${WEBHOOK_SECRET}" \
    '{name: "web", active: true, events: ["push"], config: {url: $url, content_type: "json", insecure_ssl: "0", secret: $secret}}')"
  HTTP_CODE="$(curl -sS -o /tmp/gh-hook-response.json -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer ${GITHUB_PAT}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${REPO}/hooks" \
    -d "${PAYLOAD}")"
  if [[ "${HTTP_CODE}" -ge 200 && "${HTTP_CODE}" -lt 300 ]]; then
    echo "GitHub webhook created: ${LISTENER_URL}"
  else
    echo "WARNING: GitHub webhook creation returned HTTP ${HTTP_CODE}"
    cat /tmp/gh-hook-response.json >&2
  fi
fi

echo "Bootstrap complete. ArgoCD PostSync hook will start the initial Tekton PipelineRun when sync finishes."
