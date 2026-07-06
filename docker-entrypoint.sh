#!/bin/sh
set -e
mkdir -p /data reports/html reports/allure-results reports/allure temp_tests
npx prisma migrate deploy
exec node dist/index.js
