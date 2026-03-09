<?php

namespace App;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $instance = null;

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $host = getenv('DB_HOST') ?: 'postgresql';
            $port = getenv('DB_PORT') ?: '5432';
            $dbname = getenv('DB_NAME') ?: 'press_release_db';
            $user = getenv('DB_USER') ?: 'press_release';
            $password = getenv('DB_PASSWORD') ?: 'press_release';

            $dsn = "pgsql:host={$host};port={$port};dbname={$dbname}";

            self::$instance = new PDO($dsn, $user, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        }

        return self::$instance;
    }
}
