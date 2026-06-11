# ${{ values.appName }}

${{ values.appName }} is a Python FastAPI REST API service, scaffolded from the
Red Hat Developer Hub `python-fastapi` template.

## Overview

- **Language / Framework:** Python 3, FastAPI, Uvicorn
- **Source repo:** [`${{ values.appName }}-code`](https://github.com/${{ values.githubOrg }}/${{ values.appName }}-code)
- **Deployment manifests:** [`${{ values.appName }}-k8`](https://github.com/${{ values.githubOrg }}/${{ values.appName }}-k8)
- **OpenShift namespace:** `${{ values.namespace }}`
- **Argo CD instance:** `${{ values.argoInstance }}`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/hello` | Hello world response |
| GET | `/health` | Health check |

Once deployed:

- Base URL: `https://${{ values.appName }}.${{ values.gateway }}/api/v1/`
- Interactive docs (Swagger UI): `https://${{ values.appName }}.${{ values.gateway }}/docs`
- OpenAPI schema: `https://${{ values.appName }}.${{ values.gateway }}/openapi.json`

## Local Development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The app runs at <http://localhost:8000>, with Swagger UI at `/docs` and the
OpenAPI schema at `/openapi.json`.

## Dev Spaces

This repo includes a `.devfile.yaml` for OpenShift Dev Spaces. On workspace
start it automatically creates a virtualenv and installs dependencies. Use
the **Run the application** command to start the dev server.

## Deployment

Pushes to `main` trigger a Tekton pipeline that builds a container image and
updates the image reference in [`${{ values.appName }}-k8`](https://github.com/${{ values.githubOrg }}/${{ values.appName }}-k8).
Argo CD (instance `${{ values.argoInstance }}`) then syncs the updated
manifests into the `${{ values.namespace }}` namespace.

## Adding Endpoints

New routes go in `main.py`. FastAPI automatically generates OpenAPI docs from
type hints — see the [FastAPI documentation](https://fastapi.tiangolo.com/)
for patterns such as path/query parameters, request bodies with Pydantic
models, and dependency injection.
