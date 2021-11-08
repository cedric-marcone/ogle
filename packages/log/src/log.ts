import fs from "fs";
// import zlib from "zlib";

export type Limits = "DEBUG" | "LOG" | "INFO" | "WARN" | "ERROR";

type StreamRef = {
  path: string;
  stream: fs.WriteStream;
  creationTimestamp: number;
};
type Streams = { [s: string]: StreamRef | null };
type Calls = { [level in Limits]: Console[Lowercase<level>] };
type Levels = { [level in Limits]: number };
type Writer = (
  stream: "stdout" | "stderr",
  limit: Limits
) => (level: Limits) => (...args: unknown[]) => void;

const EXT = ".log";
const streams: Streams = {
  stdout: null,
  stderr: null,
};
const calls: Calls = {
  DEBUG: console.debug,
  LOG: console.log,
  INFO: console.info,
  WARN: console.warn,
  ERROR: console.debug,
};
const LEVELS: Levels = {
  DEBUG: 1,
  LOG: 2,
  INFO: 3,
  WARN: 4,
  ERROR: 5,
};

export function redirectToFiles(limit: Limits, dir: string) {
  fs.mkdirSync(dir, { recursive: true });

  streams.stdout = createStream(`${dir}/app${EXT}`, "a");
  streams.stderr = createStream(`${dir}/err${EXT}`, "a");

  const stdoutWriter = writer("stdout", limit);
  const stderrWriter = writer("stderr", limit);

  console.debug = stdoutWriter("DEBUG");
  console.log = stdoutWriter("LOG");
  console.info = stdoutWriter("INFO");
  console.warn = stderrWriter("WARN");
  console.error = stderrWriter("ERROR");
}

function createStream(path: string, flags: string): StreamRef {
  const fd = fs.openSync(path, "a");
  const stats = fs.statSync(path);
  fs.closeSync(fd);
  const stream = fs.createWriteStream(path, { flags });
  const creationTimestamp = stats.birthtimeMs;
  return {
    path,
    stream,
    creationTimestamp,
  };
}

const writer: Writer = (streamName, limit) => (level) => {
  return (...args) => {
    calls[level](...args);
    let ref = streams[streamName];
    if (ref === null || LEVELS[level] < LEVELS[limit]) {
      return;
    }
    // ref = rotate(streamName);
    // if (ref === null) {
    //   return;
    // }
    const when = timestamp();
    const what = `[${level}]`.padEnd(7, " ");
    const message = formatArgs(...args);
    ref.stream.write(when);
    ref.stream.write(" ");
    ref.stream.write(what);
    ref.stream.write(" ");
    ref.stream.write(message);
    ref.stream.write("\n");
  };
};

function timestamp() {
  const now = new Date();
  const yy = now.getFullYear();
  const mm = padNumber(2, now.getMonth() + 1);
  const dd = padNumber(2, now.getDate());
  const hh = padNumber(2, now.getHours());
  const mi = padNumber(2, now.getMinutes());
  const ss = padNumber(2, now.getSeconds());
  const ms = padNumber(3, now.getMilliseconds());
  return `${yy}-${mm}-${dd} ${hh}:${mi}:${ss}.${ms}`;
}

function padNumber(count: number, n: number) {
  return String(n).padStart(count, "0");
}

function formatArgs(...args: unknown[]) {
  return args.map((arg) => formatArg(arg)).join(" ");
}

function formatArg(arg: unknown) {
  if (typeof arg === "string") {
    return arg;
  } else if (typeof arg === "object") {
    return JSON.stringify(arg, null, 0);
  } else if (
    typeof arg === "boolean" ||
    typeof arg === "number" ||
    typeof arg === "bigint" ||
    typeof arg === "symbol" ||
    typeof arg === "function"
  ) {
    return arg.toString();
  } else {
    return "undefined";
  }
}

// function rotate(streamName: string) {
//   let ref = streams[streamName];
//   if (ref === null) {
//     return ref;
//   }
//   if (needsRotation(ref)) {
//     archive(ref);
//     ref = createStream(ref.path, "w");
//     streams[streamName] = ref;
//   }
//   return ref;
// }

// function needsRotation(ref: StreamRef) {
//   const now = new Date();
//   const create = new Date(ref.creationTimestamp);
//   const roll = new Date(create);
//   roll.setDate(roll.getDate() + 1);
//   return now.getTime() >= roll.getTime();
// }

// async function archive(ref: StreamRef) {
//   ref.stream.close();

//   const create = new Date();
//   const offset = create.getTimezoneOffset();
//   create.setTime(ref.creationTimestamp);
//   create.setTime(create.getTime() - offset * 60000);
//   const yy = create.getFullYear();
//   const mm = padNumber(2, create.getMonth() + 1);
//   const dd = padNumber(2, create.getDate());
//   const date = `${yy}-${mm}-${dd}`;

//   const path = ref.path;
//   const pathWithoutExt = path.slice(0, -EXT.length);
//   const archive = pathWithoutExt + "-" + date + EXT + ".gz";

//   const zip = zlib.createGzip();
//   const read = fs.createReadStream(path);
//   const write = fs.createWriteStream(archive);

//   // write.on("close", () => fs.rmSync(path));
//   read.pipe(zip).pipe(write);
// }
