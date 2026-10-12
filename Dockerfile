FROM node:20-bookworm-slim

WORKDIR /app

# The project installs Baileys from a GitHub repository, so Git must exist
# before npm install runs. ca-certificates enables HTTPS Git operations.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
