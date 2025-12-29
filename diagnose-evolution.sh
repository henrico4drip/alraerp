#!/bin/bash

echo "=== Evolution API Diagnostic ==="
echo ""
echo "1. Checking if Evolution API is running..."
curl -s http://84.247.143.180:8080/health 2>&1 | head -5
echo ""
echo ""

echo "2. Testing instance endpoint..."
curl -s -H "apikey: CHAVESECRETA" http://84.247.143.180:8080/instance/fetchInstances 2>&1 | head -10
echo ""
echo ""

echo "3. Checking Docker container status..."
echo "Run this on the server: docker ps | grep evolution"
echo ""
