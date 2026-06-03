# ${{ values.appName }}-k8

Kubernetes / GitOps manifests for the `${{ values.appName }}` FastAPI service,
managed by **ArgoCD** and **Tekton** on OpenShift. This repo does not use GitHub Actions.

## Structure

```
k8/
├── gitops/                    # Synced by ArgoCD (path in the Application spec)
│   ├── namespace.yaml
│   ├── pipeline.yaml          # Tekton Pipeline
│   ├── triggerbinding.yaml
│   ├── triggertemplate.yaml
│   ├── eventlistener.yaml
│   ├── eventlistener-route.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── route.yaml
│   └── pipelinerun-initial.yaml   # ArgoCD PostSync – first build
└── app/
    ├── argocd-app.yaml        # Applied once by RHDH bootstrap (oc)
    └── pipelinerun.yaml       # Manual / reference PipelineRun
```

## Argo CD (OpenShift GitOps)

| | |
|--|--|
| Control plane | ArgoCD CR **`openshift-gitops`** in namespace **`openshift-gitops`** |
| Application CR | `Application/${{ values.appName }}` in **`openshift-gitops`** (created by `argocd:create-resources`) |
| Git source | This repo, path `k8/gitops`, branch `main` |
| Destination | Namespace **`${{ values.namespace }}`** on the cluster |

Reference manifest: `k8/app/argocd-app.yaml`.

OpenShift GitOps excludes `PipelineRun` / `TaskRun` from Argo CD reconciliation; the **Pipeline** and **EventListener** in `k8/gitops/` are still synced. Push-triggered runs are created by Tekton, not Argo CD.

## Tekton CI

On each push to `${{ values.appName }}-code`, the EventListener starts a PipelineRun that:

1. Builds an image in the internal registry (`image-registry.openshift-image-registry.svc:5000/${{ values.namespace }}/${{ values.appName }}`)
2. Updates `k8/gitops/deployment.yaml` in this repo
3. ArgoCD rolls out the new image

### Manual pipeline run

```bash
oc apply -f k8/app/pipelinerun.yaml -n ${{ values.namespace }}
```
