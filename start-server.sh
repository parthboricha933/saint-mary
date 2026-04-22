#!/bin/bash
cd /home/z/my-project
while true; do
  node light-server.mjs
  echo "Server crashed, restarting in 3s..."
  sleep 3
done
