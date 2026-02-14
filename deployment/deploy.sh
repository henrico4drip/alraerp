#!/bin/bash

# --- CONFIGURAÇÃO ---
SERVER_IP="84.247.143.180"
EVOLUTION_KEY="mypassy"

# --- CORES ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}>>> INICIANDO SETUP DEPLOYMENT (v2.0)${NC}"

# 1. Gerar Senhas Seguras (se não existirem)
PG_PASS=$(openssl rand -hex 16)
REDIS_PASS=$(openssl rand -hex 16)
SECRET_KEY=$(openssl rand -hex 64)

echo -e "${YELLOW}>>> Gerando .env...${NC}"

cat <<EOF > .env
# --- GENERATED ENV ---
POSTGRES_PASSWORD=$PG_PASS
REDIS_PASSWORD=$REDIS_PASS
SECRET_KEY_BASE=$SECRET_KEY

# --- CHATWOOT ---
FRONTEND_URL=http://$SERVER_IP:3000
MAILER_SENDER_EMAIL=noreply@$SERVER_IP
SMTP_ADDRESS=127.0.0.1
SMTP_PORT=1025
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DATABASE=chatwoot_production
POSTGRES_USERNAME=chatwoot
REDIS_URL=redis://:$REDIS_PASS@redis:6379

# --- EVOLUTION ---
EVOLUTION_API_URL=http://$SERVER_IP:8080
EVOLUTION_API_KEY=$EVOLUTION_KEY
EOF

# 2. Subir Containers
echo -e "${YELLOW}>>> Iniciando Containers...${NC}"
docker compose down
docker compose up -d

# 3. Preparar Banco de Dados
echo -e "${YELLOW}>>> Preparando Banco de Dados Chatwoot (Aguarde 15s)...${NC}"
sleep 15
docker compose exec -T rails bundle exec rails db:chatwoot_prepare

echo -e "${GREEN}>>> SETUP CONCLUÍDO!${NC}"
echo -e "Acesse Chatwoot: http://$SERVER_IP:3000"
echo -e "Acesse Evolution: http://$SERVER_IP:8080"
echo -e "Use as credenciais do .env:"
echo -e "Evolution Key: $EVOLUTION_KEY"
