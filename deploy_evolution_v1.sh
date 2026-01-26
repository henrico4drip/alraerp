#!/bin/bash

echo "=== Deploying Evolution API v1.7.4 ==="

# Stop and remove existing container
docker stop evolution-api 2>/dev/null
docker rm evolution-api 2>/dev/null

# Deploy v1.7.4 (works without database)
docker run -d \
  --name evolution-api \
  --restart always \
  -p 8080:8080 \
  -v evolution_data:/evolution/instances \
  -e AUTHENTICATION_API_KEY=Henrico9516 \
  -e AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true \
  atendai/evolution-api:v1.7.4

echo "Waiting for API to start..."
sleep 10

echo ""
echo "=== Container Status ==="
docker ps | grep evolution

echo ""
echo "=== API Logs ==="
docker logs evolution-api --tail 20

echo ""
echo "=== Testing API Key ==="
curl -s http://localhost:8080/instance/fetchInstances -H "apikey: Henrico9516"

echo ""
echo "=== Complete ==="
