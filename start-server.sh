#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS=--max-old-space-size=768
nohup node light-server.mjs > server.log 2>&1 &
echo $! > server.pid
echo "Server started with PID $(cat server.pid)"
