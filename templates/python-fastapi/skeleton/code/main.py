from fastapi import FastAPI

app = FastAPI(
    title="${{ values.appName }}",
    description="FastAPI REST API service scaffolded by RHDH",
    version="0.1.0",
)


@app.get("/api/v1/hello")
def hello():
    return {"message": "hello world", "service": "${{ values.appName }}"}


@app.get("/health")
def health():
    return {"status": "ok"}
