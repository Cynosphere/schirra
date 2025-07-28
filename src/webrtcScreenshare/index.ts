import { Patch } from "@moonlight-mod/types";

const logger = moonlight.getLogger("WebRTC Screenshare");
const getDisplayMediaOrig = navigator.mediaDevices.getDisplayMedia;

async function getVenmicStream() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    logger.debug("Devices:", devices);

    // This isn't vencord :(
    const id = devices.find((device) => device.label === "vencord-screen-share")?.deviceId;
    if (!id) return null;
    logger.debug("Got venmic device ID:", id);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: {
          exact: id
        },
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
        channelCount: 2,
        sampleRate: 48000,
        sampleSize: 16
      }
    });

    return stream.getAudioTracks();
  } catch (error) {
    logger.warn("Failed to get venmic stream:", error);
    return null;
  }
}

navigator.mediaDevices.getDisplayMedia = async function getDisplayMediaRedirect(options) {
  logger.debug("getDisplayMedia options", options);
  const orig = await getDisplayMediaOrig.call(this, options);

  // TODO: unhardcode these
  const framerate = 30;
  const height = 1080;
  const width = Math.round(height * (16 / 9));
  const track = orig.getVideoTracks()[0];

  track.contentHint = "detail";

  const constraints = {
    ...track.getConstraints(),
    frameRate: { min: framerate, ideal: framerate },
    width: { min: 640, ideal: width, max: width },
    height: { min: 480, ideal: height, max: height },
    advanced: [{ width, height }],
    resizeMode: "none"
  };

  track
    .applyConstraints(constraints)
    .then(() => {
      logger.debug("Applied media constraints", track.getConstraints());
    })
    .catch((err) => {
      logger.error("Failed to apply media constraints", err);
    });

  const venmic = await getVenmicStream();
  logger.debug("venmic", venmic);
  if (venmic != null) {
    // venmic will be proxying all audio, so we need to remove the original
    // tracks to not cause overlap
    for (const track of orig.getAudioTracks()) {
      orig.removeTrack(track);
    }

    for (const track of venmic) {
      orig.addTrack(track);
    }
  }

  return orig;
};

export const patches: Patch[] = [
  // "Ensure discord_voice is happy"
  {
    find: "RustAudioDeviceModule",
    replace: [
      {
        match: /static supported\(\)\{.+?\}/,
        replacement: "static supported(){return true}"
      },
      {
        match: "supported(){return!0}",
        replacement: "supported(){return true}"
      }
    ]
  },

  // Remove Native media engine from list of choices
  {
    find: '.CAMERA_BACKGROUND_LIVE="cameraBackgroundLive"',
    replace: {
      match: /\i\.\i\.NATIVE,/,
      replacement: ""
    }
  },

  // Stub out browser checks to allow us to use WebRTC voice on Embedded
  {
    find: "Using Unified Plan (",
    replace: {
      match: /return \i\.\i\?\((\i)\.info/,
      replacement: (_, logger) => `return true?(${logger}.info`
    }
  },
  {
    find: '"UnifiedConnection("',
    replace: {
      match: /this\.videoSupported=\i\.\i;/,
      replacement: "this.videoSupported=true;"
    }
  },
  {
    find: "OculusBrowser",
    replace: [
      {
        match: /"Firefox"===\i\(\)\.name/g,
        replacement: (orig: string) => `true||${orig}`
      }
    ]
  },
  {
    find: ".getMediaEngine().getDesktopSource",
    replace: [
      {
        match: /\i\.isPlatformEmbedded/,
        replacement: "false"
      },
      {
        match:
          /=\(0,\i\.\i\)\(\i\.\i\.PRESET_CUSTOM,.+?\.getCurrentUser\(\),null==.+?\.premiumTier,\i\)\?({width:1920,height:1080}):{width:1280,height:720};/,
        replacement: (_, dimensions) => `=${dimensions};`
      }
    ]
  },

  // quality
  {
    find: "x-google-max-bitrate",
    replace: [
      {
        match: /"x-google-max-bitrate="\.concat\(\i\)/,
        replacement: '"x-google-max-bitrate=80_000"'
      },
      {
        match: ";level-asymmetry-allowed=1",
        replacement: ";b=AS:800000;level-asymmetry-allowed=1"
      },
      {
        match: /;usedtx="\.concat\((\i)\?"0":"1"\)/,
        replacement: (orig, param) => `${orig}.concat(${param}?";stereo=1;sprop-stereo=1":"")`
      }
    ]
  }
];
