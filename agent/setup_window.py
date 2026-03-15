import tkinter as tk
from tkinter import ttk
import api
from config import save_config, DEFAULT_CONFIG
from logger import log


def run_setup_window():
    result = {"success": False}

    root = tk.Tk()
    root.title("Employee Monitor Setup")
    root.geometry("420x340")
    root.resizable(False, False)
    root.configure(bg="#1e1e2e")

    # Allow closing the window (will exit the agent)
    def on_close():
        result["cancelled"] = True
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", on_close)

    style = ttk.Style()
    style.theme_use("clam")
    style.configure("TLabel", background="#1e1e2e", foreground="#e2e8f0", font=("Segoe UI", 10))
    style.configure("TEntry", fieldbackground="#2a2a3e", foreground="#e2e8f0", font=("Segoe UI", 10))
    style.configure("TButton", background="#6366f1", foreground="white", font=("Segoe UI", 10, "bold"), padding=8)

    # Title
    title_label = tk.Label(
        root, text="Employee Monitor Setup", font=("Segoe UI", 16, "bold"),
        bg="#1e1e2e", fg="#6366f1"
    )
    title_label.pack(pady=(20, 15))

    frame = tk.Frame(root, bg="#1e1e2e")
    frame.pack(padx=30, fill="x")

    # Server URL
    tk.Label(frame, text="Server URL", bg="#1e1e2e", fg="#94a3b8", font=("Segoe UI", 9)).pack(anchor="w")
    server_var = tk.StringVar(value="http://192.168.1.41:5001")
    server_entry = tk.Entry(frame, textvariable=server_var, font=("Segoe UI", 10), bg="#2a2a3e", fg="#e2e8f0",
                            insertbackground="#e2e8f0", relief="flat", bd=5)
    server_entry.pack(fill="x", pady=(2, 10))

    # Employee Code
    tk.Label(frame, text="Employee Code", bg="#1e1e2e", fg="#94a3b8", font=("Segoe UI", 9)).pack(anchor="w")
    code_var = tk.StringVar()
    code_entry = tk.Entry(frame, textvariable=code_var, font=("Segoe UI", 10), bg="#2a2a3e", fg="#e2e8f0",
                          insertbackground="#e2e8f0", relief="flat", bd=5)
    code_entry.pack(fill="x", pady=(2, 10))

    # Agent Token
    tk.Label(frame, text="Agent Token", bg="#1e1e2e", fg="#94a3b8", font=("Segoe UI", 9)).pack(anchor="w")
    token_var = tk.StringVar()
    token_entry = tk.Entry(frame, textvariable=token_var, font=("Segoe UI", 10), bg="#2a2a3e", fg="#e2e8f0",
                           insertbackground="#e2e8f0", relief="flat", bd=5)
    token_entry.pack(fill="x", pady=(2, 10))

    # Status label
    status_label = tk.Label(frame, text="", bg="#1e1e2e", font=("Segoe UI", 9))
    status_label.pack(pady=(0, 5))

    def on_connect():
        server = server_var.get().strip().rstrip("/")
        code = code_var.get().strip()
        token = token_var.get().strip()

        if not server or not code or not token:
            status_label.config(text="All fields are required", fg="#ef4444")
            return

        status_label.config(text="Verifying...", fg="#f59e0b")
        root.update()

        cfg = {"serverUrl": server, "agentToken": token, "employeeCode": code}
        resp = api.verify_token(cfg)

        if resp and resp.get("valid"):
            full_cfg = {**DEFAULT_CONFIG, **cfg}
            save_config(full_cfg)
            status_label.config(text=f"Connected! Welcome {resp['employee']['name']}", fg="#22c55e")
            log.info("Setup complete for %s", code)
            result["success"] = True
            root.after(1500, root.destroy)
        else:
            err = resp.get("error") if resp else None
            if err == "unreachable":
                msg = f"Server unreachable at {server}"
            elif err == "timeout":
                msg = f"Server timed out at {server}"
            elif err == "auth":
                msg = "Invalid agent token or employee disabled"
            else:
                msg = "Connection failed - check server URL"
            status_label.config(text=msg, fg="#ef4444")
            log.warning("Setup verification failed for %s: %s", code, msg)

    connect_btn = tk.Button(
        frame, text="Connect & Verify", font=("Segoe UI", 11, "bold"),
        bg="#6366f1", fg="white", activebackground="#4f46e5", activeforeground="white",
        relief="flat", bd=0, cursor="hand2", command=on_connect
    )
    connect_btn.pack(fill="x", pady=(5, 0), ipady=4)

    root.eval("tk::PlaceWindow . center")
    root.mainloop()

    if not result["success"]:
        if result.get("cancelled"):
            raise SystemExit(0)
        raise SystemExit("Setup failed")
