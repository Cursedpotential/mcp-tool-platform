# Use the official Python 3.11 slim image as the base image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install necessary packages
RUN pip install --no-cache-dir graphiti-core fastapi uvicorn neo4j openai

# Copy the application code into the container
COPY main.py .

# Expose the port that the application will listen on
EXPOSE 8080

# Define the command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl --fail http://localhost:8080/health || exit 1