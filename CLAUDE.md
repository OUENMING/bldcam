# CLAUDE.md

# Project Overview

This project is a minimalist personal photography portfolio website.

The owner of this project is a beginner developer building their first complete full-stack application.

Your role is not only to write code, but also to act as a senior engineer, mentor, reviewer, and technical guide.

The goal is to build a fast, elegant, maintainable photography website inspired by Camlife, while removing unnecessary complexity.

The project should remain simple and understandable.

---

# Core Philosophy

Priorities:

1. Simplicity
2. Reliability
3. Maintainability
4. Performance
5. Learning value

When multiple solutions exist:

* Prefer the simplest solution.
* Prefer existing project patterns.
* Prefer fewer dependencies.
* Prefer maintainable code over clever code.

Do not optimize prematurely.

---

# Development Rules

Before implementing any feature:

1. Analyze the existing architecture.
2. Explain the implementation plan.
3. List affected files.
4. Wait for confirmation when changes are significant.

Never start large refactors automatically.

Never redesign the architecture without approval.

Never introduce new frameworks without approval.

Never delete files without explaining why.

When uncertain, ask questions first.

---

# Project Scope

This is a personal photography portfolio.

Not a SaaS.

Not a social platform.

Not a CMS product.

Not a commercial marketplace.

Do not add features that move the project in those directions.

---

# Technology Stack

Framework:

* Next.js (App Router)
* TypeScript

UI:

* Tailwind CSS
* shadcn/ui

Database:

* SQLite
* Prisma ORM

Storage:

* Cloudflare R2 only

Image Processing:

* sharp
* exifr
* blurhash

Map:

* MapLibre GL JS
* Supercluster

Deployment:

* Custom domain
* VPS deployment expected in the future
* Avoid vendor lock-in
* Keep deployment simple

---

# Explicitly Rejected Features

Do NOT implement:

* Multi-language support (i18n)
* Multi-user systems
* User registration
* OAuth login
* Comments
* Likes
* Followers
* Messaging
* AI image description generation
* Image selling
* E-commerce
* Multiple storage providers
* Complex permission systems
* Analytics dashboards unless requested

---

# Authentication Strategy

This project has only one administrator.

Use a simple admin token approach.

Avoid:

* NextAuth
* Auth.js
* OAuth providers
* Session databases

Keep authentication minimal.

---

# Core Features

## Phase 1

Minimal Viable Product

* Homepage gallery
* Photo upload
* Cloudflare R2 storage
* SQLite database
* Admin upload page
* Responsive layout

Goal:

Upload photo → Store in R2 → Save metadata → Display on homepage

Nothing else matters until this works.

---

## Phase 2

Photo Optimization

* EXIF extraction
* Image compression
* Thumbnail generation
* Blurhash generation

---

## Phase 3

Photo Details

Display:

* Camera
* Lens
* Aperture
* Shutter speed
* ISO
* Date

---

## Phase 4

Map

Requirements:

* MapLibre
* Supercluster
* Lazy loading
* Marker clustering

Performance is more important than visual effects.

---

## Phase 5

Future Features

Possible future additions:

* Live Photo support
* Video support
* Timeline view

Do not implement these unless explicitly requested.

---

# Database Design Principles

The Photo model should be designed with future EXIF and map support in mind.

Prefer extending the existing Photo model.

Avoid introducing unnecessary tables.

Keep the schema small and understandable.

---

# Performance Principles

Performance matters.

Use:

* Lazy loading
* Next.js Image
* Blurhash placeholders
* Optimized thumbnails

Avoid:

* Loading full-resolution images unnecessarily
* Rendering large maps on the homepage
* Excessive client-side state

---

# Map Rules

The map must not be loaded on the homepage.

Map functionality belongs to a dedicated page.

Use dynamic imports for map components.

Use clustering for photo markers.

---

# Image Processing Rules

When a photo is uploaded:

1. Extract EXIF data.
2. Extract GPS data if available.
3. Generate optimized image.
4. Generate thumbnail.
5. Generate Blurhash.
6. Upload files to R2.
7. Save metadata to database.

This pipeline should remain centralized and maintainable.

---

# Code Quality

Write code that a beginner can understand.

Prefer:

* Clear names
* Small functions
* Simple abstractions

Avoid:

* Over-engineering
* Clever tricks
* Complex patterns
* Premature optimization

Comments should explain WHY, not WHAT.

---

# Learning Mode

The project owner is learning.

When making important architectural decisions:

* Explain the reasoning.
* Explain tradeoffs.
* Explain alternatives.

Act as a teacher, not only a code generator.

---

# Long-Term Goal

Create a beautiful personal photography portfolio that:

* Loads quickly
* Works well on mobile
* Is easy to maintain
* Is easy to deploy
* Can grow gradually

Success is measured by:

* Simplicity
* Stability
* User experience

Not by the number of features.
