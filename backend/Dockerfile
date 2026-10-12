# Use a slim Python 3.12 image as requested
FROM python:3.12-slim AS builder

WORKDIR /app

# Install uv for fast dependency management
RUN pip install uv

# Copy dependency requirements
COPY pyproject.toml .
# Assuming a standard pyproject.toml or requirements.txt exists
RUN uv pip install --system -r pyproject.toml

# Copy the shared core package and the specific service code
COPY packages/ packages/
COPY services/ services/
COPY config/ config/
COPY mcp/ mcp/

# Set Python path to resolve gembaos_core
ENV PYTHONPATH=/app/packages:/app

# Default command (overridden by Cloud Build per service)
CMD ["uvicorn", "services.api_gateway.main:app", "--host", "0.0.0.0", "--port", "8080"]