#!/bin/sh
set -eu

cd ../..

pnpm build --filter=@traveler/web...
