# Backstage Templates (RHDH)

Software templates for [Red Hat Developer Hub](https://developers.redhat.com/products/red-hat-developer-hub) (Backstage).

## Templates

| Template | Path | Description |
|----------|------|-------------|
| Python FastAPI | [`templates/python-fastapi`](templates/python-fastapi/template.yaml) | Two-repo FastAPI service with Tekton CI, ArgoCD GitOps, catalog registration, and Dev Spaces devfile |

Register this repo in RHDH via [`catalog-info.yaml`](catalog-info.yaml) (Location entity).

## Python FastAPI – what it provisions

When a developer runs the template:

1. **GitHub repos** – `<appName>-code` (FastAPI + `.devfile.yaml`) and `<appName>-k8` (manifests + bootstrap workflow)
2. **OpenShift namespace** – from the `namespace` parameter (default `my-rest-api`)
3. **ArgoCD** – Application syncing `k8/gitops` from the k8 repo
4. **Tekton** – Pipeline in the namespace; push webhook on the code repo; initial PipelineRun
5. **Catalog** – Component with links to source, manifests, and Dev Spaces; annotations for Kubernetes, ArgoCD, and Tekton plugins
6. **Image registry** – Internal OpenShift registry: `image-registry.openshift-image-registry.svc:5000/<namespace>/<appName>`

## Prerequisites (cluster / org)

Map the environment variables from the RHDH pod to **GitHub organization secrets** used by the bootstrap workflow in each new `<app>-k8` repo:

| GitHub org secret | RHDH pod env | Purpose |
|-------------------|--------------|---------|
| `OPENSHIFT_SERVER` | `SERVER` | OpenShift API URL |
| `OPENSHIFT_TOKEN` | `TOKEN` | Cluster admin token |
| `GITHUB_PAT` | `GITHUB_PAT` | Cross-repo git push and webhook creation (recommended) |

RHDH itself needs a **GitHub integration** (e.g. GitHub App or PAT) for `publish:github` and `github:actions:dispatch`.

### Optional: bootstrap from RHDH directly

The template uses a **GitHub Actions** bootstrap workflow so OpenShift credentials stay in org secrets rather than in the scaffolder task workspace. To run bootstrap from RHDH using `TOKEN` / `SERVER` in the pod, add a custom scaffolder action (e.g. `@backstage-community/plugin-scaffolder-backend-module-openshift` or an internal action) and replace the `github:actions:dispatch` step in `template.yaml`.

## Form parameters

| Field | Default |
|-------|---------|
| Application name | `my-rest-api` |
| GitHub org | `rhdh-developers` |
| Owner | `group:default/rhdh-developers` |
| Namespace | `my-rest-api` |

## Sample reference

The [`sample-app/rest-api`](sample-app/rest-api) directory is the reference implementation the skeletons were derived from.
