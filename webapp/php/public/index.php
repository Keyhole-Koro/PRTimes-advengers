<?php

require_once __DIR__ . '/../vendor/autoload.php';

use App\GetPressReleaseController;
use App\SavePressReleaseController;
use Slim\Factory\AppFactory;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

$app = AppFactory::create();

// Add CORS middleware
$app->add(function (ServerRequestInterface $request, $handler) {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type');
});

// Handle OPTIONS requests
$app->options('/{routes:.+}', function (ServerRequestInterface $request, ResponseInterface $response) {
    return $response;
});

// Define routes
$app->get('/press-releases/{id}', GetPressReleaseController::class . '::handle');
$app->post('/press-releases/{id}', SavePressReleaseController::class . '::handle');

$app->run();
