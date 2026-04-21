FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x scripts/start.sh
RUN mkdir -p uploads && chown -R node:node /app uploads
EXPOSE 5000
USER node
CMD ["sh", "scripts/start.sh"]
