FROM php:8.5-cli

# Install PostgreSQL client, git, and PDO extension
RUN apt-get update && apt-get install -y \
    libpq-dev \
    git \
    unzip \
    && docker-php-ext-install pdo pdo_pgsql \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy all application files
COPY . .

# Install dependencies (will create composer.lock)
RUN composer install --optimize-autoloader --prefer-dist

EXPOSE 8080

CMD ["php", "-S", "0.0.0.0:8080", "-t", "public"]
