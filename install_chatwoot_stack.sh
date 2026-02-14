#!/bin/bash

# --- CONFIGURAÇÃO (IP MODE) ---
SERVER_IP="84.247.143.180"
ADMIN_EMAIL="henrico.pierdona@gmail.com"
ADMIN_PASSWORD="Henrico9516" 
POSTGRES_PASSWORD="DB_PASSWORD_SECURE_123"
REDIS_PASSWORD="REDIS_PASSWORD_SECURE_123"

# --- CORES ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}>>> ATUALIZANDO INSTALAÇÃO (FIX DATABASE CONNECTION)${NC}"

# 1. Diretorios
mkdir -p /opt/chatwoot_stack
cd /opt/chatwoot_stack

# 2. Env (Garantindo POSTGRES_HOST)
cat <<EOF > .env
# --- CHATWOOT ---
FRONTEND_URL=http://$SERVER_IP:3000
secret_key_base=$(openssl rand -hex 64)
# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DATABASE=chatwoot_production
POSTGRES_USERNAME=chatwoot
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
# Redis
REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379
REDIS_PASSWORD=$REDIS_PASSWORD
# Email (Fake SMTP)
MAILER_SENDER_EMAIL=noreply@$SERVER_IP
SMTP_ADDRESS=127.0.0.1
SMTP_PORT=1025
# --- EVOLUTION ---
AUTHENTICATION_API_KEY=mypassy
EOF

# 3. Docker Compose (Corrigido)
cat <<EOF > docker-compose.yaml
services:
  # --- CHATWOOT ---
  base: &base
    image: chatwoot/chatwoot:v3.3.1
    env_file: .env
    volumes:
      - ./storage:/app/storage

  rails:
    <<: *base
    depends_on:
      - postgres
      - redis
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - RAILS_ENV=production
      - INSTALLATION_ENV=docker
      # Força conexão explícita
      - POSTGRES_HOST=postgres
      - POSTGRES_USERNAME=chatwoot
      - POSTGRES_PASSWORD=$POSTGRES_PASSWORD
    entrypoint: docker/entrypoints/rails.sh
    command: ['bundle', 'exec', 'rails', 's', '-p', '3000', '-b', '0.0.0.0']

  sidekiq:
    <<: *base
    depends_on:
      - postgres
      - redis
    environment:
      - NODE_ENV=production
      - RAILS_ENV=production
      - POSTGRES_HOST=postgres
      - POSTGRES_USERNAME=chatwoot
      - POSTGRES_PASSWORD=$POSTGRES_PASSWORD
    command: ['bundle', 'exec', 'sidekiq', '-C', 'config/sidekiq.yml']

  # --- INFRASTRUCTURE ---
  postgres:
    image: postgres:15-alpine
    restart: always
    volumes:
      - ./postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=chatwoot_production
      - POSTGRES_USER=chatwoot
      - POSTGRES_PASSWORD=$POSTGRES_PASSWORD

  redis:
    image: redis:6.2-alpine
    restart: always
    command: ["redis-server", "--requirepass", "$REDIS_PASSWORD"]
    volumes:
      - ./redis_data:/data

  # --- EVOLUTION API v2 ---
  evolution:
    image: atendai/evolution-api:v2.1.1
    restart: always
    ports:
      - "8080:8080"
    volumes:
      - ./evolution_instances:/evolution/instances
      - ./evolution_store:/evolution/store
    environment:
      - SERVER_URL=http://$SERVER_IP:8080
      - DOCKER_ENV=true
      - DATABASE_ENABLED=false 
      - AUTHENTICATION_API_KEY=mypassy
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://:$REDIS_PASSWORD@redis:6379/1
EOF

# 4. Reiniciar e Corrigir
echo -e "${GREEN}>>> [1/2] Reiniciando Containers com Configuração Nova...${NC}"
docker compose down
docker compose up -d

# 5. Garantir Setup
echo -e "${YELLOW}>>> [2/2] Recriando Banco de Dados...${NC}"
sleep 15
# Força preparação do banco novamente
docker compose exec -T rails bundle exec rails db:chatwoot_prepare

echo -e "${GREEN}✅ REPARO CONCLUÍDO!${NC}"
echo -e "Tente acessar novamente em 1 minuto: http://$SERVER_IP:3000"
