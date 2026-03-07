#!/bin/sh
# Reload Xray config
echo "Reloading Xray configuration..."
if docker kill --signal=HUP vpn-xray 2>/dev/null; then
  echo "✅ Xray config reloaded"
else
  echo "⚠️  Xray container not found, skipping reload"
fi
