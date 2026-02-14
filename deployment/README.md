# Stack Chatwoot + Evolution API (v2.3.0)

Este diretório contém a estrutura completa para rodar o Chatwoot e a Evolution API em conjunto, com foco em estabilidade e importação de histórico sem disparar mensagens indesejadas.

## 🚀 Como Instalar

1. **Acesse seu servidor via SSH.**
2. **Crie a pasta do projeto:**
   ```bash
   mkdir -p /opt/chatwoot_stack
   cd /opt/chatwoot_stack
   ```
3. **Copie os arquivos `docker-compose.yml`, `deploy.sh` e a pasta `import_tool` para dentro dessa pasta.**
4. **Execute o script de instalação:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
   *O script irá gerar senhas seguras automaticamente no arquivo `.env`.*

## 📂 Estrutura do Projeto

- `docker-compose.yml`: Define os serviços Chatwoot (Rails, Sidekiq, Postgres, Redis) e Evolution API.
- `deploy.sh`: Script de automação total (instala, configura banco de dados e sobe containers).
- `import_tool/`: Ferramenta Node.js para importar o histórico diretamente no banco de dados.

## 📥 Como Importar o Histórico

Para evitar que o Chatwoot tente reenviar mensagens antigas, usamos uma importação via SQL Direto.

1. **Instale as dependências da ferramenta:**
   ```bash
   cd import_tool
   npm install
   ```
2. **Configure as IDs no `.env` (se necessário):**
   - `INBOX_ID`: Geralmente `2` para o WhatsApp.
   - `ACCOUNT_ID`: Geralmente `2`.
3. **Rode a importação para uma instância específica:**
   ```bash
   node index.js NomeDaSuaInstancia
   ```

## 🛠️ Notas de Manutenção

- **LIDs (Contatos Duplicados):** A ferramenta de importação agora normaliza LIDs automaticamente, convertendo-os para o formato padrão `@s.whatsapp.net`. Isso evita a criação de contatos duplicados que assolavam a versão anterior.
- **Segurança:** As mensagens históricas são marcadas como `read` e `resolved` por padrão, para não poluir sua caixa de entrada de "Mensagens Abertas".
- **Evolution API v2.3.0:** Estamos usando a versão mais recente estável da API v2.

## 🛑 IMPORTANTE
Nunca importe histórico usando scripts de "Rails Runner" ou via API do Chatwoot se quiser evitar o disparo de webhooks de saída. Utilize sempre o `import_tool` via SQL fornecido aqui.
