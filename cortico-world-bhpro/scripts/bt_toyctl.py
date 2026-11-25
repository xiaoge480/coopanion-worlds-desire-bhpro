import asyncio
import json
import os
import sys
from pathlib import Path

from bleak import BleakClient, BleakScanner

# The plugin passes the address through this variable; run the script by hand
# with:  set TOY_ADDRESS=AA:BB:CC:DD:EE:FF  (PowerShell: $env:TOY_ADDRESS="...")
ADDRESS = os.environ.get("TOY_ADDRESS", "").strip()

# Zero-config fallback: remember the device we found once, next to this script.
CACHE = Path(__file__).with_name("toy-device.json")
# toy_stop 会往这个文件里写东西；pulse 的每一拍都看它一眼
STOP_FLAG = Path(__file__).with_name("toy-pulse-stop.flag")
# Names the device advertises; extend freely.
NAME_HINTS = ("TF-BHPRO", "TFBHPRO", "BHPRO", "TF-BH", "春风", "CHUNFENG")


def remember(address: str) -> None:
    try:
        CACHE.write_text(json.dumps({"address": address}), encoding="utf-8")
    except OSError:
        pass


def recall() -> str:
    try:
        return str(json.loads(CACHE.read_text(encoding="utf-8")).get("address", "")).strip()
    except (OSError, ValueError):
        return ""


async def discover() -> str:
    """Scan for a device whose name looks like the target and cache it."""
    print("no address configured, scanning 8s ...", file=sys.stderr)
    devices = await BleakScanner.discover(timeout=8)
    for device in devices:
        name = (device.name or "").upper()
        if any(hint.upper() in name for hint in NAME_HINTS):
            remember(device.address)
            print(f"found {device.address} ({device.name})", file=sys.stderr)
            return device.address
    return ""
FFB7 = "0000ffb7-0000-1000-8000-00805f9b34fb"
PROP_RUN = 0x1D
PROP_MODE = 0x1E
PROP_LEVEL = 0x1F
STOP_VALUE = 2
RUN_VALUE = 1
# 协议硬要求：每帧间隔 0.35 秒（README「协议」一节）。少等就会被丢帧。
WRITE_GAP = float(os.environ.get("TOY_WRITE_GAP", "0.35"))


def frame(sn: int, prop: int, value: int) -> bytes:
    return bytes([sn, 0x02, 0x00, 0x03, prop, value, (-(prop + value)) & 0xFF])


async def run_ping() -> None:
    """真的连一次，只为了回答「现在连不连得上」。不震动、不留状态。

    输出 format（一行，方便 JS 那边认）：
        connected <address> [name]
        not-found
        connect-failed <原因>
    """
    address = ADDRESS or recall()

    # 没有缓存地址就先扫一遍（3 秒快扫，不用 8 秒那次）
    if address == "":
        try:
            devices = await BleakScanner.discover(timeout=3)
        except Exception as exc:  # noqa: BLE001
            print(f"connect-failed 扫描失败：{type(exc).__name__}: {exc}", file=sys.stderr)
            raise SystemExit(3) from None
        for device in devices:
            name = (device.name or "").upper()
            if any(hint.upper() in name for hint in NAME_HINTS):
                address = device.address
                remember(address)
                break

    if address == "":
        print("not-found", file=sys.stderr)
        raise SystemExit(4)

    started = asyncio.get_event_loop().time()
    try:
        async with BleakClient(address, timeout=8) as client:
            if not client.is_connected:
                print(f"connect-failed {address} 连上了但状态是断开", file=sys.stderr)
                raise SystemExit(3)
            spent = asyncio.get_event_loop().time() - started
            print(f"connected {address} {spent:.1f}s", file=sys.stdout)
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"connect-failed {address} {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(3) from None


def stop_requested() -> bool:
    """toy_stop 写了这个文件就代表要停。空文件 = 没人喊停。"""
    try:
        return STOP_FLAG.exists() and STOP_FLAG.read_text(encoding="utf-8").strip() != ""
    except OSError:
        return False


async def sleep_until(ms: int) -> bool:
    """睡 ms 毫秒，但每 50ms 回头看一眼要不要停。被叫停返回 False。"""
    loop = asyncio.get_event_loop()
    until = loop.time() + ms / 1000.0
    while True:
        if stop_requested():
            return False
        if loop.time() >= until:
            return True
        await asyncio.sleep(min(0.05, max(0.0, until - loop.time())))


