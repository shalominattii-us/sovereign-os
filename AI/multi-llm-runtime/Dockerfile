FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install requests fastapi uvicorn --quiet
EXPOSE 8082
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8082"]
