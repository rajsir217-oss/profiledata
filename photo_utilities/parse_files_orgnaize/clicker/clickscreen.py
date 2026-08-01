import pyautogui
import keyboard
import time

print("Press 's' to save the current mouse position.")
print("Then press 'c' to click at the saved position.")
print("Press 'q' to quit the program.")

saved_position = None

while True:
    if keyboard.is_pressed('s'):
        saved_position = pyautogui.position()
        print(f"Saved position: {saved_position}")
        time.sleep(0.5)  # prevent multiple triggers

    elif keyboard.is_pressed('c') and saved_position is not None:
        print(f"Clicking at: {saved_position}")
        pyautogui.click(saved_position)
        time.sleep(0.5)

    elif keyboard.is_pressed('q'):
        print("Exiting program.")
        break
