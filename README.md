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
2. **Argo CD Application** – via `argocd:create-resources` (syncs `k8/gitops`, including Namespace on first sync)
3. **Tekton** – Pipeline, triggers, EventListener (synced by Argo CD); first build via `k8/app/pipelinerun.yaml`
4. **Catalog** – Component with Kubernetes, Argo CD, and Tekton annotations
5. **Image registry** – `image-registry.openshift-image-registry.svc:5000/<namespace>/<appName>`

After the template run, apply `k8/app/argocd-app.yaml` from the k8 repo so the live Application CR includes `ignoreDifferences` for the Namespace (Roadie `argocd:create-resources` does not set that field).

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

The **Kubernetes backend** plugin (`K8S_CLUSTER_*` / service account) powers the catalog **Kubernetes** tab only. It does **not** authenticate the scaffolder action `kubernetes:create-namespace`, which always requires an explicit `token` in the template. This template creates the OpenShift project via **Argo CD** (`k8/gitops/namespace.yaml`) instead, with `ignoreDifferences` on the Application so Argo CD does not keep reconciling the Namespace after the first sync.

If you later want a scaffolder step to create namespaces, enable [RH Kubernetes custom actions](https://docs.redhat.com/en/documentation/red_hat_developer_hub/1.9/html/configuring_dynamic_plugins/kubernetes-custom-actions-in-rhdh_install-the-topology-plugin) and supply a token (form secret or `scaffolder.defaultEnvironment.secrets` from the pod `TOKEN` env).

If `argocd:create-resources` is missing, enable the Argo CD scaffolder module on Developer Hub (see [RH Argo CD plugin docs](https://docs.redhat.com/en/documentation/red_hat_plug-ins_for_backstage/2.0/html/argocd_plugin_for_backstage/argocd-plugin-for-backstage)). This repo does not ship RHDH configuration files.

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
| RHDH Argo CD instance name | `default` on this hub (`instances[].name` in Argo CD plugin config) |

## Optional: `run:command` bootstrap script

[`templates/python-fastapi/scripts/bootstrap-openshift.sh`](templates/python-fastapi/scripts/bootstrap-openshift.sh) can automate secrets and webhooks via `oc` in the RHDH pod if you install the scaffolder **run:command** module. It is not used by the template by default.

## Sample reference

[`sample-app/rest-api`](sample-app/rest-api) is the reference the skeletons were derived from.
