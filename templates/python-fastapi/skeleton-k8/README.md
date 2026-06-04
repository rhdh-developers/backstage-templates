# ${{ values.appName }}-k8

Kubernetes / GitOps manifests for the `${{ values.appName }}` FastAPI service,
managed by **ArgoCD** and **Tekton** on OpenShift. This repo does not use GitHub Actions.

## Structure

```
k8/
├── gitops/                    # Synced by Argo CD (Application path: k8/gitops)
│   ├── pipeline.yaml          # Tekton Pipeline
│   ├── triggerbinding.yaml
│   ├── triggertemplate.yaml
│   ├── eventlistener.yaml
│   ├── eventlistener-route.yaml
│   ├── deployment.yaml        # sync wave 1 (after Tekton)
│   ├── service.yaml
│   └── route.yaml
└── app/                       # Not synced by Argo CD — apply manually
    ├── argocd-app.yaml        # ignoreDifferences for Namespace (merge after template)
    └── pipelinerun.yaml       # First build (`oc create -f`; generateName)
```

The OpenShift namespace must exist before the template run (`oc create namespace` + label). It is not defined in git.

## Argo CD (OpenShift GitOps)

| | |
|--|--|
| Control plane | ArgoCD CR **`openshift-gitops`** in namespace **`openshift-gitops`** |
| Application CR | `Application/${{ values.appName }}` in **`openshift-gitops`** (created by `argocd:create-resources`) |
| Git source | This repo, path `k8/gitops`, branch `main` (no Namespace in kustomization) |
| Destination | Existing namespace **`${{ values.namespace }}`** (form field; app name **`${{ values.appName }}`** may differ) |

Reference manifest: `k8/app/argocd-app.yaml` includes `ignoreDifferences` for the Namespace. After the template run, merge it onto the cluster Application:

```bash
oc apply -f k8/app/argocd-app.yaml -n openshift-gitops
```

OpenShift GitOps excludes `PipelineRun` / `TaskRun` from Argo CD reconciliation; the **Pipeline** and **EventListener** in `k8/gitops/` are still synced (wave 0, before the app Deployment at wave 1). Push-triggered runs are created by Tekton, not Argo CD.

## Tekton CI

On each push to `${{ values.appName }}-code`, the EventListener starts a PipelineRun that:

1. Builds an image in the internal registry (`image-registry.openshift-image-registry.svc:5000/${{ values.namespace }}/${{ values.appName }}`)
2. Updates `k8/gitops/deployment.yaml` in this repo
3. ArgoCD rolls out the new image

### Manual pipeline run

```bash
oc apply -f k8/app/pipelinerun.yaml -n ${{ values.namespace }}
```
