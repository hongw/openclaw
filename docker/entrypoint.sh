#!/bin/bash
set -e

SSH_DIR="/home/node/.ssh"
AUTH_KEYS="$SSH_DIR/authorized_keys"
HOST_KEY="$SSH_DIR/ssh_host_ed25519_key"
SSHD_CONFIG="/tmp/sshd_config"
ENV_FILE="/tmp/container_env.sh"

# Dump current environment for SSH sessions
# This allows SSH users to see container env vars like AZURE_CLIENT_ID
export -p > "$ENV_FILE"
chmod 644 "$ENV_FILE"

# Start SSH daemon only if both authorized_keys and host key exist
if [ -f "$AUTH_KEYS" ] && [ -f "$HOST_KEY" ]; then
    echo "Found SSH keys, starting sshd on port 22222..."
    
    # Fix home directory permissions for SSH
    chmod 755 /home/node
    
    # Create custom sshd_config with PAM disabled (PAM causes issues in containers)
    cat > "$SSHD_CONFIG" << 'EOF'
Port 22222
HostKey /home/node/.ssh/ssh_host_ed25519_key
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PasswordAuthentication no
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM no
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
ClientAliveInterval 60
ClientAliveCountMax 30
Subsystem sftp /usr/lib/openssh/sftp-server
EOF
    
    /usr/sbin/sshd -f "$SSHD_CONFIG" &
elif [ -f "$AUTH_KEYS" ]; then
    echo "WARNING: authorized_keys found but no host key at $HOST_KEY"
    echo "Generate with: ssh-keygen -t ed25519 -f $HOST_KEY -N ''"
    echo "Skipping sshd"
else
    echo "No SSH keys found, skipping sshd"
fi

# Clean up stale Chrome singleton files (prevents "profile in use" errors after container restart)
rm -f /home/node/.openclaw/browser/*/user-data/SingletonLock \
      /home/node/.openclaw/browser/*/user-data/SingletonSocket \
      /home/node/.openclaw/browser/*/user-data/SingletonCookie 2>/dev/null || true

# Start supercronic (container-friendly cron) if crontab file exists
CRON_FILE="/home/node/.openclaw/workspace/crontab-jobs.txt"
if [[ -f "$CRON_FILE" ]]; then
    echo "Starting supercronic with $CRON_FILE"
    supercronic "$CRON_FILE" &
else
    echo "No cron jobs configured ($CRON_FILE not found)"
fi

# Start OpenClaw gateway
exec node dist/index.js gateway "$@"
