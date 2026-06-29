import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("c:\\Users\\lavro\\Projects\\pbx-cloud\\диплом.md", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "4.6" in line or "Сигналізація в реальному" in line:
        print(f"Line {idx+1}: {line.strip()}")
