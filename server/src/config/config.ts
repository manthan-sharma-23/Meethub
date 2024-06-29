import { RtpCodecCapability } from "mediasoup/node/lib/RtpParameters";
import { WorkerLogLevel, WorkerLogTag } from "mediasoup/node/lib/Worker";
import os from "os";

const ifaces = os.networkInterfaces();

const getLocalIp = () => {
  let localIp = "127.0.0.1";
  Object.keys(ifaces).forEach((ifname) => {
    for (const iface of ifaces[ifname]!) {
      // Ignore IPv6 and 127.0.0.1
      if (iface.family !== "IPv4" || iface.internal !== false) {
        continue;
      }
      // Set the local ip to the first IPv4 address found and exit the loop
      localIp = iface.address;
      return;
    }
  });
  return localIp;
};

export const config = {
  app: {
    port: 5000,
  },
  mediasoup: {
    // Worker settings
    numWorkers: Object.keys(os.cpus()).length,
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: "debug" as WorkerLogLevel,
      logTags: [
        "info",
        "ice",
        "dtls",
        "rtp",
        "srtp",
        "rtcp",
        // 'rtx',
        // 'bwe',
        // 'score',
        // 'simulcast',
        // 'svc'
      ] as WorkerLogTag[],
    },
    // Router settings
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
      ] as RtpCodecCapability[],
    },
    // WebRtcTransport settings
    webRtcTransport: {
      listenIps: [
        {
          ip: "0.0.0.0",
          announcedIp: getLocalIp(), // replace by public IP address
        },
      ],
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000,
    },
  },
};
