# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository is `backstage-templates` — a collection of Red Hat Developer Hub (RHDH) / Backstage Software Templates for bootstrapping applications on OpenShift.

## Repository structure

```
templates/
└── python-fastapi/
    ├── template.yaml           ← Backstage scaffolder template (register this in RHDH)
    ├── skeleton/code/          ← Rendered into the <appName>-code GitHub repo
    │   ├── main.py
    │   ├── requirements.txt
    │   ├── Dockerfile
    │   ├── .devfile.yaml       ← OpenShift Dev Spaces configuration
    │   ├── catalog-info.yaml   ← Backstage component descriptor
    │   └── README.md
    └── skeleton-k8/            ← Rendered into the <appName>-k8 GitHub repo
        ├── k8/gitops/          ← ArgoCD-managed resources (Kustomize)
        │   ├── deployment.yaml
        │   ├── service.yaml
        │   ├── route.yaml
        │   ├── pipeline.yaml   ← Tekton Pipeline (two-repo: code + k8)
        │   └── kustomization.yaml
        └── k8/app/             ← Reference / one-time resources
            ├── pipelinerun.yaml
            ├── triggerbinding.yaml
            ├── triggertemplate.yaml
            ├── eventlistener.yaml
            └── argocd-app.yaml

sample-app/rest-api/            ← Concrete working example the templates were based on
```

## Template conventions

- **Templating syntax**: Backstage uses `${{ values.xxx }}` (Nunjucks) in skeleton files. Kubernetes/Tekton `$(params.xxx)` and `$(tasks.xxx.results.xxx)` expressions are left as-is — they are not processed by Backstage.
- **Two-skeleton pattern**: Each template uses `fetch:template` with `targetPath` to render code and k8 skeletons into separate workspace subdirectories, then `publish:github` with `sourcePath` to push each to its own repo.
- **Namespace**: Created directly by `kubernetes:apply` in the template (not by ArgoCD) to avoid a chicken-and-egg on first sync.
- **Pipeline secret**: The `github-token` secret (key: `token`) must exist in the app namespace for the pipeline's `commit-and-push` task to write back to the k8 repo. The template creates it from the `githubToken` form parameter.
- **ArgoCD instance name**: The `argocd:create-resources` action uses `argoInstance: main` — update this if your RHDH ArgoCD instance has a different name.
- **ArgoCD app namespace**: ArgoCD Applications are created in `rhdh-gitops`. Update if your setup differs.

## Adding a new template

1. Create `templates/<name>/template.yaml` following the `python-fastapi` template as a reference.
2. Add code skeleton files under `templates/<name>/skeleton/code/`.
3. Add k8s skeleton files under `templates/<name>/skeleton-k8/`.
4. Register the template in RHDH by adding a `catalog-info.yaml` entry or pointing the RHDH `catalog.locations` config at this repo.
5. Update this file with any new conventions or structure introduced by the template.
