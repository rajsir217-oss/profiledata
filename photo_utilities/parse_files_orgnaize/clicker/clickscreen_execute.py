import pyautogui
import time

pyautogui.FAILSAFE = False

# List of sequences:
# Each item: (list_of_saved_positions, delay_in_minutes, target_position)
sequences = [
    ([(297, 516), (249, 638)], 0.1, (894, 290)),
    ([(537, 516), (249, 638)], 0.1, (894, 290)),
    ([(772, 515), (249, 638)], 0.1, (894, 290)),
]

print("✅ Starting automated sequence...\n")
time.sleep(3)  # Buffer before execution starts

for index, (saved_positions, delay_min, target_pos) in enumerate(sequences, 1):
    print(f"▶ Step {index}: Clicking saved positions:")

    for pos in saved_positions:
        print(f"  → Moving to: {pos}")
        pyautogui.moveTo(pos)
        time.sleep(1)
        pyautogui.doubleClick()
        time.sleep(1)
        pyautogui.leftClick()
        print("Click 1")
        time.sleep(1)
        pyautogui.doubleClick()
        print("Click 2")
        time.sleep(1)  # Short pause between position actions

    print(f"⏳ Waiting for {delay_min} minutes...\n")
    time.sleep(delay_min * 60)

    print(f"🎯 Step {index}: Clicking target position: {target_pos}")
    pyautogui.moveTo(target_pos)
    # pyautogui.leftClick()
    time.sleep(1)
    pyautogui.leftClick()
    print("-" * 50)

print("✅ All actions completed.")
