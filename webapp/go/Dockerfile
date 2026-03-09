FROM golang:1.25-alpine

# Install git for go modules
RUN apk add --no-cache git

WORKDIR /app

# Copy go.mod and go.sum first for better caching
COPY go.mod go.sum* ./

# Download dependencies
RUN go mod download

# Copy application files
COPY . .

# Build the application
RUN go build -mod=mod -o server .

EXPOSE 8080

CMD ["./server"]
