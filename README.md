# backstage-templates

A collection of [Red Hat Developer Hub](https://developers.redhat.com/rhdh) (RHDH) / [Backstage](https://backstage.io) Software Templates for bootstrapping production-ready applications on OpenShift.

## Available templates

| Template | Description |
|----------|-------------|
| [python-fastapi](templates/python-fastapi/template.yaml) | Python FastAPI REST API with Tekton CI, ArgoCD GitOps, and OpenShift Dev Spaces support |

---

## What the `python-fastapi` template does

When a developer selects this template and fills in the form, Developer Hub will:

1. **Create two GitHub repos** in the specified org:
   - `<appName>-code` — FastAPI source code, Dockerfile, and a Dev Spaces devfile
   - `<appName>-k8` — Kubernetes manifests (Deployment, Service, Route, Tekton Pipeline) managed by ArgoCD via Kustomize
2. **Create an OpenShift namespace** named `<appName>`
3. **Deploy the application** via ArgoCD (syncs automatically from the k8 repo)
4. **Create the Tekton Pipeline** and start an initial PipelineRun that builds the container image and deploys it
5. **Set up Tekton Triggers** (EventListener, TriggerTemplate, TriggerBinding) so future pushes to the code repo trigger new builds automatically via a GitHub webhook
6. **Register a Backstage catalog component** with tabs for ArgoCD sync status, Kubernetes pod health, Tekton pipeline runs, and links to source code, deployment manifests, and Dev Spaces

### Form parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| Application Name | `my-rest-api` | Base name used for repos, namespace, and all K8s resources |
| GitHub Organization | `rhdh-developers` | Org where both repos are created |
| Owner | — | Backstage user or group that owns the component |
| Cluster Router Base | `apps.cluster.example.com` | OpenShift wildcard domain, used to construct Dev Spaces and webhook URLs |
| GitHub Token | — | Personal Access Token (repo read/write) stored as a K8s secret so the pipeline can push updated image digests back to the k8 repo |

---

## Adding these templates to Red Hat Developer Hub

### Option 1 — Static location in `app-config` (simplest)

Add a catalog location pointing directly at the template file(s) in this repo.

```yaml
# app-config.yaml or app-config-rhdh.yaml
catalog:
  locations:
    - type: url
      target: https://github.com/<your-org>/backstage-templates/blob/main/templates/python-fastapi/template.yaml
      rules:
        - allow: [Template]
```

Restart (or reload) RHDH. The template will appear under **Create → Choose a template**.

### Option 2 — Catalog entity file (recommended for multiple templates)

Add a `catalog-info.yaml` at the root of this repo that lists all templates, then register that single URL.

1. Create `catalog-info.yaml` at the root:

   ```yaml
   apiVersion: backstage.io/v1alpha1
   kind: Location
   metadata:
     name: backstage-templates
     description: RHDH Software Templates
   spec:
     targets:
       - ./templates/python-fastapi/template.yaml
       # add more templates here
   ```

2. Register the location in `app-config`:

   ```yaml
   catalog:
     locations:
       - type: url
         target: https://github.com/<your-org>/backstage-templates/blob/main/catalog-info.yaml
         rules:
           - allow: [Location, Template]
   ```

### Option 3 — Register via the RHDH UI (ad-hoc)

1. In Developer Hub, go to **Catalog → Register Existing Component**.
2. Paste the raw GitHub URL of `template.yaml`:
   ```
   https://github.com/<your-org>/backstage-templates/blob/main/templates/python-fastapi/template.yaml
   ```
3. Click **Analyze** then **Import**.

---

## Prerequisites

The following must be configured in your OpenShift / RHDH environment before using these templates:

| Requirement | Notes |
|-------------|-------|
| GitHub integration | `integrations.github` configured in `app-config` with a token or GitHub App |
| ArgoCD plugin | `argocd:create-resources` scaffolder action available; `argoInstance: main` configured |
| Kubernetes plugin | `kubernetes:apply` scaffolder action available |
| OpenShift Pipelines | Tekton operator installed; `git-clone` and `buildah` cluster tasks available in `openshift-pipelines` namespace |
| OpenShift GitOps | ArgoCD instance running; applications land in `rhdh-gitops` namespace by default |
| `pipeline` ServiceAccount | Must exist in each new app namespace with rights to push to the internal image registry |

### ArgoCD instance name

The template uses `argoInstance: main`. If your RHDH ArgoCD instance has a different name, update the `create-argocd-app` step in [template.yaml](templates/python-fastapi/template.yaml).

### GitHub webhook (manual step after scaffolding)

The EventListener Route is created by the template, but the GitHub webhook must be added manually:

1. Get the EventListener URL:
   ```bash
   oc get route el-<appName>-listener -n <appName> -o jsonpath='https://{.spec.host}'
   ```
2. Go to **Settings → Webhooks → Add webhook** on the `<appName>-code` repo.
3. Set **Payload URL** to the route above, **Content type** to `application/json`, and enter your webhook secret.
4. Store that secret in the namespace:
   ```bash
   oc create secret generic github-webhook-secret \
     --from-literal=secret=<your-webhook-secret> \
     -n <appName>
   ```

---

## Repository structure

```
templates/
└── python-fastapi/
    ├── template.yaml           ← Register this URL in RHDH
    ├── skeleton/code/          ← Rendered into <appName>-code
    └── skeleton-k8/            ← Rendered into <appName>-k8

sample-app/rest-api/            ← Working reference app the templates are based on
```

## Contributing

To add a new template, follow the conventions documented in [CLAUDE.md](CLAUDE.md).
