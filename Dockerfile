# Use Node.js 20 lightweight Alpine image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm install

# Copy source code and files
COPY . .

# Run build script (Builds frontend and compiles server.ts to dist/server.cjs)
RUN npm run build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port (Render overrides this with $PORT anyway, but it's good practice)
EXPOSE 3000

# Start command
CMD ["npm", "run", "start"]
