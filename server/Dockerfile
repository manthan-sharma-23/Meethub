FROM node:22-bullseye

RUN apt-get update && apt-get install -y \
  python3 \
  python3-pip \
  build-essential \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .

RUN npm install 

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
