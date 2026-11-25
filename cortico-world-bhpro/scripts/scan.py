"""Scan nearby BLE devices and print their addresses."""

import asyncio

from bleak import BleakScanner


async def main() -> None:
    print("scanning 10s ...")
    devices = await BleakScanner.discover(timeout=10)
    if not devices:
        print("no BLE device found")
        return
    for device in devices:
        print(f"{device.address}  {device.name or '(unnamed)'}")


if __name__ == "__main__":
    asyncio.run(main())
