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
2. **Argo CD Application** – via scaffolder action `argocd:create-resources` (syncs `k8/gitops`)
3. **Tekton** – Pipeline, triggers, EventListener (synced by Argo CD); first build via Argo CD **PostSync** hook
4. **Catalog** – Component with Kubernetes, Argo CD, and Tekton annotations
5. **Image registry** – `image-registry.openshift-image-registry.svc:5000/<namespace>/<appName>`

Deployment and CI use **OpenShift GitOps (Argo CD)** and **Tekton** only.

## OpenShift GitOps layout (this cluster)

| Item | Value |
|------|--------|
| Argo CD operator CR | `argoproj.io/v1beta1` / `ArgoCD` named **`openshift-gitops`** |
| Operator / control plane namespace | **`openshift-gitops`** |
| Application CRs (per app) | `Application/<appName>` in **`openshift-gitops`** |
| Synced manifests (git path) | `<app>-k8` repo → `k8/gitops/` |
| Workload namespace (destination) | Template parameter **`namespace`** (e.g. `my-rest-api`) |
| Namespace label | `argocd.argoproj.io/managed-by=openshift-gitops` |

OpenShift GitOps is configured with **resource exclusions** for `tekton.dev/PipelineRun` and `TaskRun`. Argo CD still syncs the Tekton **Pipeline**, **EventListener**, and other gitops resources; CI runs are not continuously reconciled by Argo CD (expected). The template uses a **PostSync** hook for the first `PipelineRun`; later runs come from the GitHub webhook → EventListener.

### RHDH `app-config` (Argo CD plugin)

Point the scaffolder and UI at the same instance (name must match template default **`openshift-gitops`**):

```yaml
argocd:
  username: ${ARGOCD_USERNAME}
  password: ${ARGOCD_PASSWORD}
  appLocatorMethods:
    - type: config
      instances:
        - name: openshift-gitops
          url: https://openshift-gitops-server-openshift-gitops.apps.<cluster>.<domain>
```

Use your cluster route host from `oc get argocd openshift-gitops -n openshift-gitops -o jsonpath='{.status.host}'`.

## Required scaffolder actions

The template must find these actions under **Create → Actions** in Developer Hub:

| Action | Purpose |
|--------|---------|
| `publish:github` | Create repos |
| `argocd:create-resources` | Register Argo CD Application for the k8 repo |
| `catalog:register` | Register the component |

If `argocd:create-resources` is missing, enable the **Argo CD** dynamic plugin / scaffolder module on RHDH and configure `argocd` in `app-config` (see [RH Argo CD plugin docs](https://docs.redhat.com/en/documentation/red_hat_plug-ins_for_backstage/2.0/html/argocd_plugin_for_backstage/argocd-plugin-for-backstage)). The template **Argo CD instance** is **`openshift-gitops`**, matching the ArgoCD CR in namespace **`openshift-gitops`**.

### Alternative: cluster ApplicationSet (no `argocd:create-resources`)

If you cannot enable the Argo CD scaffolder action, install [`cluster/applicationset-python-fastapi.yaml`](cluster/applicationset-python-fastapi.yaml) once on the cluster and remove the `create-argocd-app` step from `template.yaml`. Argo CD will discover new `*-k8` repos automatically.

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
| Application name | `my-rest-api` |
| GitHub org | `rhdh-developers` |
| Owner | `group:default/rhdh-developers` |
| Namespace | `my-rest-api` |
| Argo CD instance | `openshift-gitops` |

## Optional: `run:command` bootstrap script

[`templates/python-fastapi/scripts/bootstrap-openshift.sh`](templates/python-fastapi/scripts/bootstrap-openshift.sh) can automate secrets and webhooks via `oc` in the RHDH pod if you install the scaffolder **run:command** module. It is not used by the template by default.

## Sample reference

[`sample-app/rest-api`](sample-app/rest-api) is the reference the skeletons were derived from.
