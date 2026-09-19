export const SCREENSHOT_INTERVAL_MS = 10_000;
export const MAX_SCREENSHOTS_PER_SESSION = 24;

export type ScreenWatch = {
  stop: () => void;
};

function grabFrame(video: HTMLVideoElement): string | null {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.45);
}

export async function startPeriodicScreenshots(
  onFrame: (dataUrl: string) => void | Promise<void>,
  intervalMs = SCREENSHOT_INTERVAL_MS,
): Promise<ScreenWatch> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();

  let count = 0;
  const tick = async () => {
    if (count >= MAX_SCREENSHOTS_PER_SESSION) return;
    const dataUrl = grabFrame(video);
    if (!dataUrl) return;
    count += 1;
    await onFrame(dataUrl);
  };

  await tick();
  const timer = window.setInterval(() => {
    void tick();
  }, intervalMs);

  const stop = () => {
    window.clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  stream.getVideoTracks()[0]?.addEventListener("ended", stop);
  return { stop };
}
