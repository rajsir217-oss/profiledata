import pyautogui
import time
import json
import threading
from pynput import mouse
import tkinter as tk
from tkinter import filedialog, messagebox

# Global state
actions = []
recording = False
is_saved = True
should_exit = False
root = None

# ---------- Record mouse clicks ----------
def record_click(x, y, button, pressed):
    global is_saved
    if recording and pressed:
        # Ignore clicks inside Tkinter app window
        if is_inside_app_window(x, y):
            return

        action_type = "left_click" if button.name == "left" else "right_click"

        try:
            delay_minutes = float(delay_entry.get())
            if delay_minutes < 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Invalid Delay", "Please enter a valid positive number for delay (minutes).")
            return

        delay_seconds = delay_minutes * 60

        # Save action
        actions.append({
            "type": action_type,
            "position": (x, y),
            "delay": delay_seconds
        })
        is_saved = False
        capture_label.config(text=f"Capture - {len(actions)}")
        print(f"✅ Recorded {action_type} at ({x}, {y}) with {delay_minutes}m delay")


# ---------- Helper: check if click is inside Tkinter window ----------
def is_inside_app_window(x, y):
    root.update_idletasks()
    geo = root.geometry()  # e.g. "500x400+200+100"
    size, pos = geo.split("+", 1)
    w, h = map(int, size.split("x"))
    x0, y0 = map(int, pos.split("+"))
    x1, y1 = x0 + w, y0 + h
    return x0 <= x <= x1 and y0 <= y <= y1


# ---------- Start recording ----------
def start_recording():
    global recording, listener
    recording = True
    actions.clear()
    capture_label.config(text="Capture - 0")
    listener = mouse.Listener(on_click=record_click)
    listener.start()
    print("🔴 Recording mouse clicks...")


# ---------- Stop recording ----------
def stop_recording():
    global recording
    recording = False
    try:
        listener.stop()
    except:
        pass
    print("⏹️ Recording stopped.")


# ---------- Save actions ----------
def save_actions():
    global is_saved
    if not actions:
        messagebox.showwarning("No Actions", "No recorded actions to save.")
        return
    file_path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON Files", "*.json")])
    if file_path:
        with open(file_path, 'w') as f:
            json.dump(actions, f, indent=2)
        is_saved = True
        print(f"💾 Actions saved to {file_path}")


# ---------- Load actions ----------
def load_actions():
    global actions, is_saved
    file_path = filedialog.askopenfilename(filetypes=[("JSON Files", "*.json")])
    if file_path:
        try:
            with open(file_path, 'r') as f:
                actions = json.load(f)
        except json.JSONDecodeError:
            messagebox.showerror("Error", "Invalid JSON file.")
            return
        is_saved = True
        capture_label.config(text=f"Capture - {len(actions)}")
        print(f"📂 Loaded actions from {file_path}")
        messagebox.showinfo("Loaded", f"Loaded {len(actions)} actions.")


# ---------- Replay actions ----------
def replay_actions():
    if not actions:
        messagebox.showwarning("No Actions", "No actions to replay.")
        return

    def runner():
        global should_exit
        print("▶️ Replaying actions...")
        pyautogui.FAILSAFE = False
        for action in actions:
            if should_exit:
                print("❌ Replay interrupted.")
                break

            pos = action["position"]
            delay = action.get("delay",1.0)
            print(f"⏳ Waiting {delay}s before {action['type']} at {pos}")
            time.sleep(delay)
            pyautogui.moveTo(pos)
            if action["type"] == "left_click":
                pyautogui.click()
            elif action["type"] == "right_click":
                pyautogui.click(button='right')
        print("✅ Replay complete.")

    threading.Thread(target=runner, daemon=True).start()


# ---------- Confirm exit ----------
def confirm_exit():
    global is_saved, should_exit
    should_exit = True

    if not is_saved and actions:
        save_choice = messagebox.askyesnocancel("Unsaved Work", "You have unsaved actions. Save before exiting?")
        if save_choice is None:
            should_exit = False
            return
        elif save_choice:
            save_actions()
            if not is_saved:
                should_exit = False
                return

    print("👋 Exiting application.")
    try:
        listener.stop()
    except:
        pass
    root.destroy()


# ---------- GUI Setup ----------
root = tk.Tk()
root.title("Mouse Recorder & Replayer")

# Delay input
delay_frame = tk.Frame(root)
delay_frame.pack(pady=5)
tk.Label(delay_frame, text="Delay (minutes):").pack(side=tk.LEFT)
delay_entry = tk.Entry(delay_frame, width=10)
delay_entry.insert(0, "0.08")
delay_entry.pack(side=tk.LEFT)

# Capture label
capture_label = tk.Label(root, text="Capture - 0", fg='gray', font=('Arial', 10, 'italic'))
capture_label.pack(pady=2)

# Buttons
tk.Button(root, text="Start Recording", command=start_recording, width=30, bg='white', fg='green').pack(pady=5)
tk.Button(root, text="Stop Recording", command=stop_recording, width=30).pack(pady=5)
tk.Button(root, text="Save Actions", command=save_actions, width=30).pack(pady=5)
tk.Button(root, text="Load Actions", command=load_actions, width=30).pack(pady=5)
tk.Button(root, text="Replay Actions", command=replay_actions, width=30, bg='white', fg='blue').pack(pady=5)
tk.Button(root, text="Exit Application", command=confirm_exit, width=30, bg='white', fg='red').pack(pady=10)

# Handle window close
root.protocol("WM_DELETE_WINDOW", confirm_exit)

# Start GUI
root.mainloop()
