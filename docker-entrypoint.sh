#!/bin/sh
set -e
mkdir -p /data reports/html reports/allure-results reports/allure temp_tests public
export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"
exec ./start.sh
