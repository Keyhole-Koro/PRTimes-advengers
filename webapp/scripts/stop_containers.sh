#!/bin/bash
# 1. バックエンド(Docker)の停止
if [ -d "/home/ec2-user/press-release-app" ]; then
  cd /home/ec2-user/press-release-app
  docker-compose down || true
fi

# 2. フロントエンド(React)プロセスの停止
PID_FILE="/home/ec2-user/press-release-app/webapp/frontend/react/frontend.pid"

# 保存しておいたPIDファイルがあれば、そのプロセスを終了する
if [ -f "$PID_FILE" ]; then
  kill -9 $(cat "$PID_FILE") || true
  rm -f "$PID_FILE"
fi