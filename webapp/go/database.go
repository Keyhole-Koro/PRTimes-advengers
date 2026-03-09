package main

import (
	"context"
	"fmt"
	"os"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// dbPool はデータベース接続プールのシングルトンインスタンス
	dbPool *pgxpool.Pool
	once   sync.Once
)

// GetDB はデータベース接続プールを取得する
// シングルトンパターンで実装されており、初回呼び出し時にのみ接続を確立する
func GetDB() *pgxpool.Pool {
	once.Do(func() {
		// 環境変数からデータベース接続情報を取得
		host := getEnv("DB_HOST", "postgresql")
		port := getEnv("DB_PORT", "5432")
		user := getEnv("DB_USER", "press_release")
		password := getEnv("DB_PASSWORD", "press_release")
		dbname := getEnv("DB_NAME", "press_release_db")

		// 接続文字列を構築
		dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s", user, password, host, port, dbname)

		// 接続プールを作成
		var err error
		dbPool, err = pgxpool.New(context.Background(), dsn)
		if err != nil {
			panic(fmt.Sprintf("Unable to connect to database: %v", err))
		}

		// 接続確認
		if err := dbPool.Ping(context.Background()); err != nil {
			panic(fmt.Sprintf("Unable to ping database: %v", err))
		}
	})

	return dbPool
}

// getEnv は環境変数を取得し、存在しない場合はデフォルト値を返す
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
