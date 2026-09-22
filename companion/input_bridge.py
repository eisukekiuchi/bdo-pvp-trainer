"""
PvP Trainer Windows Input Bridge
- Sends ONLY whitelisted game-control keys and left/right mouse buttons.
- Does not send typed text, clipboard data, passwords, or arbitrary keystrokes.
- Connects outbound to the Railway PvP Trainer relay using a short room code.
"""

import asyncio
import json
import sys
import threading
from pynput import keyboard, mouse
import websockets

BASE = "wss://bdo-pvp-trainer-production.up.railway.app/bridge"

CHAR_CODES = {
    "w": "KeyW", "a": "KeyA", "s": "KeyS", "d": "KeyD",
    "e": "KeyE", "f": "KeyF", "c": "KeyC", "x": "KeyX", "z": "KeyZ",
    "q": "KeyQ", "r": "KeyR",
    "1": "Digit1", "2": "Digit2", "3": "Digit3", "4": "Digit4", "5": "Digit5",
    "6": "Digit6", "7": "Digit7", "8": "Digit8", "9": "Digit9",
}
SPECIAL_CODES = {
    keyboard.Key.shift_l: "ShiftLeft",
    keyboard.Key.shift_r: "ShiftRight",
    keyboard.Key.space: "Space",
    keyboard.Key.ctrl_l: "ControlLeft",
    keyboard.Key.ctrl_r: "ControlRight",
}
MOUSE_CODES = {
    mouse.Button.left: 0,
    mouse.Button.right: 2,
}

loop = None
queue = None

def key_code(k):
    if k in SPECIAL_CODES:
        return SPECIAL_CODES[k]
    try:
        ch = (k.char or "").lower()
    except AttributeError:
        return None
    return CHAR_CODES.get(ch)

def emit(payload):
    if loop is not None and queue is not None:
        loop.call_soon_threadsafe(queue.put_nowait, payload)

def on_press(k):
    code = key_code(k)
    if code:
        emit({"type": "key", "code": code, "down": True})

def on_release(k):
    code = key_code(k)
    if code:
        emit({"type": "key", "code": code, "down": False})

def on_click(x, y, button, pressed):
    if button in MOUSE_CODES:
        emit({"type": "mouse", "button": MOUSE_CODES[button], "down": bool(pressed)})

async def sender(ws):
    await ws.send(json.dumps({"type": "hello", "source": "companion"}))
    while True:
        item = await queue.get()
        await ws.send(json.dumps(item, separators=(",", ":")))

async def heartbeat(ws):
    while True:
        await asyncio.sleep(15)
        await ws.send(json.dumps({"type": "heartbeat"}))

async def connect_forever(room):
    global loop, queue
    loop = asyncio.get_running_loop()
    queue = asyncio.Queue()
    url = f"{BASE}?room={room}&role=companion"

    with keyboard.Listener(on_press=on_press, on_release=on_release) as kl, mouse.Listener(on_click=on_click) as ml:
        while True:
            try:
                print(f"[PvP Trainer] 接続中: {room}")
                async with websockets.connect(url, ping_interval=20, ping_timeout=20, max_size=8192) as ws:
                    print("[PvP Trainer] 接続済み。ゲーム用キーのみ送信します。Ctrl+Cで終了。")
                    await asyncio.gather(sender(ws), heartbeat(ws))
            except asyncio.CancelledError:
                raise
            except KeyboardInterrupt:
                return
            except Exception as e:
                print(f"[PvP Trainer] 再接続待ち: {e}")
                await asyncio.sleep(3)

def main():
    if len(sys.argv) < 2:
        print("使い方: python input_bridge.py 接続コード")
        print("例: python input_bridge.py A1B2C3")
        raise SystemExit(2)
    room = "".join(ch for ch in sys.argv[1].upper() if ch.isalnum())[:12]
    if not room:
        raise SystemExit("接続コードが空です。")
    try:
        asyncio.run(connect_forever(room))
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
