# ${{ values.appName }}

Python FastAPI REST API service scaffolded by Red Hat Developer Hub.

## Repositories

| Repo | Purpose |
|------|---------|
| [`${{ values.appName }}-code`](https://github.com/${{ values.githubOrg }}/${{ values.appName }}-code) | Source code (this repo) |
| [`${{ values.appName }}-k8`](https://github.com/${{ values.githubOrg }}/${{ values.appName }}-k8) | Kubernetes / GitOps manifests |

## Local development

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

API available at <http://localhost:8000>.  
Auto-generated docs at <http://localhost:8000/docs>.

## Dev Spaces

Open this repo directly in OpenShift Dev Spaces using the factory URL:

```
https://<your-devspaces-host>/f?url=https://github.com/${{ values.githubOrg }}/${{ values.appName }}-code
```

The Dev Spaces host is the route exposed by the OpenShift Dev Spaces operator in your cluster.

## CI/CD

Pushes to `main` trigger a Tekton pipeline that:

1. Clones this repo and builds a container image with Buildah.
2. Pushes the image to the internal OpenShift image registry.
3. Updates `k8/gitops/deployment.yaml` in the k8 repo with the new image digest.
4. ArgoCD detects the change and rolls out the new deployment.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/hello` | Hello world response |
| GET | `/health` | Health check |
