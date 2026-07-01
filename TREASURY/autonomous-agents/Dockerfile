FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install requests --quiet
CMD ["python", "treasury_agent.py"]
