# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository is `backstage-templates` — a collection of Red Hat Developer Hub (RHDH) / Backstage Software Templates for bootstrapping applications on OpenShift.

## Repository structure

```
templates/
└── python-fastapi/
    ├── template.yaml                    ← Backstage scaffolder template (register this in RHDH)
    ├── skeleton/code/                   ← Rendered into <appName>-code GitHub repo
    │   ├── main.py
    │   ├── requirements.txt
    │   ├── Dockerfile
    │   ├── .devfile.yaml               ← OpenShift Dev Spaces configuration
    │   ├── catalog-info.yaml           ← Backstage component descriptor
    │   └── README.md
    └── skeleton-k8/                    ← Rendered into <appName>-k8 GitHub repo
        ├── .github/workflows/
        │   └── bootstrap.yaml          ← GH Actions workflow: creates namespace, secret, PipelineRun
        ├── k8/bootstrap/               ← (unused — kept for reference)
        │   ├── namespace.yaml
        │   └── kustomization.yaml
        ├── k8/gitops/                  ← ArgoCD-managed resources (Kustomize)
        │   ├── namespace.yaml
        │   ├── deployment.yaml
        │   ├── service.yaml
        │   ├── route.yaml
        │   ├── pipeline.yaml           ← Tekton Pipeline (two-repo design)
        │   ├── triggerbinding.yaml
        │   ├── triggertemplate.yaml
        │   ├── eventlistener.yaml
        │   ├── eventlistener-route.yaml
        │   └── kustomization.yaml
        └── k8/app/                     ← Reference / one-time resources
            ├── pipelinerun.yaml
            ├── triggerbinding.yaml
            ├── triggertemplate.yaml
            ├── eventlistener.yaml
            └── argocd-app.yaml

sample-app/rest-api/                    ← Working reference app the templates were based on
```

## Cluster environment (demo cluster)

| Item | Value |
|------|-------|
| RHDH URL | `https://backstage-developer-hub-rhdh.apps.cluster-psnpv.psnpv.sandbox1507.opentlc.com` |
| OpenShift API | `https://api.cluster-psnpv.psnpv.sandbox1507.opentlc.com:6443` |
| ArgoCD instance | `openshift-gitops` (namespace: `openshift-gitops`) |
| ArgoCD instance name in RHDH | `default` (set in `argocd.appLocatorMethods.instances[0].name`) |
| GitHub org | `rhdh-developers` |
| RHDH auth | Keycloak OIDC (not GitHub OAuth — `USER_OAUTH_TOKEN` is a Keycloak token, not a GitHub PAT) |
| Git user | `bugbiteme` |

## Template conventions

- **Templating syntax**: Backstage uses `${{ values.xxx }}` in skeleton files (Nunjucks). Kubernetes/Tekton `$(params.xxx)` and `$(tasks.xxx.results.xxx)` are NOT processed by Backstage — leave them as-is.
- **Two-skeleton pattern**: `fetch:template` with `targetPath` renders code and k8 skeletons into separate workspace dirs; `publish:github` with `sourcePath` pushes each to its own repo.
- **`argoInstance`**: Must be `default` (confirmed from app-config-rhdh.yaml).
- **ArgoCD app namespace**: `openshift-gitops` (where the ArgoCD Application resource lives).
- **`argocd.argoproj.io/managed-by` label**: Must be `openshift-gitops` on the namespace for ArgoCD to get admin rights there.
- **Roadie ArgoCD plugin behaviour**: `argocd:create-resources` always creates a NEW AppProject named after the app. Setting `projectName: default` causes "Duplicate project" error. The auto-created project only allows namespace-scoped resources — Namespace (cluster-scoped) cannot be in `k8/gitops/kustomization.yaml`.
- **`namespace.yaml` is NOT in kustomization.yaml**: The namespace is created by the bootstrap GitHub Actions workflow instead (see below).
- **Pipeline is two-repo**: Clones the code repo to build the image, then clones the k8 repo separately to update `deployment.yaml` with the new image digest and push back.
- **`github-token` secret**: The Tekton pipeline needs this in the app namespace (key: `token`) to push image digests back to the k8 repo. Created by the bootstrap workflow using the built-in `GITHUB_TOKEN` (which has write access to the k8 repo it runs from).

## Actions available in this RHDH instance

