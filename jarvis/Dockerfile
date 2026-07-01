FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir requests

COPY jarvis_binding.py .

CMD ["python", "jarvis_binding.py"]
