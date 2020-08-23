console.info("kek");

class Serial {
  constructor(private readonly device: USBDevice) {
    // nothing here
  }

  async setBaudrate(baudRate = 9600) {
    // https://www.javatips.net/api/usb-serial-for-android-master/usbSerialForAndroid/src/main/java/com/hoho/android/usbserial/driver/Ch34xSerialDriver.java
    const baud = [
      2400,
      0xd901,
      0x0038,
      4800,
      0x6402,
      0x001f,
      9600,
      0xb202,
      0x0013,
      19200,
      0xd902,
      0x000d,
      38400,
      0x6403,
      0x000a,
      115200,
      0xcc03,
      0x0008,
    ];

    for (let i = 0; i < baud.length / 3; i++) {
      if (baud[i * 3] === baudRate) {
        await this.device.controlTransferOut({
          requestType: "vendor",
          recipient: "device",
          request: 0x9a,
          value: 0x1312,
          index: baud[i * 3 + 1],
        });

        await this.device.controlTransferOut({
          requestType: "vendor",
          recipient: "device",
          request: 0x9a,
          value: 0x0f2c,
          index: baud[i * 3 + 2],
        });
      }
    }
  }

  async connect() {
    const readLoop = () => {
      if (!this.device.configuration) {
        return;
      }
      const endpointNumber = this.device.configuration.interfaces[0].alternate
        .endpoints[0].endpointNumber;

      this.device.transferIn(endpointNumber, 64).then(
        (result) => {
          this.onReceive(result.data);
          readLoop();
        },
        (error) => {
          this.onReceiveError(error);
        }
      );
    };

    return this.device
      .open()
      .then(() => {
        if (this.device.configuration === null) {
          return this.device.selectConfiguration(1);
        }
      })
      .then(() => this.device.claimInterface(0))
      .then(() => this.setBaudrate())
      .then(() => {
        readLoop();
      });
  }

  disconnect() {
    return this.device.close();
  }

  public onReceive: (data?: DataView) => void = () => {};
  public onReceiveError: (e: any) => void = (e) => console.warn(e);
  public send(data: BufferSource) {
    if (!this.device.configuration) {
      throw new Error("No configuration applied");
    }
    const endpointNumber = this.device.configuration.interfaces[0].alternate
      .endpoints[1].endpointNumber;
    return this.device.transferOut(endpointNumber, data);
  }
  public sendStr(s: string) {
    const view = new TextEncoder().encode(s);
    return this.send(view);
  }
}

function log(msg: string) {
  const el = document.getElementById("logs");
  if (el) {
    const div = document.createElement("div");
    div.innerHTML = msg;
    el.appendChild(div);
  }
}

async function start() {
  // 0x1a86 0x7523
  const filters: USBDeviceFilter[] = [{ vendorId: 6790, productId: 29987 }];
  const device = await navigator.usb.requestDevice({ filters: filters });

  (window as any).device = device;
  console.info(device);

  const serial = new Serial(device);

  serial.onReceive = (data) => {
    const textDecoder = new TextDecoder();
    const msg = textDecoder.decode(data);
    log(msg);
  };

  await serial.connect();

  const speedInput = document.getElementById("speed_input") as HTMLInputElement;
  const servosDom = [1, 2, 3, 4, 5, 6].map((i) => ({
    i: i,
    input: document.getElementById(`servo_${i}_input`) as HTMLInputElement,
    span: document.getElementById(`servo_${i}_span`) as HTMLSpanElement,
  }));
  function onChange() {
    const speed = parseInt(speedInput.value);

    document.getElementById("speed_span")!.innerHTML = `${speed}`;

    const servoValues: number[] = [];
    servosDom.forEach((s) => {
      const value = parseInt(s.input.value);
      s.span.innerHTML = `${value}`;
      servoValues.push(value);
    });

    function toHex(n: number) {
      const s = n.toString(16).toUpperCase();
      return s.length === 1 ? `0${s}` : s;
    }

    const cmd =
      "M" +
      [
        servoValues[0],
        speed,
        servoValues[1],
        speed,
        servoValues[2],
        speed,
        servoValues[3],
        speed,
        servoValues[4],
        speed,
        servoValues[5],
        speed,
      ]
        .map((v) => toHex(v))
        .join("") +
      "\n";

    log(cmd);
    serial.sendStr(cmd).catch((e) => log(`Sending error: ${e.message}`));
  }
  speedInput.onchange = onChange;
  servosDom.forEach((s) => (s.input.onchange = onChange));
  onChange();
}

document.getElementById("start")!.onclick = () => start();
