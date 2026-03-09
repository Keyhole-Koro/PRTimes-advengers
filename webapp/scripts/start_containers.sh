#!/bin/bash
cd /home/ec2-user/press-release-app

# 1. バックエンド(Docker)の起動
docker-compose up -d --build

# 2. フロントエンド(React)の起動
# ※ webapp の中身が直接展開されるため、パスは frontend/react になります
FRONTEND_DIR="/home/ec2-user/press-release-app/frontend/react"

if [ -d "$FRONTEND_DIR" ]; then
  cd "$FRONTEND_DIR"
  
  npm install
  
  # バックグラウンドで起動し、PIDを保存
  nohup npm run dev > frontend.log 2>&1 &
  echo $! > frontend.pid
fi