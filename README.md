# Backstage Templates (RHDH)

Software templates for [Red Hat Developer Hub](https://developers.redhat.com/products/red-hat-developer-hub) (Backstage).

## Templates

| Template | Path | Description |
|----------|------|-------------|
| Python FastAPI | [`templates/python-fastapi`](templates/python-fastapi/template.yaml) | Two-repo FastAPI service with Tekton CI, ArgoCD GitOps, catalog registration, and Dev Spaces devfile |

Register this repo in RHDH via [`catalog-info.yaml`](catalog-info.yaml) (Location entity).

## Python FastAPI – what it provisions

When a developer runs the template:

1. **GitHub repos** – `<appName>-code` (FastAPI + `.devfile.yaml`) and `<appName>-k8` (manifests only; no CI workflows in GitHub)
2. **OpenShift namespace** – from the `namespace` parameter
3. **ArgoCD** – Application in `openshift-gitops` syncing `k8/gitops` from the k8 repo
4. **Tekton** – Pipeline, triggers, and EventListener managed by ArgoCD; initial build via ArgoCD **PostSync** hook; push builds via GitHub webhook
5. **Catalog** – Component with Kubernetes, ArgoCD, and Tekton annotations
6. **Image registry** – `image-registry.openshift-image-registry.svc:5000/<namespace>/<appName>`

Deployment and CI use **OpenShift GitOps (ArgoCD)** and **Tekton** only—not GitHub Actions.

## Prerequisites

### RHDH scaffolder pod

| Variable | Purpose |
|----------|---------|
| `TOKEN` | OpenShift API token (bootstrap `oc login`) |
| `SERVER` | OpenShift API URL |
| `GITHUB_PAT` | Tekton `github-token` secret and GitHub push webhook on the code repo |
| `oc` | OpenShift CLI in the scaffolder container image |

### RHDH scaffolder action

The template uses the **`run:command`** scaffolder action to execute `scripts/bootstrap-openshift.sh`. Enable it on your hub, for example:

```yaml
# app-config (example – adjust for your RHDH version)
backend:
  scaffolder:
    experimental:
      runCommandAction: true
```

Or install `@backstage/plugin-scaffolder-backend-module-run` if your version requires the module explicitly.

### Cluster

- **OpenShift GitOps** (ArgoCD) in `openshift-gitops`
- **OpenShift Pipelines** (Tekton)
- `pipeline` ServiceAccount and RBAC in new namespaces (cluster default or your pipeline setup)

### GitHub

RHDH GitHub integration for `publish:github` (create repos).

## Form parameters

| Field | Default |
|-------|---------|
| Application name | `my-rest-api` |
| GitHub org | `rhdh-developers` |
| Owner | `group:default/rhdh-developers` |
| Namespace | `my-rest-api` |

## Sample reference

[`sample-app/rest-api`](sample-app/rest-api) is the reference the skeletons were derived from.
