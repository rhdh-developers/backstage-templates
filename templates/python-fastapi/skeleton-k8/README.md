# ${{ values.appName }}-k8

Kubernetes / GitOps manifests for the `${{ values.appName }}` FastAPI service,
scaffolded by Red Hat Developer Hub.

## Structure

```
k8/
├── gitops/              # ArgoCD-managed resources (synced automatically)
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── route.yaml
│   ├── pipeline.yaml    # Tekton Pipeline (kept in-sync by ArgoCD)
│   └── kustomization.yaml
└── app/                 # Reference / one-time resources
    ├── pipelinerun.yaml   # Template for manual pipeline runs
    ├── triggerbinding.yaml
    ├── triggertemplate.yaml
    ├── eventlistener.yaml # EventListener + Route for GitHub webhook
    └── argocd-app.yaml    # Reference copy of the ArgoCD Application
```

## ArgoCD

ArgoCD watches the `k8/gitops/` directory in this repo and automatically
syncs any changes to the `${{ values.appName }}` namespace on OpenShift.

Source repo: `https://github.com/${{ values.githubOrg }}/${{ values.appName }}-k8`

## Tekton CI

The `k8/gitops/pipeline.yaml` pipeline:

1. Clones `${{ values.appName }}-code` and builds a container image with Buildah.
2. Clones this repo, updates `k8/gitops/deployment.yaml` with the new image digest.
3. Commits and pushes back, triggering an ArgoCD sync and rolling deployment.

### GitHub Webhook setup

After the RHDH template creates the EventListener Route, add a webhook to the
`${{ values.appName }}-code` repo:

1. Go to **Settings → Webhooks → Add webhook** on the code repo.
2. Payload URL: get it with
   ```
   oc get route el-${{ values.appName }}-listener -n ${{ values.appName }} -o jsonpath='https://{.spec.host}'
   ```
3. Content type: `application/json`
4. Secret: the value in the `github-webhook-secret` Kubernetes Secret (`secret` key).
5. Trigger: **Just the push event**.

### Manual pipeline run

```bash
oc apply -f k8/app/pipelinerun.yaml -n ${{ values.appName }}
```
