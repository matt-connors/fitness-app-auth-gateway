# tbn-auth-gateway - Centralized Authentication and RBAC Gateway

The `tbn-auth-gateway` is a Cloudflare Worker-based service that handles centralized authentication and role-based access control (RBAC) for multiple microservices. It uses Firebase Authentication for user verification, retrieves user roles and permissions from a PostgreSQL database, and ensures that only authorized users can access protected resources based on their roles and permissions.

This service acts as a gateway that verifies authentication and handles authorization checks for various microservices (e.g., dashboard, media, search). If the user is authenticated and authorized, the request is forwarded to the appropriate backend service.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication & RBAC Flow](#authentication--rbac-flow)
4. [Service Proxying](#service-proxying)
5. [Cache Strategy](#cache-strategy)
6. [Endpoints](#endpoints)
7. [Configuration](#configuration)
8. [Testing](#testing)

---

## Overview

`tbn-auth-gateway` provides a centralized authentication layer and RBAC enforcement for multiple backend services. It ensures secure access to resources by verifying user identity via Firebase Authentication, checking the user's permissions against predefined roles stored in a PostgreSQL database, and forwarding the request to the appropriate microservice upon successful authorization.

### Key Features:
- **Authentication**: Firebase Authentication using `@hono/firebase-auth` middleware.
- **Role-Based Access Control (RBAC)**: Role and permissions checks based on a resource-action model.
- **Request Proxying**: Forward authenticated requests to the appropriate service, using service bindings or the `fetch` API.
- **Caching**: User permissions are cached in Upstash Redis to reduce latency.
- **Error Handling**: Unauthorized users receive a 403 Forbidden error with an access-denied page prompting sign-in.

---

## Architecture

The architecture of the `tbn-auth-gateway` service includes several key components:

1. **Authentication**: Firebase Authentication verifies user identity via an auth cookie.
2. **RBAC Enforcement**: Based on the resource being requested, the user's roles and permissions are checked to determine whether access is allowed.
3. **Request Forwarding**: Upon successful authentication and authorization, the request is forwarded to the appropriate backend service:
   - **Service Bindings**: If the backend service is another Cloudflare Worker, we use Cloudflare service bindings to invoke it directly.
   - **Fetch API**: If the backend service is external or hosted outside of Cloudflare Workers, we use the `fetch` API to forward the request.
4. **Caching**: To reduce database load and latency, user roles and permissions are cached in **Upstash Redis**.

### Flow:
1. The user’s request includes an authentication cookie validated by the `@hono/firebase-auth` middleware.
2. The resource associated with the request is determined using a simple mapping.
3. The user’s roles and permissions are retrieved from Redis or, if not cached, from the PostgreSQL database.
4. If the user has the appropriate permissions (e.g., `VIEW`, `MANAGE`), the request is forwarded to the appropriate service.
5. If the user is unauthorized or lacks necessary permissions, a **403 Forbidden** error is returned.

---

## Authentication & RBAC Flow

### 1. Authentication
- The user’s authentication cookie is validated by `@hono/firebase-auth`.
- Upon successful authentication, the user’s `uuid` is extracted from the Firebase token.

### 2. Role and Permission Retrieval
- The `uuid` is used to query the user’s roles and permissions from PostgreSQL.
- Permissions are cached in **Upstash Redis** under the key `user:<user_id>:permissions` for subsequent requests.

### 3. RBAC Enforcement
- The requested endpoint’s resource and action (e.g., `VIEW`, `MANAGE`) are determined based on the request method (GET for `VIEW`, POST for `MANAGE`).
- The service checks if the user has the required permission for the resource and action:
  - `VIEW` permission grants access to `GET` requests.
  - `MANAGE` permission grants access to both `GET` and `POST` requests.

### 4. Request Forwarding
- If the user is authorized, the request is forwarded to the corresponding backend service.
- If the requested service is another Cloudflare Worker, it is invoked via service bindings.
- If the requested service is external, the `fetch` API is used.

---

## Service Proxying

### Default Service (Dashboard)
By default, the `tbn-auth-gateway` will handle requests for `/dashboard` and related paths internally within the gateway itself. This service does not require explicit root path separation like other services.

### Forwarding to Backend Services
- Requests for other services (e.g., `/media-service`, `/search-service`) are forwarded to the appropriate backend after successful authentication and authorization.
- For internal Cloudflare Workers, **service bindings** are used to forward requests directly to the appropriate service.
- For external services or microservices hosted outside of Cloudflare Workers, the **fetch API** is used to proxy the request to the appropriate endpoint.

---

## Cache Strategy

The gateway uses **Upstash Redis** for caching user roles and permissions to reduce database load and improve response time:

1. **Cache Key**: The cache key is `user:<user_id>:permissions`, where `<user_id>` is the UUID from the Firebase token.
2. **Cache Expiry**: Cached permissions have a configurable TTL (Time-to-Live). After expiration, the permissions are refreshed from the PostgreSQL database.

### Cache Flow:
- On the first request after authentication, permissions are retrieved from the database and stored in Redis.
- Subsequent requests use the cached permissions for faster response times.
- If permissions are not found in the cache or the cache is expired, the system queries the database for fresh data.

---

## Endpoints

### Authentication Endpoint
- **Path**: `/auth`
- **Method**: `GET`
- **Purpose**: Verifies the user's authentication cookie and returns the user’s details if valid. Otherwise, it returns a `403 Forbidden` error.

### Role and Permission Endpoint
- **Path**: `/check-permissions`
- **Method**: `GET`
- **Purpose**: Checks if the user has the required permissions for a specific resource. If the user does not have sufficient permissions, a `403 Forbidden` error is returned.

### Service Forwarding
- **Path**: `/media-service/*`, `/search-service/*`, `/graphql-api/*`, etc.
- **Method**: Various (GET, POST, etc.)
- **Purpose**: Forwards requests to the corresponding backend service after verifying the user’s authentication and permissions.

---

## Configuration
Configuration files are located in the `config` directory. Here, you can modify the following:
* Resource Mappings: Define how different paths (e.g., `/media`, `/dashboard`) map to resources.
* Permissions: Specify the required permissions for each resource/action.
* Cache Settings: Configure the TTL for Redis cache.

---

## Testing

### Unit Tests
Use a testing framework like Jest to write unit tests for individual components (e.g., Firebase auth validation, permissions check).

### Integration Tests
* Test the complete authentication and authorization flow with Postman or similar tools.
* Mock Firebase authentication for tests.