async def run_pulse(args) -> None:
    """一次连接里把整个「开→停→开→停」循环跑完。

    参数：<level> <pattern> <onMs> <offMs> <times>
        times = 0 表示一直跑，直到 TOY_PULSE_MAX_MS（默认 30 分钟）或被人喊停。

    每拍往 stdout 打一行 beat=N，JS 那边拿来做进度。
    退出前一定先 stop 再断开。
    """
    def arg(i, default=0):
        try:
            return int(args[i])
        except (IndexError, ValueError):
            return default

    level = max(0, min(15, arg(0, 5)))
    pattern = max(1, min(4, arg(1, 1)))
    on_ms = max(50, min(5000, arg(2, 220)))
    off_ms = max(50, min(10000, arg(3, 480)))
    times = arg(4, 0)  # 0 = 一直来
    max_ms = int(os.environ.get("TOY_PULSE_MAX_MS", "1800000"))

    # 上一轮的刹车不要误伤这一轮
    try:
        if STOP_FLAG.exists():
            STOP_FLAG.write_text("", encoding="utf-8")
    except OSError:
        pass

    address = ADDRESS or recall() or await discover()
    if address == "":
        raise SystemExit("device not found; set TOY_ADDRESS or run scripts/scan.py")

    loop = asyncio.get_event_loop()
    started = loop.time()
    beats = 0
    interrupted = False

    async with BleakClient(address, timeout=20) as client:
        sn = 1

        async def write(prop: int, value: int) -> None:
            nonlocal sn
            await client.write_gatt_char(FFB7, frame(sn, prop, value), response=False)
            sn = sn % 15 + 1
            # 协议要求每帧隔 0.35 秒；2026-11-21 晚上为了「节奏准」把这句删过，
            # 结果帧被丢、设备完全不动。别删。
            await asyncio.sleep(WRITE_GAP)

        try:
            await write(PROP_MODE, pattern)
            await asyncio.sleep(0.05)

            while True:
                if times and beats >= times:
                    break
                if loop.time() - started > max_ms / 1000.0:
                    break
                if stop_requested():
                    interrupted = True
                    break

                # 先写「运行」再写强度：单连接里刚 stop 过，只写强度不会重启
                await write(PROP_RUN, RUN_VALUE)
                await write(PROP_LEVEL, level)
                beats += 1
                print("beat=" + str(beats), flush=True)

                if not await sleep_until(on_ms):
                    interrupted = True
                    break

                await write(PROP_RUN, STOP_VALUE)

                if times and beats >= times:
                    break
                if not await sleep_until(off_ms):
                    interrupted = True
                    break
        finally:
            # 不管怎么退出，先停住再断开
            try:
                await write(PROP_RUN, STOP_VALUE)
            except Exception:  # noqa: BLE001 - 断开途中写失败也要往下走
                pass
            try:
                await asyncio.sleep(0.05)
            except Exception:  # noqa: BLE001
                pass

    tag = "interrupted" if interrupted else "done"
    print(tag + " beats=" + str(beats), flush=True)


async def run(command: str, args) -> None:
    # ping 要能在"还没记地址"的时候也给出有用的回答，所以单独走一条
    if command == "ping":
        await run_ping()
        return

    if command == "pulse":
        await run_pulse(args)
        return

    address = ADDRESS or recall() or await discover()
    if address == "":
        raise SystemExit("device not found; set TOY_ADDRESS or run scripts/scan.py")
    async with BleakClient(address, timeout=20) as client:
        sn = 1

        async def write(prop: int, value: int) -> None:
            nonlocal sn
            await client.write_gatt_char(FFB7, frame(sn, prop, value), response=False)
            sn = sn % 15 + 1
            await asyncio.sleep(0.35)

        if command == "stop":
            await write(PROP_RUN, STOP_VALUE)
            print("stopped")
            return

        if command in ("start", "mode"):
            mode = max(1, min(4, int(args[0]))) if args else 1
            await write(PROP_MODE, mode)
            if len(args) > 1:
                await write(PROP_LEVEL, max(0, min(15, int(args[1]))))
            print(f"mode={mode}")
            return

        if command == "set":
            level = max(0, min(15, int(args[0]))) if args else 0
            if len(args) > 1:
                await write(PROP_MODE, max(1, min(4, int(args[1]))))
            await write(PROP_LEVEL, level)
            print(f"level={level}")
            return

        raise SystemExit(f"unknown command: {command}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: bt_toyctl.py <start|stop|set|mode|ping|pulse> [args]")
    try:
        asyncio.run(run(sys.argv[1], sys.argv[2:]))
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - surface one readable line
        print(
            f"BLE error: {type(exc).__name__}: {exc}\n"
            "check that the device is powered on, in range, and not connected to the phone app",
            file=sys.stderr,
        )
        raise SystemExit(3) from None
