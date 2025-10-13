FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose Flask port
EXPOSE 5050

# Enable Flask debug mode
ENV FLASK_ENV=development
ENV FLASK_APP=app.py

# Run Flask app
CMD ["python", "app.py"]
