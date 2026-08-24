import os
import queue
import shlex
import shutil
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def run_command(cmd, log_queue):
    """Run a shell command and stream stdout lines through log_queue."""
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    for line in process.stdout:
        log_queue.put(line.rstrip("\n"))
    process.stdout.close()
    return process.wait()


def move_leftovers(work_dir):
    """Move any files from _working_/_fldr_ up to _working_."""
    fldr = os.path.join(work_dir, "_fldr_")
    if not os.path.isdir(fldr):
        return
    for item in os.listdir(fldr):
        src = os.path.join(fldr, item)
        dst = os.path.join(work_dir, item)
        if os.path.isdir(src):
            continue
        if os.path.exists(dst):
            base, ext = os.path.splitext(dst)
            counter = 1
            while os.path.exists(dst):
                dst = f"{base}({counter}){ext}"
                counter += 1
        shutil.move(src, dst)


class PhotoOrganizerGUI:
    def __init__(self, root):
        self.root = root
        root.title("Photo Organizer")
        root.geometry("800x600")

        style = ttk.Style()
        style.theme_use("clam")

        main = ttk.Frame(root, padding="20")
        main.pack(fill=tk.BOTH, expand=True)

        ttk.Label(main, text="Photo Organizer", font=("Helvetica", 18, "bold")).pack(
            anchor=tk.W, pady=(0, 20)
        )

        # Archive folder
        archive_frame = ttk.Frame(main)
        archive_frame.pack(fill=tk.X, pady=5)
        ttk.Label(archive_frame, text="Archive folder", width=15).pack(side=tk.LEFT)
        self.archive_var = tk.StringVar(
            value="/Volumes/Extreme SSD/archived-zip"
        )
        ttk.Entry(archive_frame, textvariable=self.archive_var).pack(
            side=tk.LEFT, fill=tk.X, expand=True, padx=5
        )
        ttk.Button(
            archive_frame,
            text="Browse",
            command=lambda: self.browse(self.archive_var),
        ).pack(side=tk.LEFT)

        # Target folder
        target_frame = ttk.Frame(main)
        target_frame.pack(fill=tk.X, pady=5)
        ttk.Label(target_frame, text="Target folder", width=15).pack(side=tk.LEFT)
        self.target_var = tk.StringVar(
            value="/Volumes/Extreme SSD/google photos"
        )
        ttk.Entry(target_frame, textvariable=self.target_var).pack(
            side=tk.LEFT, fill=tk.X, expand=True, padx=5
        )
        ttk.Button(
            target_frame,
            text="Browse",
            command=lambda: self.browse(self.target_var),
        ).pack(side=tk.LEFT)

        # Options
        options = ttk.Frame(main)
        options.pack(fill=tk.X, pady=10)
        self.unzip_var = tk.BooleanVar()
        self.unzip_check = ttk.Checkbutton(
            options, text="Unzip ZIP files", variable=self.unzip_var
        )
        self.unzip_check.pack(side=tk.LEFT, padx=5)

        self.media_only_var = tk.BooleanVar()
        self.media_only_check = ttk.Checkbutton(
            options, text="Media files only", variable=self.media_only_var
        )
        self.media_only_check.pack(side=tk.LEFT, padx=5)

        self.process_duplicates_var = tk.BooleanVar()
        self.process_duplicates_check = ttk.Checkbutton(
            options, text="Process duplicates", variable=self.process_duplicates_var
        )
        self.process_duplicates_check.pack(side=tk.LEFT, padx=5)

        self.remove_non_media_var = tk.BooleanVar()
        self.remove_non_media_check = ttk.Checkbutton(
            options, text="Remove non-media files", variable=self.remove_non_media_var
        )
        self.remove_non_media_check.pack(side=tk.LEFT, padx=5)

        self.merge_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            options, text="Auto-merge after organize", variable=self.merge_var
        ).pack(side=tk.LEFT, padx=5)

        # Source folders
        source_frame = ttk.Frame(main)
        source_frame.pack(fill=tk.X, pady=5)
        ttk.Label(source_frame, text="Source folders", width=15).pack(side=tk.LEFT)
        self.sources_var = tk.StringVar(
            value="/Volumes/Crucial X10/olsseagatedisk:/Volumes/Crucial X10/seagate-dsk"
        )
        ttk.Entry(source_frame, textvariable=self.sources_var).pack(
            side=tk.LEFT, fill=tk.X, expand=True, padx=5
        )
        ttk.Button(
            source_frame,
            text="Browse",
            command=self.browse_sources,
        ).pack(side=tk.LEFT)

        # Run button
        button_frame = ttk.Frame(main)
        button_frame.pack(fill=tk.X, pady=10)
        self.run_button = ttk.Button(
            button_frame, text="Run", command=self.on_run
        )
        self.run_button.pack(side=tk.LEFT, padx=5)
        ttk.Button(
            button_frame,
            text="Open README",
            command=self.open_readme,
        ).pack(side=tk.LEFT, padx=5)

        # Log
        ttk.Label(main, text="Log").pack(anchor=tk.W, pady=(10, 0))
        self.log_area = scrolledtext.ScrolledText(
            main, wrap=tk.WORD, state=tk.DISABLED, height=20
        )
        self.log_area.pack(fill=tk.BOTH, expand=True, pady=5)

        self.log_queue = None
        self.poll_job = None

    def browse(self, var):
        path = filedialog.askdirectory(initialdir=var.get() or "/")
        if path:
            var.set(path)

    def browse_sources(self):
        path = filedialog.askdirectory(initialdir="/Volumes")
        if path:
            current = self.sources_var.get().strip()
            if current:
                self.sources_var.set(f"{current}:{path}")
            else:
                self.sources_var.set(path)

    def log(self, message):
        self.log_area.configure(state=tk.NORMAL)
        self.log_area.insert(tk.END, message + "\n")
        self.log_area.see(tk.END)
        self.log_area.configure(state=tk.DISABLED)

    def poll_queue(self):
        done = False
        while self.log_queue and not self.log_queue.empty():
            msg = self.log_queue.get_nowait()
            if msg is None:
                done = True
                continue
            self.log(msg)
        if not done:
            self.poll_job = self.root.after(100, self.poll_queue)
        else:
            self.run_button.configure(state=tk.NORMAL)
            self.log("=== Done ===")

    def on_run(self):
        archive = self.archive_var.get().strip()
        target = self.target_var.get().strip()

        if not os.path.isdir(archive):
            messagebox.showerror("Error", f"Archive folder not found:\n{archive}")
            return

        self.run_button.configure(state=tk.DISABLED)
        self.log_area.configure(state=tk.NORMAL)
        self.log_area.delete("1.0", tk.END)
        self.log_area.configure(state=tk.DISABLED)

        self.log_queue = queue.Queue()
        self.poll_job = self.root.after(100, self.poll_queue)

        thread = threading.Thread(
            target=self.run_workflow,
            args=(archive, target),
            daemon=True,
        )
        thread.start()

    def run_workflow(self, archive, target):
        log = self.log_queue
        python = sys.executable
        work_dir = os.path.join(archive, "_working_")

        # Build base command
        cmd = [
            python,
            os.path.join(SCRIPT_DIR, "googlephotos", "organize_google_media.py"),
            "--folder",
            archive,
        ]

        # Add sources if provided
        sources = self.sources_var.get().strip()
        if sources:
            cmd.extend(["--sources", sources])

        # Add unzip flag if requested
        if self.unzip_var.get():
            cmd.append("--unzip")

        # Add media-only flag if requested
        if self.media_only_var.get():
            cmd.append("--media-only")

        # Add process-duplicates flag if requested
        if self.process_duplicates_var.get():
            cmd.append("--process-duplicates")

        # First step: unzip (if requested) and first-pass organization
        if self.unzip_var.get():
            log.put("==> Unzip and organize")
        else:
            log.put("==> Organize working folder")
        if run_command(cmd, log) != 0:
            log.put("First-pass organization failed")
            log.put(None)
            return

        # Rename any leftover files in _working_/_fldr_ and move them up
        fldr = os.path.join(work_dir, "_fldr_")
        if os.path.isdir(fldr):
            log.put("==> Rename leftover files")
            cmd = [
                python,
                os.path.join(SCRIPT_DIR, "googlephotos", "rename_files.py"),
                "--folder",
                fldr,
            ]
            if run_command(cmd, log) != 0:
                log.put("Rename failed")
                log.put(None)
                return

            log.put("==> Move renamed leftovers")
            try:
                move_leftovers(work_dir)
            except Exception as exc:
                log.put(f"Move leftovers failed: {exc}")
                log.put(None)
                return

        # Final organization
        log.put("==> Final organization")
        cmd = [
            python,
            os.path.join(SCRIPT_DIR, "googlephotos", "organize_google_media.py"),
            "--folder",
            archive,
        ]
        if run_command(cmd, log) != 0:
            log.put("Final organization failed")
            log.put(None)
            return

        # Remove non-media files if requested
        if self.remove_non_media_var.get():
            log.put("==> Remove non-media files")
            cmd = [
                "bash",
                os.path.join(SCRIPT_DIR, "delete_extensions.sh"),
                archive,
            ]
            if run_command(cmd, log) != 0:
                log.put("Remove non-media files failed")
                log.put(None)
                return

        # Merge (if requested)
        if self.merge_var.get():
            log.put("==> Merge into target")
            cmd = [
                python,
                os.path.join(SCRIPT_DIR, "googlephotos", "organize_google_media.py"),
                "--folder",
                archive,
                "--merge",
                target,
            ]
            if run_command(cmd, log) != 0:
                log.put("Merge failed")
                log.put(None)
                return

        log.put(None)

    def open_readme(self):
        target = self.target_var.get().strip()
        readme = os.path.join(target, "readme.md")
        if os.path.exists(readme):
            subprocess.run(["open", readme])
        else:
            messagebox.showinfo("Info", f"No readme.md found in\n{target}")


def main():
    root = tk.Tk()
    app = PhotoOrganizerGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
