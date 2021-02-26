# NextDom V2 - Logic

[![Node.js CI](https://github.com/Sylvaner/NxDv2-logic/actions/workflows/node.js.yml/badge.svg)](https://github.com/Sylvaner/NxDv2-logic/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/Sylvaner/NxDv2-logic/branch/main/graph/badge.svg?token=QEFZ61IZLK)](https://codecov.io/gh/Sylvaner/NxDv2-logic)

Traduit les informations transitant sur MQTT dans une base de données MongoDb.

## Installation

```
npm install
npm run build
```

Pour le lancer :

```
node dist/app.js
```

## Configuration

La configuration de base se trouve dans le fichier .env du répertoire du projet.
La priorité est donnée au fichier /etc/nextdom/nextdom.conf

```
DB_HOST=localhost
DB_USER=nextdom
DB_PASSWORD=nextdom
DB_DATABASE=nextdom
DB_STATE_DATABASE=nextdomstate
DB_PORT=27017
MQTT_HOST=localhost
MQTT_USER=nextdom
MQTT_PASSWORD=mqttpassword
MQTT_PORT=1883
DATA_PATH=/var/nextdom
```

## Docker

Pour lancer dans un container :

```
docker-compose up -d
```
