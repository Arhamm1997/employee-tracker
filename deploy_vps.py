import paramiko
import json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("api.monitorhub.live", username="root", password="AWANarham96*", timeout=30)

def run(cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    return exit_code, out

# Get pm2 process list as JSON
code, out = run("pm2 jlist 2>/dev/null")
try:
    procs = json.loads(out)
    print(f"{'NAME':<30} {'STATUS':<12} {'UPTIME':<15} {'RESTARTS'}")
    print("-" * 65)
    for p in procs:
        env = p.get("pm2_env", {})
        name = p.get("name", "?")
        status = env.get("status", "?")
        uptime = env.get("pm_uptime", 0)
        restarts = env.get("restart_time", 0)
        print(f"{name:<30} {status:<12} {uptime:<15} {restarts}")
except Exception as e:
    print(f"Could not parse pm2 list: {e}")
    print(out[:500])

# Quick health check
code2, out2 = run("curl -s http://localhost:5001/api/connection-status 2>/dev/null | head -c 200")
print(f"\nHealth check (exit {code2}):\n{out2}")

client.close()
