#!/bin/bash

echo "=== Evolution API Setup Script ==="
echo ""
echo "This script will:"
echo "1. Stop WPPConnect container"
echo "2. Install Evolution API on port 8080"
echo "3. Configure with API Key: Henrico9516"
echo ""

# Stop WPPConnect
echo "Stopping WPPConnect..."
docker stop wppconnect 2>/dev/null || echo "WPPConnect not running"

# Pull Evolution API
echo "Pulling Evolution API image..."
docker pull atendai/evolution-api:v2.1.1

# Create Evolution API container
echo "Creating Evolution API container..."
docker run -d \
  --name evolution-api \
  --restart always \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=Henrico9516 \
  -e AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true \
  -e QRCODE_LIMIT=30 \
  -e INSTANCE_EXPIRATION_TIME=false \
  atendai/evolution-api:v2.1.1

echo ""
echo "Waiting for Evolution API to start..."
sleep 5

echo ""
echo "Checking status..."
docker ps | grep evolution

echo ""
echo "Testing API..."
curl -s http://localhost:8080/instance/fetchInstances -H "apikey: Henrico9516" | head -20

echo ""
echo "=== Setup Complete ==="
