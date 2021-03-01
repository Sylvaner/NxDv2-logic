#!/bin/sh

# Check and install node if necessary
if ! [ -x "$(command -v node)" ]; then
  echo ">>> Install node"
  curl -fsSL https://deb.nodesource.com/setup_15.x | bash -
  apt-get install -y nodejs
fi

echo ">>> Copy files"
cp -fr ../src .
cp -fr ../package* .
cp -fr ../tsconfig.json .

echo ">>> Install dependencies"
npm install
echo ">>> Build app"
npm run build
if [ $? -ne 0 ]; then
  exit 1
fi

echo ">>> Clean"
rm -fr src
rm -fr package*
rm -fr tsconfig.json
mv node_modules dist/

echo ">>> Application is in dist folder"
