#!/bin/bash
# Quick db check — list all recipes and the id of the root node for each
cd /home/phill/software/grain-of-salt-svelte
cp .env .env.tmp 2>/dev/null
cat .env 2>/dev/null | grep -i database_url
cat .env.local 2>/dev/null | grep -i database_url
ls .env* 2>/dev/null