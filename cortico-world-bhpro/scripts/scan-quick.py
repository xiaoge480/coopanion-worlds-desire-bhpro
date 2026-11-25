import asyncio
from bleak import BleakScanner

async def main():
    print("扫描 12 秒...", flush=True)
    try:
        devices = await BleakScanner.discover(timeout=12.0)
    except Exception as e:
        print("扫描失败:", type(e).__name__, e)
        return
    print("发现 %d 个设备：" % len(devices))
    for d in devices:
        name = d.name or "(无名)"
        print("  %-32s %s" % (name[:32], d.address))

asyncio.run(main())
