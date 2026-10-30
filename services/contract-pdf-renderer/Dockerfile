FROM mcr.microsoft.com/playwright:v1.58.2-noble
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY server.mjs ./
USER pwuser
EXPOSE 8080
CMD ["node", "server.mjs"]
