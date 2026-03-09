#!/bin/bash
if [ -d "/home/ec2-user/press-release-app" ]; then
  cd /home/ec2-user/press-release-app
  docker-compose down || true
fi

# ※ こちらもパスから webapp を外します
PID_FILE="/home/ec2-user/press-release-app/frontend/react/frontend.pid"

if [ -f "$PID_FILE" ]; then
  kill -9 $(cat "$PID_FILE") || true
  rm -f "$PID_FILE"
fi