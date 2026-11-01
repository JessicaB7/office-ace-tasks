import { describe, expect, it } from "vitest";
import { isSafeUrl, videoEmbedUrl } from "../videoEmbed";

describe("videoEmbedUrl", () => {
  it("Google Drive → preview", () => {
    expect(videoEmbedUrl("https://drive.google.com/file/d/abc123/view?usp=sharing")).toBe("https://drive.google.com/file/d/abc123/preview");
    expect(videoEmbedUrl("https://drive.google.com/open?id=xyz")).toBe("https://drive.google.com/file/d/xyz/preview");
  });
  it("Loom e YouTube", () => {
    expect(videoEmbedUrl("https://www.loom.com/share/a1b2c3")).toBe("https://www.loom.com/embed/a1b2c3");
    expect(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });
  it("OneDrive: só o link de incorporar", () => {
    expect(videoEmbedUrl("https://1drv.ms/v/s!abc")).toBeNull();
    expect(videoEmbedUrl("https://onedrive.live.com/embed?resid=1")).toBe("https://onedrive.live.com/embed?resid=1");
  });
  it("vazio", () => expect(videoEmbedUrl("")).toBeNull());
});

describe("isSafeUrl", () => {
  it("aceita só http(s)", () => {
    expect(isSafeUrl("https://drive.google.com/x")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });
});