| Action | Status | Notes |
|--------|--------|-------|
| `fetch:template` | ✅ works | |
| `publish:github` | ✅ works | |
| `argocd:create-resources` | ✅ works | Roadie plugin; always creates a new AppProject |
| `catalog:register` | ✅ works | |
| `github:actions:dispatch` | ✅ expected | From `backstage-plugin-scaffolder-backend-module-github-dynamic` |
| `kubernetes:apply` | ❌ not registered | Plugin `backstage-community-plugin-scaffolder-backend-module-kubernetes-dynamic` v2.13.0 installs but action does not register — likely a RHDH dynamic module compatibility issue |
| `roadiehq:utils:http:request` | ⚠️ installed | From `roadiehq-scaffolder-backend-module-http-request-dynamic`; not yet tested |

## Dynamic plugins (relevant)

Bundled at `/opt/app-root/src/dynamic-plugins/dist/`:

```
backstage-community-plugin-scaffolder-backend-module-kubernetes-dynamic  ← installed but kubernetes:apply not registering
backstage-plugin-scaffolder-backend-module-github-dynamic                ← provides publish:github, github:actions:dispatch
roadiehq-scaffolder-backend-argocd-dynamic                              ← provides argocd:create-resources
roadiehq-scaffolder-backend-module-http-request-dynamic                 ← provides roadiehq:utils:http:request
backstage-plugin-kubernetes-backend-dynamic                             ← Kubernetes plugin backend (read-only catalog)
```

## Bootstrap workflow (automation workaround)

Because `kubernetes:apply` does not register in this RHDH instance, cluster resource creation is delegated to a GitHub Actions workflow at `.github/workflows/bootstrap.yaml` in the k8 repo skeleton.

The template dispatches it via `github:actions:dispatch` immediately after publishing the k8 repo.

**The workflow does:**
1. Logs into OpenShift using org-level GitHub secrets
2. `oc new-project <appName>` + labels the namespace with `argocd.argoproj.io/managed-by=openshift-gitops`
3. Creates the `github-token` Kubernetes secret using the built-in `GITHUB_TOKEN`
4. Waits up to 5 min for ArgoCD to sync the Tekton Pipeline resource
5. Starts the initial PipelineRun

**Required GitHub org secrets (one-time admin setup):**

```bash
# Create a dedicated service account
oc create sa rhdh-bootstrap -n rhdh
oc adm policy add-cluster-role-to-user cluster-admin -z rhdh-bootstrap -n rhdh
oc create token rhdh-bootstrap -n rhdh --duration=8760h
# → store output as GitHub org secret: OPENSHIFT_TOKEN
# → store the API URL as GitHub org secret: OPENSHIFT_SERVER
#   value: https://api.cluster-psnpv.psnpv.sandbox1507.opentlc.com:6443
```

## Still to do / known gaps

- **`github:actions:dispatch` not yet tested** — confirm it works in this RHDH instance on next session.
- **GitHub webhook for Tekton** — still a manual step. After ArgoCD syncs the EventListener Route, the developer must:
  1. `oc get route el-<appName>-listener -n <appName> -o jsonpath='https://{.spec.host}'`
  2. `oc create secret generic github-webhook-secret --from-literal=secret=<random> -n <appName>`
  3. Add the webhook in GitHub pointing at that URL.
- **`kubernetes:apply` root cause** — the `backstage-community-plugin-scaffolder-backend-module-kubernetes-dynamic` v2.13.0 plugin installs but the action is never registered. Worth investigating whether this is a new-backend-system vs old-backend-system mismatch in RHDH.
- **ArgoCD `namespace.yaml` exclusion** — `namespace.yaml` is intentionally absent from `k8/gitops/kustomization.yaml` because the Roadie auto-created AppProject blocks cluster-scoped resources. The bootstrap workflow creates the namespace instead. If `kubernetes:apply` is fixed later, namespace creation can move back into the template and `namespace.yaml` can be re-added to kustomization.
- **`k8/bootstrap/` directory** — created during debugging; now unused. Can be deleted.

## Adding a new template

1. Create `templates/<name>/template.yaml` following `python-fastapi` as a reference.
2. Add code skeleton under `templates/<name>/skeleton/code/`.
3. Add k8s skeleton under `templates/<name>/skeleton-k8/`.
4. Include `.github/workflows/bootstrap.yaml` in the k8 skeleton (or adapt the bootstrap pattern).
5. Register the template in RHDH via `catalog.locations` in `app-config-rhdh.yaml`.
6. Update this file with any new conventions.
