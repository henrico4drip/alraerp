#!/bin/bash

echo "=== Evolution API Key Tester ==="
echo ""

# Array de possíveis API keys para testar
API_KEYS=(
    "Henrico9516"
    "THISISMYSECURETOKEN"
    "CHAVESECRETA"
    ""
)

echo "Testing API keys..."
echo ""

for key in "${API_KEYS[@]}"; do
    echo "Testing key: '$key'"
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:8080/instance/fetchInstances -H "apikey: $key" 2>&1)
    http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
    body=$(echo "$response" | grep -v "HTTP_CODE")
    
    echo "  HTTP Code: $http_code"
    echo "  Response: $body"
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "  ✅ SUCCESS! This key works!"
        echo ""
        echo "=== Working Configuration ==="
        echo "API Key: $key"
        echo "Response: $body"
        exit 0
    fi
    echo ""
done

echo "❌ None of the tested keys worked."
echo ""
echo "Checking container environment variables:"
docker exec evolution-api env | grep -i auth
