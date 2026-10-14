FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY requirements.txt ./requirements.txt
RUN uv pip install --system -r requirements.txt

COPY . ./backend/

RUN python -c "import site; p = site.getsitepackages()[0] + '/sitecustomize.py'; open(p, 'w').write('try:\n    import google.adk.tools as _gt\n    def tool(fn=None):\n        return fn if callable(fn) else (lambda f: f)\n    def BuiltInTool(n):\n        return getattr(_gt, n, n)\n    _gt.tool = tool\n    _gt.BuiltInTool = BuiltInTool\nexcept Exception:\n    pass\n')"

ENV PYTHONPATH=/app:/app/backend:/app/backend/packages
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "exec uvicorn backend.services.api_gateway.main:app --host 0.0.0.0 --port ${PORT:-8080}"]