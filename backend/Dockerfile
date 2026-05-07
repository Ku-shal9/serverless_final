FROM node:20-alpine

WORKDIR /app

# Install only backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend source + shared libs + DB schema used by migrations
COPY backend ./backend
COPY lib ./lib
COPY db ./db

ENV PORT=3001
EXPOSE 3001

CMD ["node", "backend/server.js"]

