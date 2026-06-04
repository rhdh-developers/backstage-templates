# Backstage Templates (RHDH)

Software templates for [Red Hat Developer Hub](https://developers.redhat.com/products/red-hat-developer-hub) (Backstage).

## Templates

| Template | Path | Description |
|----------|------|-------------|
| Python FastAPI | [`templates/python-fastapi`](templates/python-fastapi/template.yaml) | Two-repo FastAPI service with Tekton CI, Argo CD GitOps, catalog registration, and Dev Spaces devfile |

Register this repo in RHDH via [`catalog-info.yaml`](catalog-info.yaml) (Location entity).

## Python FastAPI – what it provisions

When a developer runs the template:

1. **GitHub repos** – `<appName>-code` and `<appName>-k8` (no GitHub Actions workflows)
2. **Argo CD Application** – via `argocd:create-resources` (syncs `k8/gitops` into an existing namespace)
3. **Tekton** – Pipeline, triggers, EventListener (synced by Argo CD); first build via `k8/app/pipelinerun.yaml`
4. **Catalog** – Component with Kubernetes, Argo CD, and Tekton annotations
5. **Image registry** – `image-registry.openshift-image-registry.svc:5000/<namespace>/<appName>`

### Prerequisite: namespace exists

The template does **not** create the OpenShift project. **OpenShift Namespace** on the form is the deployment target; **Application Name** is only for repos and resource names (they may differ, e.g. app `my-rest-api-125` in namespace `my-rest-api`). A cluster admin creates the namespace before developers run the template:

```bash
export NAMESPACE=my-rest-api
oc create namespace "$NAMESPACE"
oc label namespace "$NAMESPACE" argocd.argoproj.io/managed-by=openshift-gitops
```

After the template run, apply `k8/app/argocd-app.yaml` from the k8 repo so the live Application CR includes `ignoreDifferences` for the Namespace (Roadie `argocd:create-resources` does not set that field).

Deployment and CI use **OpenShift GitOps (Argo CD)** and **Tekton** only.

## OpenShift GitOps layout (this cluster)

| Item | Value |
|------|--------|
| Argo CD operator CR | `argoproj.io/v1beta1` / `ArgoCD` named **`openshift-gitops`** |
| Operator / control plane namespace | **`openshift-gitops`** |
| Application CRs (per app) | `Application/<appName>` in **`openshift-gitops`** |
| Synced manifests (git path) | `<app>-k8` repo → `k8/gitops/` |
| Workload namespace (destination) | Template parameter **`namespace`** — must **already exist** |
| Recommended namespace label | `argocd.argoproj.io/managed-by=openshift-gitops` |

OpenShift GitOps is configured with **resource exclusions** for `tekton.dev/PipelineRun` and `TaskRun`. Argo CD still syncs the Tekton **Pipeline**, **EventListener**, and other gitops resources; CI runs are not continuously reconciled by Argo CD (expected). The first build is started with `oc create -f k8/app/pipelinerun.yaml`; later runs come from the GitHub webhook → EventListener.

### RHDH Argo CD instance name (template form)

| Concept | On your cluster |
|---------|-----------------|
| OpenShift GitOps **ArgoCD CR** + namespace | `openshift-gitops` |
| Template field **RHDH Argo CD instance name** | Must match an `instances[].name` already configured on your Developer Hub (Roadie `argocd:create-resources` lookup). **Not** the OpenShift GitOps CR name. |

Use the exact instance name from your hub’s existing Argo CD plugin configuration. The template sets `argocd/instance-name` on the catalog component to the same value.

Application CRs are created on the cluster in namespace **`openshift-gitops`** regardless of that RHDH instance label.

## Required scaffolder actions

The template must find these actions under **Create → Actions** in Developer Hub:

| Action | Purpose |
|--------|---------|
| `publish:github` | Create repos |
| `argocd:create-resources` | Register Argo CD Application for the k8 repo |
| `catalog:register` | Register the component |

If `argocd:create-resources` is missing, enable the Argo CD scaffolder module on Developer Hub (see [RH Argo CD plugin docs](https://docs.redhat.com/en/documentation/red_hat_plug-ins_for_backstage/2.0/html/argocd_plugin_for_backstage/argocd-plugin-for-backstage)). This repo does not ship RHDH configuration files.

## One-time secrets and webhook (per app)

Tekton needs a `github-token` secret (push to the k8 repo) and `github-webhook-secret` (EventListener). These are **not** stored in Git. After the template run, a cluster admin runs:

```bash
export NAMESPACE=my-rest-api
export GITHUB_PAT=<pat-with-repo-scope>

oc create secret generic github-token \
  --from-literal=token="$GITHUB_PAT" -n "$NAMESPACE" --dry-run=client -o yaml | oc apply -f -

WEBHOOK_SECRET=$(openssl rand -hex 20)
oc create secret generic github-webhook-secret \
  --from-literal=secret="$WEBHOOK_SECRET" -n "$NAMESPACE" --dry-run=client -o yaml | oc apply -f -
```

Add a GitHub **push** webhook on `<app>-code` with the EventListener URL from:

```bash
oc get route "el-<app>-listener" -n "$NAMESPACE" -o jsonpath='https://{.spec.host}{"\n"}'
```

## Form parameters

| Field | Default |
|-------|---------|
| Application name | `my-rest-api` (unique per app; repos and K8s object names) |
| GitHub org | `rhdh-developers` |
| Owner | `group:default/rhdh-developers` |
| OpenShift namespace | `my-rest-api` (shared deployment target; must already exist) |
| RHDH Argo CD instance name | `default` on this hub (`instances[].name` in Argo CD plugin config) |

## GitHub: protected `main` branch (GH006)

If `git push origin main` fails with **Changes must be made through a pull request**, the org has branch protection on `main`. Use a feature branch and merge via PR; the merge still triggers Tekton (push event on `main`).

The pipeline’s `commit-and-push` task pushes to **`*-k8`** `main`. The `github-token` secret must use an identity allowed to update protected `main` on that repo (bypass list or relaxed rules), or pipeline commits will fail with the same error.

## Troubleshooting: Pipeline / EventListener missing in Argo CD

If **TriggerBinding** and **TriggerTemplate** are synced but **Pipeline** and **EventListener** never appear in the cluster, Argo CD is usually stuck on **sync waves**: an unhealthy **Deployment** (e.g. `ImagePullBackOff` before the first build) in wave 0 blocks later waves.

This template keeps Tekton at **wave 0** and the app **Deployment/Service/Route** at **wave 1**. For an existing k8 repo, merge the wave changes from this template repo, push to `main`, then sync (or re-apply `k8/app/argocd-app.yaml` for `ignoreDifferences`).

Verify on the cluster:

```bash
oc get pipeline,eventlistener -n <namespace>
oc get application <appName> -n openshift-gitops -o jsonpath='{.status.sync.status}{"\n"}'
```

One-off apply if you need CI before git sync catches up:

```bash
oc apply -f k8/gitops/pipeline.yaml -f k8/gitops/eventlistener.yaml -n <namespace>
```

## Repository layout

| Path | Purpose |
|------|---------|
| [`catalog-info.yaml`](catalog-info.yaml) | Backstage Location → registers the template |
| [`templates/python-fastapi/template.yaml`](templates/python-fastapi/template.yaml) | Scaffolder template |
| [`templates/python-fastapi/skeleton/code/`](templates/python-fastapi/skeleton/code/) | Published as `<app>-code` |
| [`templates/python-fastapi/skeleton-k8/k8/gitops/`](templates/python-fastapi/skeleton-k8/k8/gitops/) | Argo CD sync path in `<app>-k8` |
| [`templates/python-fastapi/skeleton-k8/k8/app/`](templates/python-fastapi/skeleton-k8/k8/app/) | Manual `argocd-app.yaml` and `pipelinerun.yaml` only |
