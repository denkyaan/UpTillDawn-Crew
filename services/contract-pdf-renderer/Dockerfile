FROM mcr.microsoft.com/playwright:v1.58.2-noble
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY server.mjs ./
RUN mkdir -p /home/pwuser/.cache && chown -R pwuser:pwuser /srv /home/pwuser/.cache
USER pwuser
EXPOSE 8080
CMD ["node", "server.mjs"]
