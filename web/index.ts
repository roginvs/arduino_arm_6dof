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
function setHtml(id: "cmd" | "result", text: string) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`No element ${id}`);
    return;
  }
  el.innerHTML = text;
}

async function start() {
  const filters: USBDeviceFilter[] = [{ vendorId: 0x1a86, productId: 0x7523 }];
  const device = await navigator.usb.requestDevice({ filters: filters });

  (window as any).device = device;
  console.info(device);

  const serial = new Serial(device);

  function resetOnreceive() {
    serial.onReceive = (data) => {
      const textDecoder = new TextDecoder("utf-8");
      const msg = textDecoder.decode(data);
      console.info("Unexpected data", msg);
    };
  }
  resetOnreceive();

  function runCmd(cmdWithComments: string) {
    return new Promise((resolve, reject) => {
      const cmd = cmdWithComments.split("#")[0].trim();
      if (!cmd) {
        resolve();
        return;
      }

      if (cmd.indexOf("M") === 0) {
        updateUiToCmd(cmd);
      }
      setHtml("cmd", cmd);
      setHtml("result", ".");
      serial
        .sendStr(cmd + "\n")
        .then(() => {
          setHtml("result", "...");
        })
        .catch((e) => {
          setHtml("result", "SEND ERROR");
          reject(e);
        });

      serial.onReceive = (data) => {
        const textDecoder = new TextDecoder("utf-8");
        const msg = textDecoder.decode(data);
        console.info("Received", msg);
        if (msg.indexOf("OK") > -1) {
          resolve();
          resetOnreceive();
        }
        setHtml("result", msg);
      };
    });
  }

  await serial.connect();

  const speedInput = document.getElementById("speed_input") as HTMLInputElement;
  const speedSpan = document.getElementById("speed_span") as HTMLSpanElement;
  const servosDom = [1, 2, 3, 4, 5, 6].map((i) => ({
    i: i,
    input: document.getElementById(`servo_${i}_input`) as HTMLInputElement,
    span: document.getElementById(`servo_${i}_span`) as HTMLSpanElement,
  }));

  function updateUiToCmd(cmd: string) {
    let raw = cmd.slice(1);

    speedInput.value = `${parseInt(raw.slice(2, 4), 16)}`;
    speedSpan.innerHTML = speedInput.value;

    for (const servo of servosDom) {
      servo.input.value = `${parseInt(raw.slice(0, 2), 16)}`;
      servo.span.innerHTML = servo.input.value;

      raw = raw.slice(4);
    }
  }

  let lastcmd: string = "";

  function toHex(n: number) {
    const s = n.toString(16).toUpperCase();
    return s.length === 1 ? `0${s}` : s;
  }
  function onChange() {
    const speed = parseInt(speedInput.value);

    speedSpan.innerHTML = `${speed}`;

    const servoValues: number[] = [];
    servosDom.forEach((s) => {
      const value = parseInt(s.input.value);
      s.span.innerHTML = `${value}`;
      servoValues.push(value);
    });

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
        .join("");

    lastcmd = cmd;
    runCmd(cmd);
  }
  speedInput.onchange = onChange;
  servosDom.forEach((s) => (s.input.onchange = onChange));
  onChange();

  const areaElement = document.getElementById(
    "bulk_cmds"
  ) as HTMLTextAreaElement;

  document.getElementById("save")!.onclick = () => {
    if (lastcmd) {
      areaElement.value = areaElement.value + lastcmd + "\n";
    }
  };

  const runButton = document.getElementById("run_all") as HTMLButtonElement;
  runButton.onclick = async () => {
    runButton.disabled = true;

    const lines = areaElement.value.split("\n");
    for (const line of lines
      .map((x) => x.trim())
      .map((line, idx) => ({ line, idx }))) {
      if (line.line) {
        runButton.innerHTML = `Running ${line.idx}/${lines.length}`;
        await runCmd(line.line);
      }
    }
    setHtml("cmd", "done");
    runButton.disabled = false;
    runButton.innerHTML = "Run";
  };

  const runAllReverse = document.getElementById(
    "run_reverse"
  ) as HTMLButtonElement;
  runAllReverse.onclick = async () => {
    runAllReverse.disabled = true;

    const lines = areaElement.value.split("\n");
    for (const line of lines
      .map((x) => x.trim())
      .map((line, idx) => ({ line, idx }))
      .reverse()) {
      if (line.line) {
        runAllReverse.innerHTML = `Running ${line.idx}/${lines.length}`;
        await runCmd(line.line);
      }
    }
    setHtml("cmd", "done");
    runAllReverse.disabled = false;
    runAllReverse.innerHTML = "Run all reverse";
  };

  const runCurrenttButton = document.getElementById(
    "run_current"
  ) as HTMLButtonElement;
  runCurrenttButton.onclick = () => {
    let currentPos = 0;
    let foundLine = "";
    for (const line of areaElement.value.split("\n")) {
      currentPos += line.length + 1;
      if (currentPos > areaElement.selectionStart) {
        foundLine = line;
        break;
      }
    }
    if (foundLine) {
      runCurrenttButton.disabled = true;
      runCmd(foundLine)
        .catch()
        .then(() => (runCurrenttButton.disabled = false));
    }
  };

  (document.getElementById(
    "change_all_speed_to_current"
  ) as HTMLButtonElement).onclick = () => {
    const newVal = areaElement.value
      .split("\n")
      .map((line) => {
        const speed = parseInt(speedInput.value);
        if (line.startsWith("M")) {
          return (
            line[0] +
            line[1] +
            line[2] +
            toHex(speed) +
            line[5] +
            line[6] +
            toHex(speed) +
            line[9] +
            line[10] +
            toHex(speed) +
            line[13] +
            line[14] +
            toHex(speed) +
            line[17] +
            line[18] +
            toHex(speed) +
            line[21] +
            line[22] +
            toHex(speed) +
            line.slice(25)
          );
        } else {
          return line;
        }
      })
      .join("\n");
    areaElement.value = newVal;
  };
}

document.getElementById("start")!.onclick = () => start();

const textAreaElement = document.getElementById(
  "bulk_cmds"
) as HTMLTextAreaElement;

const DEFAULT_CMDS =
  `
M6B14331499149E145A143A14
M6B1451146A14AC145A143A14
M6B1451146A1491145A143A14
  

`.trim() + "\n";
textAreaElement.value = localStorage.getItem("cmds") || DEFAULT_CMDS;

textAreaElement.onchange = () => {
  localStorage.setItem("cmds", textAreaElement.value);
};

/*

M6B141114A114A6145A144F14

M6B14331499149E145A144F14
M6B1451146A14AC145A144F14
M6B1451146A1491145A144F14


M6B1451146A1491145A146D14

M6B1451146A14A4145A146D14
M6B1441147214A4145A146D14
M6B1429148614A4145A146D14
M6B141A149D14A4145A146D14

M6B141A141A1401145A147014


M6B141A141A14A6145A147014
M6B141A141A14A6145A143414


*/

/*


M7C141C145C1402145A143814

M7C144614341402145A143814

M7C144614341402145A146D14

M7C141F14341402145A146D14 #Lift a little


M7C140D142714061458146D14
M23140D142714061458146D14

M29141E146A14061458146D14
M29141E146A14061458144014
M29141E143814061458144014




*/
