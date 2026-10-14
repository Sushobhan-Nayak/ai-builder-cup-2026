FROM python:3.12-slim

WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast, reliable package installs
RUN pip install --no-cache-dir uv

# Copy requirements and install
COPY backend/requirements.txt ./requirements.txt
RUN uv pip install --system -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Setup sitecustomize to ensure ADK 2.0 tool compatibility in the container
RUN python -c "import site; p = site.getsitepackages()[0] + '/sitecustomize.py'; open(p, 'w').write('try:\n    import google.adk.tools as _gt\n    def tool(fn=None):\n        return fn if callable(fn) else (lambda f: f)\n    def BuiltInTool(n):\n        return getattr(_gt, n, n)\n    _gt.tool = tool\n    _gt.BuiltInTool = BuiltInTool\nexcept Exception:\n    pass\n')"

# Configure python path and runtime environment
ENV PYTHONPATH=/app:/app/backend:/app/backend/packages
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

EXPOSE 8080

# Default entrypoint starts the API Gateway BFF
CMD ["sh", "-c", "exec uvicorn backend.services.api_gateway.main:app --host 0.0.0.0 --port ${PORT:-8080}"]

