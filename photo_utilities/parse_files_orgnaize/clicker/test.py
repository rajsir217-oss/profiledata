import pyautogui
import time

pyautogui.FAILSAFE = False

print("Moving and clicking in 3 seconds...")
time.sleep(3)

pos = (297,516)
pyautogui.moveTo(pos)
pyautogui.doubleClick()
pyautogui.leftClick()
pyautogui.leftClick()

print("Clicked at", pos)
