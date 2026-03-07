#!/bin/sh
# Reload Xray config by restarting the container
echo "Reloading Xray configuration..."
if docker restart vpn-xray 2>/dev/null; then
  echo "✅ Xray config reloaded (container restarted)"
  sleep 2
  # Check if Xray started successfully
  if docker logs vpn-xray 2>&1 | grep -q "started"; then
    echo "✅ Xray started successfully"
  else
    echo "⚠️  Xray may have failed to start"
  fi
else
  echo "⚠️  Xray container not found, skipping reload"
fi
