FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start dev server with host 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
