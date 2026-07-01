FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install fastapi uvicorn requests --quiet
EXPOSE 8083
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8083"]
