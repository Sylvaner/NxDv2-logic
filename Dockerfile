FROM node:15.3.0-buster
RUN mkdir /app
COPY *.json /app/
COPY src /app/src/
RUN cd /app && \
    npm install && \
    npm run build 

FROM node:15.3.0-buster
COPY --from=0 /app/dist /app/dist
COPY --from=0 /app/node_modules /app/node_modules
COPY .env /app/.env 
WORKDIR /app
CMD ["node", "dist/app.js"]
