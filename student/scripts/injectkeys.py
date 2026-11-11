import pyautogui
import time

# 1. Vorbereitungszeit:
# Gib dir 5 Sekunden, um dein Next-Exam Fenster zu aktivieren
print("Skript gestartet. Wechsle jetzt zu Next-Exam...")
time.sleep(5)

# 2. Der Text, den der Bot schreiben soll
test_text = "Dies ist ein automatischer Test-Text, um das Injected-Flag zu testen. Er wurde mittels Python-Skript welches Tastatureingaben simuliert geschrieben."

# 3. Simulation der Eingabe
# 'interval' simuliert eine menschliche Verzögerung zwischen den Tasten
print("Starte Tipp-Vorgang...")
pyautogui.write(test_text, interval=0.05) 

print("Test beendet.")